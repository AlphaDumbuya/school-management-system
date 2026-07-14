/**
 * AnimatedBackground3D Component
 * Premium 3D animated background for login page
 * Features: Particle system, 3D geometric shapes, parallax effect, dynamic lighting
 * Uses Canvas API for lightweight, performant 3D effects
 */

import React, { useEffect, useRef } from 'react';

interface Particle {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  radius: number;
  color: string;
  brightness: number;
  pulse: number;
}

interface FloatingShape {
  x: number;
  y: number;
  z: number;
  rotation: number;
  rotationX: number;
  rotationSpeed: number;
  rotationSpeedX: number;
  size: number;
  type: 'cube' | 'pyramid' | 'octahedron' | 'torus';
  color: string;
  glowIntensity: number;
}

export const AnimatedBackground3D: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particles = useRef<Particle[]>([]);
  const shapes = useRef<FloatingShape[]>([]);
  const animationFrameId = useRef<number>();
  const mousePos = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Initialize particles with enhanced properties - responsive particle count
    const initParticles = () => {
      particles.current = [];
      // Adjust particle count based on screen size for performance
      const isMobile = window.innerWidth < 768;
      const isTablet = window.innerWidth >= 768 && window.innerWidth < 1024;
      const particleCount = isMobile ? 80 : isTablet ? 150 : 200;
      
      const colors = [
        'rgba(59, 130, 246, 0.8)',   // Blue
        'rgba(99, 102, 241, 0.8)',   // Indigo
        'rgba(139, 92, 246, 0.8)',   // Purple
        'rgba(236, 72, 153, 0.8)',   // Pink
        'rgba(167, 139, 250, 0.8)',  // Light purple
        'rgba(56, 189, 248, 0.8)',   // Sky blue
      ];
      
      for (let i = 0; i < particleCount; i++) {
        particles.current.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          z: Math.random() * 1200,
          vx: (Math.random() - 0.5) * 0.3,
          vy: (Math.random() - 0.5) * 0.3,
          vz: (Math.random() - 0.5) * 1.5,
          radius: Math.random() * 2.5 + 0.5,
          color: colors[Math.floor(Math.random() * colors.length)],
          brightness: Math.random() * 0.5 + 0.5,
          pulse: Math.random() * Math.PI * 2,
        });
      }
    };

    // Initialize floating shapes with enhanced variety - responsive shape count
    const initShapes = () => {
      shapes.current = [];
      // Adjust shape count based on screen size for performance
      const isMobile = window.innerWidth < 768;
      const isTablet = window.innerWidth >= 768 && window.innerWidth < 1024;
      const shapeCount = isMobile ? 5 : isTablet ? 8 : 12;
      
      const types: Array<'cube' | 'pyramid' | 'octahedron' | 'torus'> = ['cube', 'pyramid', 'octahedron', 'torus'];
      const colors = [
        'rgba(59, 130, 246, 0.2)',   // Blue
        'rgba(99, 102, 241, 0.2)',   // Indigo
        'rgba(139, 92, 246, 0.2)',   // Purple
        'rgba(167, 139, 250, 0.25)', // Light purple
        'rgba(56, 189, 248, 0.2)',   // Sky blue
      ];
      
      for (let i = 0; i < shapeCount; i++) {
        // Smaller shapes on mobile devices
        const sizeMultiplier = isMobile ? 0.7 : isTablet ? 0.85 : 1;
        shapes.current.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          z: Math.random() * 600 + 400,
          rotation: Math.random() * Math.PI * 2,
          rotationX: Math.random() * Math.PI * 2,
          rotationSpeed: (Math.random() - 0.5) * 0.015,
          rotationSpeedX: (Math.random() - 0.5) * 0.012,
          size: (Math.random() * 120 + 60) * sizeMultiplier,
          type: types[Math.floor(Math.random() * types.length)],
          color: colors[Math.floor(Math.random() * colors.length)],
          glowIntensity: Math.random() * 0.5 + 0.5,
        });
      }
    };

    initParticles();
    initShapes();

    // Mouse move effect
    const handleMouseMove = (e: MouseEvent) => {
      mousePos.current = {
        x: (e.clientX / canvas.width - 0.5) * 100,
        y: (e.clientY / canvas.height - 0.5) * 100,
      };
    };
    window.addEventListener('mousemove', handleMouseMove);

    // Draw 3D wireframe cube
    const drawCube = (ctx: CanvasRenderingContext2D, x: number, y: number, size: number, rotation: number, color: string) => {
      const vertices = [
        [-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1],
        [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1],
      ];

      const edges = [
        [0, 1], [1, 2], [2, 3], [3, 0],
        [4, 5], [5, 6], [6, 7], [7, 4],
        [0, 4], [1, 5], [2, 6], [3, 7],
      ];

      const rotated = vertices.map(([vx, vy, vz]) => {
        // Rotate around Y axis
        const rx = vx * Math.cos(rotation) - vz * Math.sin(rotation);
        const rz = vx * Math.sin(rotation) + vz * Math.cos(rotation);
        // Rotate around X axis
        const ry = vy * Math.cos(rotation * 0.7) - rz * Math.sin(rotation * 0.7);
        const rz2 = vy * Math.sin(rotation * 0.7) + rz * Math.cos(rotation * 0.7);
        return [rx * size, ry * size, rz2 * size];
      });

      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';

      edges.forEach(([start, end]) => {
        const [x1, y1, z1] = rotated[start];
        const [x2, y2, z2] = rotated[end];
        
        // Simple perspective projection
        const scale1 = 500 / (500 + z1);
        const scale2 = 500 / (500 + z2);
        
        ctx.beginPath();
        ctx.moveTo(x + x1 * scale1, y + y1 * scale1);
        ctx.lineTo(x + x2 * scale2, y + y2 * scale2);
        ctx.stroke();
      });
    };

    // Draw 3D pyramid
    const drawPyramid = (ctx: CanvasRenderingContext2D, x: number, y: number, size: number, rotation: number, color: string) => {
      const vertices = [
        [0, -1, 0],
        [-1, 1, -1], [1, 1, -1], [1, 1, 1], [-1, 1, 1],
      ];

      const edges = [
        [0, 1], [0, 2], [0, 3], [0, 4],
        [1, 2], [2, 3], [3, 4], [4, 1],
      ];

      const rotated = vertices.map(([vx, vy, vz]) => {
        const rx = vx * Math.cos(rotation) - vz * Math.sin(rotation);
        const rz = vx * Math.sin(rotation) + vz * Math.cos(rotation);
        const ry = vy * Math.cos(rotation * 0.5) - rz * Math.sin(rotation * 0.5);
        const rz2 = vy * Math.sin(rotation * 0.5) + rz * Math.cos(rotation * 0.5);
        return [rx * size, ry * size, rz2 * size];
      });

      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';

      edges.forEach(([start, end]) => {
        const [x1, y1, z1] = rotated[start];
        const [x2, y2, z2] = rotated[end];
        
        const scale1 = 500 / (500 + z1);
        const scale2 = 500 / (500 + z2);
        
        ctx.beginPath();
        ctx.moveTo(x + x1 * scale1, y + y1 * scale1);
        ctx.lineTo(x + x2 * scale2, y + y2 * scale2);
        ctx.stroke();
      });
    };

    // Draw 3D octahedron
    const drawOctahedron = (ctx: CanvasRenderingContext2D, x: number, y: number, size: number, rotation: number, rotationX: number, color: string) => {
      const vertices = [
        [0, -1, 0], [0, 1, 0],
        [-1, 0, 0], [1, 0, 0],
        [0, 0, -1], [0, 0, 1],
      ];

      const edges = [
        [0, 2], [0, 3], [0, 4], [0, 5],
        [1, 2], [1, 3], [1, 4], [1, 5],
        [2, 4], [4, 3], [3, 5], [5, 2],
      ];

      const rotated = vertices.map(([vx, vy, vz]) => {
        // Y-axis rotation
        let rx = vx * Math.cos(rotation) - vz * Math.sin(rotation);
        let rz = vx * Math.sin(rotation) + vz * Math.cos(rotation);
        // X-axis rotation
        const ry = vy * Math.cos(rotationX) - rz * Math.sin(rotationX);
        rz = vy * Math.sin(rotationX) + rz * Math.cos(rotationX);
        return [rx * size, ry * size, rz * size];
      });

      ctx.strokeStyle = color;
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';

      edges.forEach(([start, end]) => {
        const [x1, y1, z1] = rotated[start];
        const [x2, y2, z2] = rotated[end];
        
        const scale1 = 500 / (500 + z1);
        const scale2 = 500 / (500 + z2);
        
        ctx.beginPath();
        ctx.moveTo(x + x1 * scale1, y + y1 * scale1);
        ctx.lineTo(x + x2 * scale2, y + y2 * scale2);
        ctx.stroke();
      });
    };

    // Draw 3D torus (simplified ring)
    const drawTorus = (ctx: CanvasRenderingContext2D, x: number, y: number, size: number, rotation: number, rotationX: number, color: string) => {
      const segments = 16;
      const vertices: number[][] = [];
      
      for (let i = 0; i < segments; i++) {
        const angle = (i / segments) * Math.PI * 2;
        vertices.push([Math.cos(angle), Math.sin(angle), 0]);
      }

      const rotated = vertices.map(([vx, vy, vz]) => {
        // Y-axis rotation
        let rx = vx * Math.cos(rotation) - vz * Math.sin(rotation);
        let rz = vx * Math.sin(rotation) + vz * Math.cos(rotation);
        // X-axis rotation
        const ry = vy * Math.cos(rotationX) - rz * Math.sin(rotationX);
        rz = vy * Math.sin(rotationX) + rz * Math.cos(rotationX);
        return [rx * size, ry * size, rz * size];
      });

      ctx.strokeStyle = color;
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';

      for (let i = 0; i < segments; i++) {
        const [x1, y1, z1] = rotated[i];
        const [x2, y2, z2] = rotated[(i + 1) % segments];
        
        const scale1 = 500 / (500 + z1);
        const scale2 = 500 / (500 + z2);
        
        ctx.beginPath();
        ctx.moveTo(x + x1 * scale1, y + y1 * scale1);
        ctx.lineTo(x + x2 * scale2, y + y2 * scale2);
        ctx.stroke();
      }
    };

    // Animation loop
    const animate = () => {
      ctx.fillStyle = 'rgba(30, 41, 59, 0.1)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Update and draw particles with enhanced effects
      particles.current.forEach((particle) => {
        // Update position with parallax effect
        particle.x += particle.vx + mousePos.current.x * 0.008;
        particle.y += particle.vy + mousePos.current.y * 0.008;
        particle.z += particle.vz;
        
        // Update pulse for breathing effect
        particle.pulse += 0.05;

        // Wrap around screen
        if (particle.x < 0) particle.x = canvas.width;
        if (particle.x > canvas.width) particle.x = 0;
        if (particle.y < 0) particle.y = canvas.height;
        if (particle.y > canvas.height) particle.y = 0;
        if (particle.z < 0) particle.z = 1200;
        if (particle.z > 1200) particle.z = 0;

        // Perspective projection
        const scale = 1200 / (1200 + particle.z);
        const projectedX = particle.x * scale + (1 - scale) * canvas.width / 2;
        const projectedY = particle.y * scale + (1 - scale) * canvas.height / 2;
        const pulseFactor = 1 + Math.sin(particle.pulse) * 0.3;
        const projectedRadius = particle.radius * scale * pulseFactor;

        // Draw particle with glow
        const brightness = particle.brightness * (1 + Math.sin(particle.pulse) * 0.2);
        const colorMatch = particle.color.match(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*[\d.]+\)/);
        if (colorMatch) {
          const [_, r, g, b] = colorMatch;
          
          // Outer glow
          const gradient = ctx.createRadialGradient(projectedX, projectedY, 0, projectedX, projectedY, projectedRadius * 3);
          gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${0.4 * brightness})`);
          gradient.addColorStop(0.5, `rgba(${r}, ${g}, ${b}, ${0.1 * brightness})`);
          gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
          ctx.fillStyle = gradient;
          ctx.beginPath();
          ctx.arc(projectedX, projectedY, projectedRadius * 3, 0, Math.PI * 2);
          ctx.fill();
          
          // Core particle
          ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${0.9 * brightness})`;
          ctx.beginPath();
          ctx.arc(projectedX, projectedY, projectedRadius, 0, Math.PI * 2);
          ctx.fill();
        }

        // Draw connections to nearby particles (skip on mobile for performance)
        const isMobile = window.innerWidth < 768;
        if (!isMobile) {
          particles.current.forEach((other) => {
            const dx = particle.x - other.x;
            const dy = particle.y - other.y;
            const dz = particle.z - other.z;
            const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

            if (distance < 150) {
              const otherScale = 1200 / (1200 + other.z);
              const otherX = other.x * otherScale + (1 - otherScale) * canvas.width / 2;
              const otherY = other.y * otherScale + (1 - otherScale) * canvas.height / 2;

              const opacity = (1 - distance / 150) * 0.3;
              ctx.strokeStyle = `rgba(99, 102, 241, ${opacity})`;
              ctx.lineWidth = 0.5;
              ctx.beginPath();
              ctx.moveTo(projectedX, projectedY);
              ctx.lineTo(otherX, otherY);
              ctx.stroke();
            }
          });
        }
      });

      // Update and draw floating shapes with enhanced animations
      shapes.current.forEach((shape) => {
        shape.rotation += shape.rotationSpeed;
        shape.rotationX += shape.rotationSpeedX;

        // Complex floating motion with sine waves
        shape.y += Math.sin(shape.rotation * 0.5) * 0.25 + Math.cos(shape.rotationX * 0.7) * 0.15;
        shape.x += Math.cos(shape.rotation * 0.3) * 0.2 + Math.sin(shape.rotationX * 0.4) * 0.1;

        // Apply parallax mouse influence
        const depth = shape.z / 1000;
        shape.x += mousePos.current.x * 0.03 * (1 - depth);
        shape.y += mousePos.current.y * 0.03 * (1 - depth);

        // Wrap around with buffer
        if (shape.x < -300) shape.x = canvas.width + 300;
        if (shape.x > canvas.width + 300) shape.x = -300;
        if (shape.y < -300) shape.y = canvas.height + 300;
        if (shape.y > canvas.height + 300) shape.y = -300;

        // Add glow effect to shapes (reduce on mobile for performance)
        const isMobile = window.innerWidth < 768;
        ctx.shadowBlur = isMobile ? 10 * shape.glowIntensity : 20 * shape.glowIntensity;
        ctx.shadowColor = shape.color.replace(/[\d.]+\)$/, '0.6)');

        // Draw shape based on type
        if (shape.type === 'cube') {
          drawCube(ctx, shape.x, shape.y, shape.size, shape.rotation, shape.color);
        } else if (shape.type === 'pyramid') {
          drawPyramid(ctx, shape.x, shape.y, shape.size, shape.rotation, shape.color);
        } else if (shape.type === 'octahedron') {
          drawOctahedron(ctx, shape.x, shape.y, shape.size, shape.rotation, shape.rotationX, shape.color);
        } else if (shape.type === 'torus') {
          drawTorus(ctx, shape.x, shape.y, shape.size, shape.rotation, shape.rotationX, shape.color);
        }

        // Reset shadow
        ctx.shadowBlur = 0;
      });

      animationFrameId.current = requestAnimationFrame(animate);
    };

    animate();

    // Cleanup
    return () => {
      window.removeEventListener('resize', resizeCanvas);
      window.removeEventListener('mousemove', handleMouseMove);
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full"
      style={{ background: 'linear-gradient(135deg, #1e293b 0%, #312e81 50%, #581c87 100%)' }}
    />
  );
};

export default AnimatedBackground3D;
