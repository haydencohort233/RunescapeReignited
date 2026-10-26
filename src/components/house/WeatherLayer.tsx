import { useEffect, useRef } from "react";
import type { WeatherKind } from "./weather";

// Weather over the yard, drawn on one canvas (decided Oct 26, after CSS
// particles kept fast monitors' GPUs busy): at most 30 frames a second,
// at 1x pixel density, paused while the tab is hidden or the scene is off
// screen, and off entirely with reduced motion (index.css hides it).

const FPS = 30;
const COUNTS: Record<WeatherKind, number> = { rain: 70, snow: 55, leaves: 14, petals: 18, heat: 0 };
const LEAF_COLOURS = ["#c46a2b", "#d9a03a", "#a5481f"];
const PETAL_COLOURS = ["#f6b8d1", "#ffffff", "#f3d27a"];

interface Bit {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  spin: number;
  angle: number;
  colour: string;
}

function spawn(kind: WeatherKind, w: number, h: number, anywhere: boolean): Bit {
  const r = Math.random;
  const y = anywhere ? r() * h : -10;
  switch (kind) {
    case "rain":
      return { x: r() * w * 1.2, y, vx: -w * 0.08, vy: h * (1.2 + r() * 0.6), size: 8 + r() * 8, spin: 0, angle: 0, colour: "#cfe6ff" };
    case "snow":
      return { x: r() * w, y, vx: (r() - 0.5) * w * 0.03, vy: h * (0.08 + r() * 0.08), size: 1.5 + r() * 2.5, spin: r() * 2, angle: r() * 6, colour: "#ffffff" };
    default: {
      const colours = kind === "leaves" ? LEAF_COLOURS : PETAL_COLOURS;
      return { x: r() * w, y, vx: w * (0.02 + r() * 0.04), vy: h * (0.06 + r() * 0.06), size: 4 + r() * 3, spin: (r() - 0.5) * 4, angle: r() * 6, colour: colours[Math.floor(r() * colours.length)] };
    }
  }
}

export function WeatherLayer({ kind }: { kind: WeatherKind }) {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || kind === "heat") return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let w = 0;
    let h = 0;
    let bits: Bit[] = [];
    const resize = () => {
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = Math.max(1, Math.round(w));
      canvas.height = Math.max(1, Math.round(h));
      bits = Array.from({ length: COUNTS[kind] }, () => spawn(kind, w, h, true));
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    let visible = true;
    const io = new IntersectionObserver(([entry]) => (visible = entry.isIntersecting));
    io.observe(canvas);

    let frame = 0;
    let last = 0;
    const step = (now: number) => {
      frame = requestAnimationFrame(step);
      if (!visible || document.hidden || now - last < 1000 / FPS) return;
      const dt = last ? Math.min(0.1, (now - last) / 1000) : 1 / FPS;
      last = now;
      ctx.clearRect(0, 0, w, h);
      for (let i = 0; i < bits.length; i++) {
        const b = bits[i];
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        b.angle += b.spin * dt;
        if (kind === "snow" || kind === "leaves" || kind === "petals") b.x += Math.sin(b.angle) * 0.3;
        if (b.y > h + 12 || b.x < -20 || b.x > w + 20) bits[i] = spawn(kind, w, h, false);
        if (kind === "rain") {
          ctx.strokeStyle = "rgba(207, 230, 255, 0.55)";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(b.x, b.y);
          ctx.lineTo(b.x + (b.vx / b.vy) * b.size, b.y + b.size);
          ctx.stroke();
        } else if (kind === "snow") {
          ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
          ctx.beginPath();
          ctx.arc(b.x, b.y, b.size, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.save();
          ctx.translate(b.x, b.y);
          ctx.rotate(b.angle);
          ctx.fillStyle = b.colour;
          ctx.beginPath();
          ctx.ellipse(0, 0, b.size, b.size * 0.55, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }
    };
    frame = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
      io.disconnect();
    };
  }, [kind]);

  if (kind === "heat") return <div className="house-weather is-heat" aria-hidden="true" />;
  return <canvas ref={ref} className="house-weather" aria-hidden="true" />;
}
