/**
 * Public report card verification — uses raw fetch (no auth token)
 * since the verify page is reached by scanning a QR code.
 */

export interface VerifyReportCardResponse {
  success: boolean;
  data: {
    verified: boolean;
    verified_at: string;
    school: {
      name?: string;
      short_name?: string;
      logo_url?: string;
      address?: string;
      motto?: string;
      phone?: string;
      email?: string;
      website?: string;
    };
    report_card: any;
  };
}

export async function verifyReportCard(
  hash: string,
  studentId: string,
  classId: string,
  academicYear: string,
): Promise<VerifyReportCardResponse> {
  const base = (import.meta as any).env?.VITE_API_URL || '';
  const params: Record<string, string> = { s: studentId, y: academicYear };
  if (classId) params.c = classId;
  const qs = new URLSearchParams(params);
  const res = await fetch(
    `${base}/api/v1/public/verify-report-card/${hash}?${qs}`,
    { headers: { 'Content-Type': 'application/json' } },
  );
  return res.json();
}
