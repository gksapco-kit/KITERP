import { useEffect, useRef } from "react";

interface ConfettiProps {
  /** How long the burst keeps launching new particles, in ms. */
  durationMs?: number;
  /** Number of particles per burst wave. */
  particleCount?: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  vr: number;
  size: number;
  color: string;
  shape: "rect" | "circle";
  life: number;
}

const COLORS = ["#22c55e", "#3b82f6", "#f59e0b", "#a855f7", "#ef4444", "#ec4899", "#14b8a6"];

/**
 * Lightweight, dependency-free confetti overlay.
 * Renders on a fixed, non-interactive canvas so it never blocks or obscures
 * the page content underneath. Auto-stops after `durationMs`.
 */
export function Confetti({ durationMs = 2500, particleCount = 90 }: ConfettiProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    if (prefersReducedMotion) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener("resize", handleResize);

    const particles: Particle[] = [];

    const spawn = (count: number) => {
      for (let i = 0; i < count; i++) {
        const fromLeft = Math.random() < 0.5;
        particles.push({
          x: fromLeft ? width * 0.15 : width * 0.85,
          y: height * 0.25,
          vx: (fromLeft ? 1 : -1) * (Math.random() * 6 + 2),
          vy: -(Math.random() * 9 + 6),
          rotation: Math.random() * Math.PI * 2,
          vr: (Math.random() - 0.5) * 0.4,
          size: Math.random() * 6 + 4,
          color: COLORS[Math.floor(Math.random() * COLORS.length)],
          shape: Math.random() < 0.5 ? "rect" : "circle",
          life: 1,
        });
      }
    };

    const start = performance.now();
    let lastSpawn = 0;
    let rafId = 0;

    const gravity = 0.28;
    const drag = 0.995;

    const tick = (now: number) => {
      const elapsed = now - start;
      if (elapsed < durationMs && now - lastSpawn > 200) {
        spawn(particleCount);
        lastSpawn = now;
      }

      ctx.clearRect(0, 0, width, height);

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.vy += gravity;
        p.vx *= drag;
        p.x += p.vx;
        p.y += p.vy;
        p.rotation += p.vr;
        p.life -= 0.008;

        if (p.life <= 0 || p.y > height + 20) {
          particles.splice(i, 1);
          continue;
        }

        ctx.save();
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.fillStyle = p.color;
        if (p.shape === "rect") {
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 1.6);
        } else {
          ctx.beginPath();
          ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

      if (elapsed < durationMs || particles.length > 0) {
        rafId = requestAnimationFrame(tick);
      } else {
        ctx.clearRect(0, 0, width, height);
      }
    };

    rafId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", handleResize);
    };
  }, [durationMs, particleCount]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{
        position: "fixed",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: 50,
      }}
    />
  );
}
