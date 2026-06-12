import React, { useEffect, useRef } from 'react';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  alpha: number;
  color: string;
}

export const SpaceNebulaCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: -1000, y: -1000, active: false });
  const warpSpeedRef = useRef(1); // 1 = normal, increases on hyperdrive triggers
  const warpTargetRef = useRef(1);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    let particles: Particle[] = [];
    const particleCount = 75;

    const colors = [
      'rgba(168, 85, 247, 0.45)', // Purple
      'rgba(217, 70, 239, 0.45)', // Magenta
      'rgba(59, 130, 246, 0.45)',  // Blue
      'rgba(6, 182, 212, 0.45)',  // Cyan
    ];

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      initParticles();
    };

    const initParticles = () => {
      particles = [];
      for (let i = 0; i < particleCount; i++) {
        particles.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          vx: (Math.random() - 0.5) * 0.4,
          vy: (Math.random() - 0.5) * 0.4,
          radius: Math.random() * 2 + 0.5,
          alpha: Math.random() * 0.5 + 0.25,
          color: colors[Math.floor(Math.random() * colors.length)],
        });
      }
    };

    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current.x = e.clientX;
      mouseRef.current.y = e.clientY;
      mouseRef.current.active = true;
    };

    const handleMouseLeave = () => {
      mouseRef.current.x = -1000;
      mouseRef.current.y = -1000;
      mouseRef.current.active = false;
    };

    window.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseleave', handleMouseLeave);

    // Global listener for Hyperdrive effects
    const triggerWarp = () => {
      warpTargetRef.current = 15; // Speed up
      setTimeout(() => {
        warpTargetRef.current = 1; // Decelerate back to normal
      }, 750);
    };

    (window as any).triggerHyperdrive = triggerWarp;

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Smoothly interpolate warp speed multiplier
      warpSpeedRef.current += (warpTargetRef.current - warpSpeedRef.current) * 0.08;

      const isWarping = warpSpeedRef.current > 1.5;

      particles.forEach((p) => {
        // Move particles based on velocity and warp multiplier
        p.x += p.vx * warpSpeedRef.current;
        p.y += p.vy * warpSpeedRef.current;

        // Wrap around borders
        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;

        // Interaction with mouse pointer
        if (mouseRef.current.active && !isWarping) {
          const dx = mouseRef.current.x - p.x;
          const dy = mouseRef.current.y - p.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const limit = 180;
          if (dist < limit) {
            // Apply slight magnetic push
            const force = (limit - dist) / limit;
            p.x -= (dx / dist) * force * 0.6;
            p.y -= (dy / dist) * force * 0.6;
          }
        }

        // Draw particle
        ctx.beginPath();
        if (isWarping) {
          // Elongate particles into laser trails during warp speed
          const trailLength = warpSpeedRef.current * 1.5;
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x - p.vx * trailLength, p.y - p.vy * trailLength);
          ctx.strokeStyle = p.color;
          ctx.lineWidth = p.radius * 0.8;
          ctx.stroke();
        } else {
          ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
          ctx.fillStyle = p.color;
          ctx.globalAlpha = p.alpha;
          ctx.fill();
          ctx.globalAlpha = 1.0;
        }
      });

      // Draw subtle connective neon threads if close
      if (!isWarping) {
        for (let i = 0; i < particles.length; i++) {
          for (let j = i + 1; j < particles.length; j++) {
            const p1 = particles[i];
            const p2 = particles[j];
            const dx = p1.x - p2.x;
            const dy = p1.y - p2.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < 100) {
              const alpha = (100 - dist) / 100 * 0.08;
              ctx.beginPath();
              ctx.moveTo(p1.x, p1.y);
              ctx.lineTo(p2.x, p2.y);
              ctx.strokeStyle = `rgba(217, 70, 239, ${alpha})`;
              ctx.lineWidth = 0.5;
              ctx.stroke();
            }
          }
        }
      }

      animationId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      window.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseleave', handleMouseLeave);
      cancelAnimationFrame(animationId);
      delete (window as any).triggerHyperdrive;
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 1,
        pointerEvents: 'none',
      }}
    />
  );
};
