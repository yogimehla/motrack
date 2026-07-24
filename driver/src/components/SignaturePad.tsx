import { useEffect, useRef, useState } from 'react';

interface Props {
  onChange?: (svgPath: string) => void;
}

interface Stroke {
  points: { x: number; y: number }[];
}

/** Canvas signature pad that exports strokes as an SVG path string. */
export default function SignaturePad({ onChange }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const strokesRef = useRef<Stroke[]>([]);
  const drawingRef = useRef(false);
  const [hasInk, setHasInk] = useState(false);

  const redraw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#1e293b';
    for (const stroke of strokesRef.current) {
      if (stroke.points.length === 0) continue;
      ctx.beginPath();
      ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
      for (const p of stroke.points.slice(1)) ctx.lineTo(p.x, p.y);
      ctx.stroke();
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.scale(dpr, dpr);
    // normalize coordinate system: store points in CSS pixels
    canvas.dataset.cssWidth = String(rect.width);
    canvas.dataset.cssHeight = String(rect.height);
  }, []);

  const pos = (e: React.PointerEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const emitSvg = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const w = canvas.dataset.cssWidth || '300';
    const h = canvas.dataset.cssHeight || '160';
    const d = strokesRef.current
      .filter((s) => s.points.length > 0)
      .map(
        (s) =>
          `M ${s.points[0].x.toFixed(1)} ${s.points[0].y.toFixed(1)} ` +
          s.points.slice(1).map((p) => `L ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' '),
      )
      .join(' ');
    onChange?.(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}"><path d="${d}" fill="none" stroke="black" stroke-width="2.5"/></svg>`);
  };

  const start = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    drawingRef.current = true;
    strokesRef.current.push({ points: [pos(e)] });
    redraw();
  };
  const move = (e: React.PointerEvent) => {
    if (!drawingRef.current) return;
    strokesRef.current[strokesRef.current.length - 1].points.push(pos(e));
    setHasInk(true);
    redraw();
  };
  const end = () => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    emitSvg();
  };

  const clear = () => {
    strokesRef.current = [];
    setHasInk(false);
    redraw();
    onChange?.('');
  };

  return (
    <div>
      <div className="relative rounded-lg border border-slate-300 bg-white">
        <canvas
          ref={canvasRef}
          className="h-40 w-full touch-none rounded-lg"
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerCancel={end}
        />
        {!hasInk && (
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-slate-400">
            Sign here
          </span>
        )}
      </div>
      <button
        type="button"
        onClick={clear}
        className="mt-2 min-h-[44px] rounded-lg border border-slate-300 bg-white px-4 text-sm text-slate-600"
      >
        Clear signature
      </button>
    </div>
  );
}
