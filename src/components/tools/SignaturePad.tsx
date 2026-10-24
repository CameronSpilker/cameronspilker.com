"use client";

import { useCallback, useEffect, useRef } from "react";
import { drawStroke, INKS, type Ink, type Stroke } from "@/lib/pdf/ink";
import { pdfSignerTool as copy } from "@/content/tools";

/**
 * The drawing surface. The strokes belong to the parent, so switching tabs or
 * changing ink keeps what was drawn; this only paints them and adds to them.
 */
export function SignaturePad({
  strokes,
  ink,
  onChange,
  onAspect,
}: {
  strokes: Stroke[];
  ink: Ink;
  onChange: (strokes: Stroke[]) => void;
  /** Height over width, so the parent can redraw the strokes at another size. */
  onAspect: (aspect: number) => void;
}) {
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const current = useRef<Stroke | null>(null);
  /** The strokes as painted, including the one in progress. */
  const live = useRef(strokes);

  const paint = useCallback(() => {
    const el = canvas.current;
    const ctx = el?.getContext("2d");
    if (!el || !ctx) return;
    ctx.clearRect(0, 0, el.width, el.height);
    ctx.strokeStyle = INKS[ink];
    const width = Math.max(1.6, el.width * 0.0085);
    for (const stroke of live.current) drawStroke(ctx, stroke, el.width, width);
  }, [ink]);

  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    const size = () => {
      const rect = el.getBoundingClientRect();
      if (!rect.width) return;
      const dpr = window.devicePixelRatio || 1;
      el.width = Math.round(rect.width * dpr);
      el.height = Math.round(rect.height * dpr);
      onAspect(rect.height / rect.width);
      paint();
    };
    size();
    const observer = new ResizeObserver(size);
    observer.observe(el);
    return () => observer.disconnect();
  }, [paint, onAspect]);

  useEffect(() => {
    live.current = strokes;
    paint();
  }, [paint, strokes]);

  const point = (event: React.PointerEvent<HTMLCanvasElement>): [number, number] => {
    const rect = event.currentTarget.getBoundingClientRect();
    return [(event.clientX - rect.left) / rect.width, (event.clientY - rect.top) / rect.width];
  };

  return (
    <div className="relative overflow-hidden rounded-md border border-line bg-white">
      <canvas
        ref={canvas}
        aria-label={copy.signature.padLabel}
        className="block h-36 w-full cursor-crosshair touch-none"
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          current.current = [point(event)];
          live.current = [...live.current, current.current];
          paint();
        }}
        onPointerMove={(event) => {
          if (!current.current) return;
          const samples = event.nativeEvent.getCoalescedEvents?.() ?? [event.nativeEvent];
          const rect = event.currentTarget.getBoundingClientRect();
          for (const sample of samples) {
            current.current.push([
              (sample.clientX - rect.left) / rect.width,
              (sample.clientY - rect.top) / rect.width,
            ]);
          }
          paint();
        }}
        onPointerUp={() => {
          if (!current.current) return;
          current.current = null;
          onChange(live.current);
        }}
        onPointerCancel={() => {
          if (!current.current) return;
          current.current = null;
          onChange(live.current);
        }}
      />
      <div aria-hidden="true" className="pointer-events-none absolute right-3.5 bottom-8 left-3.5 border-b border-[#c3c9d3]" />
      <span aria-hidden="true" className="pointer-events-none absolute bottom-9 left-3.5 text-sm leading-none text-[#9aa2ae]">
        ×
      </span>
      {strokes.length === 0 && (
        <p className="pointer-events-none absolute inset-0 flex items-center justify-center pb-8 text-xs text-[#7d8693]">
          {copy.signature.padHint}
        </p>
      )}
    </div>
  );
}
