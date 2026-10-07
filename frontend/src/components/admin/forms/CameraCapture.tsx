/**
 * CameraCapture — shared full-screen camera (used by FileUploader).
 *
 * - Front / back switching (facingMode, falling back to cycling devices), and a
 *   camera picker when the device has more than two lenses.
 * - Starts on the BACK camera by default (staff photographing a student or a
 *   document); laptops simply get their webcam.
 * - What you see is what you get: the preview box has the crop's aspect ratio
 *   (3:4 passport by default), and the capture is cropped to exactly that.
 * - Face oval / frame guide, flash (torch) and zoom where the camera supports
 *   them, a 3 s / 10 s self-timer, and a review step (Retake / Use photo).
 * - Clear errors (blocked permission, no camera, camera busy, insecure page)
 *   with a "Camera app" fallback (native capture input), which also works when
 *   live preview isn't available.
 * - The camera is released on close, on capture and when the app goes to the
 *   background, and restarted when it comes back.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { AlertTriangle, Check, Grid, ImagePlus, Loader2, RefreshCw, RotateCcw, RotateCw, Timer, X, Zap, ZapOff } from 'lucide-react';

export type CameraFacing = 'user' | 'environment';
export type CameraGuide = 'face' | 'frame' | 'none';

export interface CameraCaptureProps {
  open: boolean;
  onClose: () => void;
  /** The captured (cropped) JPEG, or a file from the native camera app. */
  onCapture: (file: File) => void;
  /** Camera to start with. Default: back camera. */
  facing?: CameraFacing;
  /** Crop aspect ratio, width / height (3/4 passport, 1 square). Omit for the full frame. */
  aspect?: number;
  /** Overlay guide: face oval (people), frame (documents / logos) or none. */
  guide?: CameraGuide;
  title?: string;
}

const TIMER_STEPS = [0, 3, 10];
/** Largest tilt corrected automatically / by the Straighten slider (degrees). */
const MAX_STRAIGHTEN = 15;
/** Below this the phone counts as level (degrees). */
const LEVEL_TOLERANCE = 1.5;

/**
 * Zoom needed so an image rotated by `deg` still fills its own box (no blank
 * corners). `ratio` = width / height.
 */
function coverScale(deg: number, ratio: number): number {
  const r = (Math.abs(deg) * Math.PI) / 180;
  const c = Math.cos(r), s = Math.sin(r);
  return Math.max(c + s / ratio, c + s * ratio);
}

/** Rule-of-thirds lines and a centre mark. */
const CompositionGrid: React.FC = () => (
  <div className="pointer-events-none absolute inset-0" aria-hidden="true">
    <div className="absolute inset-y-0 left-1/3 w-px bg-white/40" />
    <div className="absolute inset-y-0 left-2/3 w-px bg-white/40" />
    <div className="absolute inset-x-0 top-1/3 h-px bg-white/40" />
    <div className="absolute inset-x-0 top-2/3 h-px bg-white/40" />
    <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-px bg-white/70" />
    <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-4 w-px bg-white/70" />
  </div>
);

const stopStream = (s: MediaStream | null) => s?.getTracks().forEach((t) => t.stop());

function cameraErrorMessage(err: any): string {
  const name = err?.name || '';
  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return 'Camera access is blocked. Allow the camera for this site (or the app) in your settings, then try again.';
  }
  if (name === 'NotFoundError' || name === 'OverconstrainedError' || name === 'DevicesNotFoundError') {
    return 'No camera was found on this device.';
  }
  if (name === 'NotReadableError' || name === 'TrackStartError' || name === 'AbortError') {
    return 'The camera is busy (another app or browser tab may be using it). Close it and try again, or use the camera app.';
  }
  return 'The camera could not be started.';
}

function cameraLabel(d: MediaDeviceInfo, i: number): string {
  const l = d.label || '';
  if (/back|rear|environment/i.test(l)) return `Back camera${/wide|ultra/i.test(l) ? ' (wide)' : ''}`;
  if (/front|user|face/i.test(l)) return 'Front camera';
  return l || `Camera ${i + 1}`;
}

export const CameraCapture: React.FC<CameraCaptureProps> = ({
  open,
  onClose,
  onCapture,
  facing: initialFacing = 'environment',
  aspect,
  guide = 'face',
  title = 'Take a photo',
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const shutterRef = useRef<HTMLButtonElement>(null);
  // Each start() gets an id; a slower, superseded start releases its stream.
  const reqId = useRef(0);
  // The camera request still opening, if any. A new start waits for it: on
  // Windows (and some Android phones) a second request while the first is
  // still opening the device fails with NotReadableError ("in use").
  const inFlight = useRef<Promise<unknown> | null>(null);

  const [facing, setFacing] = useState<CameraFacing>(initialFacing);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [videoAspect, setVideoAspect] = useState<number | null>(null);
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [zoom, setZoom] = useState<{ min: number; max: number; step: number; value: number } | null>(null);
  const [timer, setTimer] = useState(0);
  const [countdown, setCountdown] = useState<number | null>(null);
  // The captured crop (unmirrored) + how it is shown/saved: mirrored like the
  // preview for the front camera, and straightened by `straighten` degrees.
  const [shot, setShot] = useState<{ url: string; canvas: HTMLCanvasElement; mirrored: boolean; auto: number } | null>(null);
  const [straighten, setStraighten] = useState(0);
  // Composition grid (rule of thirds + centre), remembered on this device.
  const [showGrid, setShowGrid] = useState<boolean>(() => {
    try { return localStorage.getItem('camera.grid') !== 'off'; } catch { return true; }
  });
  // Phone tilt in degrees (+ = turned clockwise), from the motion sensor.
  // null = no sensor (laptops) or the phone is lying flat.
  const [tilt, setTilt] = useState<number | null>(null);
  const tiltRef = useRef<number | null>(null);
  const [motionGranted, setMotionGranted] = useState(false);
  const [motionNeedsPermission, setMotionNeedsPermission] = useState(false);

  const supported = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;

  const release = useCallback(() => {
    reqId.current++;
    stopStream(streamRef.current);
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  /** Start a camera. Resolves to the device id actually opened (or null). */
  const start = useCallback(async (opts: { facing: CameraFacing; deviceId?: string | null }): Promise<string | null> => {
    release();
    const id = reqId.current;
    setStarting(true);
    setError(null);
    setTorchOn(false);
    setTorchSupported(false);
    setZoom(null);

    const size = { width: { ideal: 1920 }, height: { ideal: 1440 } };
    const attempts: MediaStreamConstraints[] = opts.deviceId
      ? [{ video: { deviceId: { exact: opts.deviceId }, ...size }, audio: false }]
      : [
          { video: { facingMode: { exact: opts.facing }, ...size }, audio: false },
          { video: { facingMode: opts.facing, ...size }, audio: false },
          { video: true, audio: false },
        ];

    // Let an earlier request finish (its stream is dropped as stale) first.
    if (inFlight.current) await inFlight.current.catch(() => {});
    if (id !== reqId.current) return null;

    const busy = (e: any) => ['NotReadableError', 'TrackStartError', 'AbortError'].includes(e?.name);
    const wait = (ms: number) => new Promise((res) => window.setTimeout(res, ms));
    let stream: MediaStream | null = null;
    let used = -1;
    let lastErr: any = null;
    for (let i = 0; i < attempts.length && !stream; i++) {
      // A camera that was just stopped (by us, a previous page or a flip) can
      // take a moment to be released: retry "in use" twice before giving up.
      for (let retry = 0; retry < 3; retry++) {
        if (id !== reqId.current) return null;
        try {
          const p = navigator.mediaDevices.getUserMedia(attempts[i]);
          inFlight.current = p;
          stream = await p;
          used = i;
          break;
        } catch (e: any) {
          lastErr = e;
          if (!busy(e) || retry === 2) break;
          await wait(retry === 0 ? 400 : 1000);
        } finally {
          inFlight.current = null;
        }
      }
      // A refusal won't change with looser constraints.
      if (!stream && (lastErr?.name === 'NotAllowedError' || lastErr?.name === 'SecurityError')) break;
    }
    if (id !== reqId.current) {
      stopStream(stream);
      return null;
    }
    if (!stream) {
      setStarting(false);
      setError(cameraErrorMessage(lastErr));
      return null;
    }

    streamRef.current = stream;
    const track = stream.getVideoTracks()[0];
    const settings: any = track?.getSettings?.() ?? {};
    if (settings.facingMode === 'user' || settings.facingMode === 'environment') {
      setFacing(settings.facingMode);
    } else if (!opts.deviceId) {
      // No facing info: the exact request failed and we got "a camera",
      // which on a laptop is the front webcam (mirror it like a mirror).
      setFacing(used === 0 ? opts.facing : 'user');
    }
    const openedId: string | null = settings.deviceId ?? opts.deviceId ?? null;
    setDeviceId(openedId);

    const caps: any = (track as any)?.getCapabilities?.() ?? {};
    setTorchSupported(!!caps.torch);
    if (caps.zoom && Number(caps.zoom.max) > Number(caps.zoom.min)) {
      setZoom({ min: caps.zoom.min, max: caps.zoom.max, step: caps.zoom.step || 0.1, value: settings.zoom ?? caps.zoom.min });
    }

    const v = videoRef.current;
    if (v) {
      v.srcObject = stream;
      v.play().catch(() => { /* autoplay is muted + playsInline; ignore */ });
    }
    // Device labels are only readable after permission is granted.
    navigator.mediaDevices
      .enumerateDevices()
      .then((list) => { if (id === reqId.current) setDevices(list.filter((d) => d.kind === 'videoinput')); })
      .catch(() => {});
    setStarting(false);
    return openedId;
  }, [release]);

  // Open / close.
  useEffect(() => {
    if (!open) return;
    setShot(null);
    setCountdown(null);
    setDeviceId(null);
    setFacing(initialFacing);
    if (supported) {
      void start({ facing: initialFacing });
    } else {
      setError('Live camera preview isn\u2019t available here (it needs a secure https page). Use the camera app instead.');
    }
    return () => release();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Release the camera when the app goes to the background; resume on return.
  useEffect(() => {
    if (!open || !supported) return;
    const onVisibility = () => {
      if (document.hidden) release();
      else if (!streamRef.current && !shot) void start({ facing, deviceId });
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [open, supported, shot, facing, deviceId, start, release]);

  // Esc closes.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open, onClose]);

  // Free the review image's object URL.
  useEffect(() => () => { if (shot) URL.revokeObjectURL(shot.url); }, [shot]);

  const flip = async () => {
    const next: CameraFacing = facing === 'user' ? 'environment' : 'user';
    const prevId = deviceId;
    const got = await start({ facing: next });
    // Some devices ignore facingMode (two webcams, some tablets): cycle lenses.
    if (got && got === prevId && devices.length > 1) {
      const i = devices.findIndex((d) => d.deviceId === prevId);
      await start({ facing: next, deviceId: devices[(i + 1) % devices.length].deviceId });
    }
  };

  const toggleTorch = async () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    try {
      await track.applyConstraints({ advanced: [{ torch: !torchOn } as any] });
      setTorchOn(!torchOn);
    } catch {
      setTorchSupported(false);
    }
  };

  const changeZoom = (value: number) => {
    const track = streamRef.current?.getVideoTracks()[0];
    setZoom((z) => (z ? { ...z, value } : z));
    track?.applyConstraints({ advanced: [{ zoom: value } as any] }).catch(() => {});
  };

  const grab = useCallback(() => {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    const vw = v.videoWidth;
    const vh = v.videoHeight;
    let sx = 0, sy = 0, sw = vw, sh = vh;
    if (aspect) {
      // Centre crop: the same region the object-cover preview shows.
      if (vw / vh > aspect) { sw = Math.round(vh * aspect); sx = Math.round((vw - sw) / 2); }
      else { sh = Math.round(vw / aspect); sy = Math.round((vh - sh) / 2); }
    }
    const canvas = document.createElement('canvas');
    canvas.width = sw;
    canvas.height = sh;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(v, sx, sy, sw, sh, 0, 0, sw, sh);
    // Auto-straighten by the phone's tilt at the moment of capture (small
    // tilts only; a big angle is probably deliberate).
    const t = tiltRef.current;
    const auto = t !== null && Math.abs(t) <= MAX_STRAIGHTEN ? Math.round(t * 2) / 2 : 0;
    const mirrored = facing === 'user';
    canvas.toBlob((b) => {
      if (!b) return;
      setStraighten(auto);
      setShot({ url: URL.createObjectURL(b), canvas, mirrored, auto });
    }, 'image/jpeg', 0.95);
  }, [aspect, facing]);

  const grabRef = useRef(grab);
  grabRef.current = grab;

  // Self-timer countdown.
  useEffect(() => {
    if (countdown === null) return;
    if (countdown <= 0) { setCountdown(null); grabRef.current(); return; }
    const t = setTimeout(() => setCountdown((c) => (c === null ? null : c - 1)), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  const shutter = () => {
    if (countdown !== null || starting || error) return;
    if (timer) setCountdown(timer);
    else grab();
  };

  const retake = () => {
    setShot(null);
    // The stream keeps running during review, so retaking is instant; restart
    // it if the app was backgrounded meanwhile.
    if (!streamRef.current && supported) void start({ facing, deviceId });
    setTimeout(() => shutterRef.current?.focus(), 0);
  };

  const usePhoto = () => {
    if (!shot) return;
    // Save exactly what the review shows: same mirroring, same straightening.
    const src = shot.canvas;
    const w = src.width, h = src.height;
    const out = document.createElement('canvas');
    out.width = w;
    out.height = h;
    const ctx = out.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
    ctx.translate(w / 2, h / 2);
    if (shot.mirrored) ctx.scale(-1, 1);
    ctx.rotate((straighten * Math.PI) / 180);
    const s = coverScale(straighten, w / h);
    ctx.scale(s, s);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(src, -w / 2, -h / 2);
    out.toBlob((b) => {
      if (!b) return;
      release();
      onCapture(new File([b], `camera-${Date.now()}.jpg`, { type: 'image/jpeg' }));
    }, 'image/jpeg', 0.92);
  };

  const toggleGrid = () => {
    setShowGrid((g) => {
      try { localStorage.setItem('camera.grid', g ? 'off' : 'on'); } catch { /* private mode */ }
      return !g;
    });
  };

  // Level: the phone's roll from the gravity sensor, smoothed. Android fires
  // devicemotion freely; iOS needs a tap to grant motion access first.
  useEffect(() => {
    if (!open || shot) return;
    const DM: any = typeof window !== 'undefined' ? (window as any).DeviceMotionEvent : undefined;
    if (!DM) return;
    if (typeof DM.requestPermission === 'function' && !motionGranted) {
      setMotionNeedsPermission(true);
      return;
    }
    let smooth: number | null = null;
    const onMotion = (e: DeviceMotionEvent) => {
      const g = e.accelerationIncludingGravity;
      if (!g || g.x == null || g.y == null) return;
      // Lying flat (photographing a document on a desk): no meaningful roll.
      if (Math.hypot(g.x, g.y) < 4) {
        smooth = null;
        tiltRef.current = null;
        setTilt(null);
        return;
      }
      const a = (Math.atan2(g.x, g.y) * 180) / Math.PI;
      // Deviation from the nearest upright/sideways position. Folding by 90°
      // also absorbs the inverted axes some iOS versions report.
      const dev = -(a - Math.round(a / 90) * 90);
      smooth = smooth === null ? dev : smooth * 0.8 + dev * 0.2;
      tiltRef.current = smooth;
      setTilt(Math.round(smooth * 2) / 2); // 0.5° steps keep re-renders low
    };
    window.addEventListener('devicemotion', onMotion);
    return () => {
      window.removeEventListener('devicemotion', onMotion);
      tiltRef.current = null;
      setTilt(null);
    };
  }, [open, shot, motionGranted]);

  const enableLevel = async () => {
    try {
      const r = await (window as any).DeviceMotionEvent.requestPermission();
      if (r === 'granted') { setMotionGranted(true); setMotionNeedsPermission(false); }
      else setMotionNeedsPermission(false);
    } catch {
      setMotionNeedsPermission(false);
    }
  };

  const onNativeFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) { release(); onCapture(file); }
  };

  if (!open) return null;

  const boxAspect = aspect ?? videoAspect ?? 3 / 4;
  const mirrored = facing === 'user';
  const canFlip = devices.length !== 1; // unknown (0) before permission: allow trying
  const nextSide = facing === 'user' ? 'back' : 'front';

  const content = (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-[80] flex flex-col bg-black text-white select-none"
      style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 px-3 h-14 shrink-0">
        <button type="button" onClick={onClose} aria-label="Close camera" className="p-2.5 rounded-full hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white">
          <X size={22} />
        </button>
        <h2 className="text-sm font-semibold truncate">{shot ? 'Review photo' : title}</h2>
        <div className="flex items-center gap-1">
          {!shot && torchSupported && (
            <button type="button" onClick={toggleTorch} aria-pressed={torchOn} aria-label={torchOn ? 'Turn flash off' : 'Turn flash on'} className="p-2.5 rounded-full hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white">
              {torchOn ? <Zap size={20} className="text-yellow-300" /> : <ZapOff size={20} />}
            </button>
          )}
          {!error && (
            <button
              type="button"
              onClick={toggleGrid}
              aria-pressed={showGrid}
              aria-label={showGrid ? 'Hide grid' : 'Show grid'}
              className="p-2.5 rounded-full hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              <Grid size={20} className={showGrid ? 'text-yellow-300' : ''} />
            </button>
          )}
          {!shot && supported && !error && (
            <button
              type="button"
              onClick={() => setTimer((t) => TIMER_STEPS[(TIMER_STEPS.indexOf(t) + 1) % TIMER_STEPS.length])}
              aria-label={timer ? `Self-timer ${timer} seconds. Change` : 'Self-timer off. Turn on'}
              className="flex items-center gap-1 p-2.5 rounded-full hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              <Timer size={20} className={timer ? 'text-yellow-300' : ''} />
              {timer > 0 && <span className="text-xs font-bold text-yellow-300">{timer}s</span>}
            </button>
          )}
        </div>
      </div>

      {/* Lens picker (phones with several back lenses) */}
      {!shot && devices.length > 2 && (
        <div className="flex justify-center px-3 pb-2 shrink-0">
          <label className="sr-only" htmlFor="camera-capture-device">Camera</label>
          <select
            id="camera-capture-device"
            value={deviceId ?? ''}
            onChange={(e) => void start({ facing, deviceId: e.target.value })}
            className="bg-white/10 text-white text-xs rounded-full px-3 py-1.5 border border-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            {devices.map((d, i) => (
              <option key={d.deviceId || i} value={d.deviceId} className="text-black">{cameraLabel(d, i)}</option>
            ))}
          </select>
        </div>
      )}

      {/* Viewfinder */}
      <div className="flex-1 min-h-0 flex items-center justify-center px-3">
        <div
          className="relative overflow-hidden rounded-2xl bg-gray-900"
          style={{
            aspectRatio: String(boxAspect),
            // vh, not dvh: older Android WebViews drop the whole rule on dvh.
            width: `min(calc(100vw - 24px), calc((100vh - 260px) * ${boxAspect}), 640px)`,
          }}
        >
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            onLoadedMetadata={(e) => {
              const v = e.currentTarget;
              if (v.videoWidth && v.videoHeight) setVideoAspect(v.videoWidth / v.videoHeight);
            }}
            className={`absolute inset-0 w-full h-full object-cover ${shot ? 'invisible' : ''}`}
            style={mirrored ? { transform: 'scaleX(-1)' } : undefined}
          />

          {/* Review: shown exactly as it will be saved (mirroring + straightening). */}
          {shot && (
            <img
              src={shot.url}
              alt="Captured photo preview"
              className="absolute inset-0 w-full h-full object-cover"
              style={{
                transform: `${shot.mirrored ? 'scaleX(-1) ' : ''}rotate(${straighten}deg) scale(${coverScale(straighten, boxAspect)})`,
              }}
            />
          )}

          {/* Guide */}
          {!shot && !error && !starting && guide === 'face' && (
            <>
              <div className="pointer-events-none absolute left-1/2 top-[46%] -translate-x-1/2 -translate-y-1/2 w-[62%] aspect-[3/4] rounded-[50%] border-2 border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
              <p className="pointer-events-none absolute bottom-2 inset-x-0 text-center text-[11px] text-white/90 drop-shadow">Face inside the oval · nose on the centre line · good light</p>
            </>
          )}
          {!shot && !error && !starting && guide === 'frame' && (
            <div className="pointer-events-none absolute inset-4 rounded-lg border-2 border-white/70 border-dashed" />
          )}

          {/* Composition grid (live and in review, to check it's straight) */}
          {showGrid && !error && !starting && <CompositionGrid />}

          {/* Level: the line follows the real horizon; it lines up with the
              side marks and turns green when the phone is straight. */}
          {!shot && !error && !starting && tilt !== null && (() => {
            const level = Math.abs(tilt) < LEVEL_TOLERANCE;
            const lineDeg = mirrored ? tilt : -tilt;
            return (
              <>
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center" aria-hidden="true">
                  <div className="relative w-[72%] h-0">
                    <div className={`absolute left-0 -top-px w-5 h-0.5 rounded ${level ? 'bg-green-400' : 'bg-white/80'}`} />
                    <div className={`absolute right-0 -top-px w-5 h-0.5 rounded ${level ? 'bg-green-400' : 'bg-white/80'}`} />
                    <div
                      className={`absolute left-7 right-7 -top-px h-0.5 rounded transition-colors ${level ? 'bg-green-400' : 'bg-amber-400'}`}
                      style={{ transform: `rotate(${lineDeg}deg)` }}
                    />
                  </div>
                </div>
                <div className="pointer-events-none absolute top-2 left-1/2 -translate-x-1/2">
                  <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold shadow ${
                    level ? 'bg-green-600/90 text-white' : 'bg-black/65 text-amber-300'
                  }`}>
                    {level ? (
                      <><Check size={12} /> Level</>
                    ) : (
                      <>
                        {tilt > 0 ? <RotateCcw size={12} /> : <RotateCw size={12} />}
                        Tilted {Math.abs(tilt).toFixed(0)}° · straighten the phone
                      </>
                    )}
                  </span>
                </div>
                <span className="sr-only" aria-live="polite">{level ? 'Phone is level' : 'Phone is tilted'}</span>
              </>
            );
          })()}
          {!shot && !error && !starting && motionNeedsPermission && (
            <button
              type="button"
              onClick={() => void enableLevel()}
              className="absolute top-2 left-1/2 -translate-x-1/2 rounded-full px-3 py-1 text-[11px] font-semibold bg-black/65 hover:bg-black/80"
            >
              Show level
            </button>
          )}

          {starting && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/60">
              <Loader2 size={28} className="animate-spin" />
              <span className="text-xs text-white/80">Starting camera…</span>
            </div>
          )}

          {countdown !== null && (
            <div aria-live="assertive" className="absolute inset-0 flex items-center justify-center bg-black/20">
              <span className="text-7xl font-black drop-shadow-lg">{countdown}</span>
            </div>
          )}

          {error && (
            <div role="alert" className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-5 text-center bg-gray-900">
              <AlertTriangle size={28} className="text-amber-400" />
              <p className="text-sm text-white/90">{error}</p>
              <div className="flex flex-wrap justify-center gap-2">
                {supported && (
                  <button type="button" onClick={() => void start({ facing })} className="px-3 py-2 rounded-lg bg-white/15 hover:bg-white/25 text-xs font-semibold">
                    Try again
                  </button>
                )}
                <button type="button" onClick={() => fileRef.current?.click()} className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-xs font-semibold">
                  Use camera app
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Straighten (review) */}
      {shot && (
        <div className="flex flex-col items-center gap-1 px-6 pt-3 shrink-0">
          <div className="flex items-center justify-center gap-3 w-full">
            <label htmlFor="camera-capture-straighten" className="text-[11px] text-white/80 shrink-0">Straighten</label>
            <input
              id="camera-capture-straighten"
              type="range"
              min={-MAX_STRAIGHTEN}
              max={MAX_STRAIGHTEN}
              step={0.5}
              value={straighten}
              onChange={(e) => setStraighten(Number(e.target.value))}
              aria-valuetext={`${straighten} degrees`}
              className="w-full max-w-xs accent-white"
            />
            <span className="text-[11px] text-white/80 w-10 text-right tabular-nums">{straighten.toFixed(1)}°</span>
            {straighten !== 0 && (
              <button type="button" onClick={() => setStraighten(0)} className="text-[11px] font-semibold text-blue-300 hover:text-blue-200 shrink-0">
                Reset
              </button>
            )}
          </div>
          <p className="text-[10px] text-white/60 text-center">
            {shot.auto !== 0
              ? `Straightened ${Math.abs(shot.auto).toFixed(1)}° automatically from the phone's tilt. Drag to adjust.`
              : 'Drag until the grid lines run parallel with the shoulders or walls.'}
          </p>
        </div>
      )}

      {/* Zoom */}
      {!shot && zoom && !error && (
        <div className="flex items-center justify-center gap-3 px-6 pt-3 shrink-0">
          <span className="text-[11px] text-white/70 w-8 text-right">{zoom.value.toFixed(1)}×</span>
          <input
            type="range"
            min={zoom.min}
            max={zoom.max}
            step={zoom.step}
            value={zoom.value}
            onChange={(e) => changeZoom(Number(e.target.value))}
            aria-label="Zoom"
            className="w-full max-w-xs accent-white"
          />
        </div>
      )}

      {/* Controls */}
      <div className="h-28 shrink-0 flex items-center justify-around px-6">
        {shot ? (
          <>
            <button type="button" onClick={retake} className="flex flex-col items-center gap-1 px-4 py-2 rounded-xl hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white">
              <RotateCcw size={24} />
              <span className="text-xs font-semibold">Retake</span>
            </button>
            <button type="button" autoFocus onClick={usePhoto} className="flex items-center gap-2 px-6 py-3 rounded-full bg-blue-600 hover:bg-blue-700 font-semibold text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-white">
              <Check size={20} /> Use photo
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              aria-label="Use the phone's camera app instead"
              className="flex flex-col items-center gap-1 w-16 py-2 rounded-xl hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              <ImagePlus size={22} />
              <span className="text-[10px] text-white/80">Camera app</span>
            </button>
            <button
              ref={shutterRef}
              type="button"
              autoFocus
              onClick={shutter}
              disabled={starting || !!error || countdown !== null}
              aria-label={timer ? `Take photo in ${timer} seconds` : 'Take photo'}
              className="w-[72px] h-[72px] rounded-full border-4 border-white flex items-center justify-center disabled:opacity-40 focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-400"
            >
              <span className="w-[56px] h-[56px] rounded-full bg-white active:scale-90 transition-transform" />
            </button>
            <button
              type="button"
              onClick={() => void flip()}
              disabled={!supported || starting || !canFlip || countdown !== null}
              aria-label={`Switch to ${nextSide} camera`}
              className="flex flex-col items-center gap-1 w-16 py-2 rounded-xl hover:bg-white/10 disabled:opacity-30 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              <RefreshCw size={22} />
              <span className="text-[10px] text-white/80">Flip</span>
            </button>
          </>
        )}
      </div>

      {/* Native camera / gallery fallback */}
      <input ref={fileRef} type="file" accept="image/*" capture={facing} onChange={onNativeFile} className="hidden" />
    </div>
  );

  return ReactDOM.createPortal(content, document.body);
};

export default CameraCapture;
