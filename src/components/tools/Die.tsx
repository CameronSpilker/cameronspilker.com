import { useLayoutEffect, useMemo, useRef } from "react";
import { edgeFor, inkFor } from "@/lib/dice/roll";
import {
  apply,
  cssMatrix,
  dot,
  facesOf,
  landing,
  toMat,
  toQuat,
  tumbleAt,
  type Mat,
  type Quat,
  type SolidKind,
  type Vec,
} from "@/lib/dice/solids";

/**
 * One die, built in CSS 3D: every face is a flat element with its number on
 * it, placed on the solid, so a tumbling die shows real numbers going past.
 *
 * The face that lands is decided before the throw starts. The throw itself
 * (where it comes from, how it spins, how far it twists on landing) uses
 * Math.random, because it changes nothing about the result.
 */

/** How big each solid is drawn, as its farthest vertex over the die's box. */
const RADIUS: Record<SolidKind, number> = {
  d4: 0.56,
  d6: 0.6,
  d8: 0.52,
  d10: 0.5,
  d12: 0.5,
  d20: 0.5,
  tens: 0.5,
  units: 0.5,
};

/** Light from the top left, a little in front. */
const LIGHT: Vec = (() => {
  const v: Vec = [-0.45, -0.6, 1];
  const n = Math.hypot(...v);
  return [v[0] / n, v[1] / n, v[2] / n];
})();

const STROKE = 2;

/** The face that shows before a die has ever been thrown: its highest number. */
function restingFace(kind: SolidKind): number {
  const faces = facesOf(kind);
  const want = kind === "tens" ? "00" : kind === "units" ? "0" : String(faces.length);
  return Math.max(0, faces.findIndex((f) => f.label === want));
}

const easeOut = (t: number) => 1 - (1 - t) ** 3;

export function Die({
  kind,
  label,
  colour,
  size,
  throwId,
  index,
  glow,
}: {
  kind: SolidKind;
  /** The face to show, or null for the resting face. */
  label: string | null;
  colour: string;
  /** The die's box, in pixels. */
  size: number;
  /** Bumped once per roll. A new value throws the die. */
  throwId: number;
  /** Its place on the table, for staggering the throw. */
  index: number;
  glow?: boolean;
}) {
  const faces = facesOf(kind);
  const r = size * RADIUS[kind];
  const ink = inkFor(colour);
  const edge = edgeFor(colour);

  const body = useRef<HTMLDivElement | null>(null);
  const shadow = useRef<HTMLDivElement | null>(null);
  const shades = useRef<(SVGPolygonElement | null)[]>([]);
  const orientation = useRef<Quat | null>(null);
  const lastThrow = useRef(throwId);

  const target = label === null ? restingFace(kind) : Math.max(0, faces.findIndex((f) => f.label === label));

  // Where each face sits on the solid, and how it is drawn. Fixed per shape and size.
  const drawn = useMemo(
    () =>
      faces.map((f) => {
        const outline = f.outline.map(([x, y]) => [x * r, y * r] as [number, number]);
        const hw = Math.max(...outline.map(([x]) => Math.abs(x))) + STROKE;
        const hh = Math.max(...outline.map(([, y]) => Math.abs(y))) + STROKE;
        const placed: Mat = [
          [f.right[0], -f.up[0], f.normal[0]],
          [f.right[1], -f.up[1], f.normal[1]],
          [f.right[2], -f.up[2], f.normal[2]],
        ];
        const c = f.centroid;
        return {
          label: f.label,
          hw,
          hh,
          points: outline.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(" "),
          transform: cssMatrix(placed, [c[0] * r, c[1] * r, c[2] * r]),
          font: f.inradius * r * (f.label.length >= 2 ? 0.95 : 1.15),
        };
      }),
    [faces, r],
  );

  useLayoutEffect(() => {
    const el = body.current;
    if (!el) return;

    const paint = (q: Quat, x: number, y: number, lift: number) => {
      const m = toMat(q);
      el.style.transform = `translate3d(${x.toFixed(2)}px, ${(y - lift).toFixed(2)}px, 0) ${cssMatrix(m)}`;
      faces.forEach((f, i) => {
        const n = apply(m, f.normal);
        const light = Math.max(0, dot(n, LIGHT));
        const shade = shades.current[i];
        if (shade) shade.style.opacity = String(Math.min(0.6, (1 - light) * 0.55).toFixed(3));
      });
      const s = shadow.current;
      if (s) {
        const k = Math.max(0.55, 1 - lift / size);
        s.style.transform = `translate(${x.toFixed(2)}px, 0) scale(${k.toFixed(3)})`;
        s.style.opacity = String((0.35 * k).toFixed(3));
      }
    };

    const twist = (Math.random() - 0.5) * 0.7;
    const to = toQuat(landing(faces[target], twist));
    const thrown = throwId !== lastThrow.current;
    lastThrow.current = throwId;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (!thrown || reduced || orientation.current === null) {
      orientation.current = to;
      paint(to, 0, 0, 0);
      return;
    }

    // A throw: in from a random side, a few bounces, a couple of turns.
    const from = orientation.current;
    const angle = Math.random() * Math.PI * 2;
    const reach = size * (0.9 + Math.random() * 0.8);
    const sx = Math.cos(angle) * reach;
    const sy = Math.sin(angle) * reach * 0.6;
    const axis: Vec = [Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5];
    const turns = 2 + Math.floor(Math.random() * 2);
    const bounces = 3;
    const duration = 950 + ((index * 53) % 5) * 60;
    const delay = ((index * 29) % 6) * 25;
    const start = performance.now() + delay;
    let frame = 0;

    const step = (now: number) => {
      const t = Math.min(1, Math.max(0, (now - start) / duration));
      const e = easeOut(t);
      const q = tumbleAt(from, to, axis, turns, e);
      const lift = Math.abs(Math.sin(Math.PI * bounces * e)) * (1 - e) * size * 0.55;
      paint(q, sx * (1 - e), sy * (1 - e), lift);
      orientation.current = q;
      if (t < 1) frame = requestAnimationFrame(step);
      else orientation.current = to;
    };
    paint(from, sx, sy, 0);
    frame = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(frame);
      orientation.current = to;
    };
    // The throw is keyed on throwId; the rest only reposition the die.
  }, [throwId, target, faces, size, index]);

  return (
    <div aria-hidden="true" className="relative shrink-0" style={{ width: size, height: size }}>
      {glow && (
        <div
          className="absolute inset-[-12%] rounded-full"
          style={{ background: "radial-gradient(closest-side, rgba(250,178,25,0.55), rgba(250,178,25,0))" }}
        />
      )}
      {/* Ground shadow, which shrinks as the die leaves the table. */}
      <div
        ref={shadow}
        className="absolute bottom-[2%] left-[15%] h-[14%] w-[70%] rounded-[50%]"
        style={{ background: "radial-gradient(closest-side, rgba(0,0,0,0.6), rgba(0,0,0,0))", opacity: 0.35 }}
      />
      <div className="absolute inset-0" style={{ perspective: `${size * 5}px` }}>
        <div ref={body} className="absolute top-1/2 left-1/2 h-0 w-0" style={{ transformStyle: "preserve-3d" }}>
          {drawn.map((f, i) => (
            <div
              key={i}
              className="absolute"
              style={{
                width: f.hw * 2,
                height: f.hh * 2,
                left: -f.hw,
                top: -f.hh,
                transform: f.transform,
                backfaceVisibility: "hidden",
                WebkitBackfaceVisibility: "hidden",
              }}
            >
              <svg width={f.hw * 2} height={f.hh * 2} viewBox={`${-f.hw} ${-f.hh} ${f.hw * 2} ${f.hh * 2}`} className="block overflow-visible">
                <polygon points={f.points} fill={colour} stroke={edge} strokeWidth={STROKE} strokeLinejoin="round" />
                <text
                  x={0}
                  y={0}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill={ink}
                  fontSize={f.font}
                  fontWeight={800}
                  className="font-mono"
                >
                  {f.label}
                </text>
                {/* 6 and 9 read the same upside down; real dice underline them. */}
                {(f.label === "6" || f.label === "9") && (
                  <rect x={-f.font * 0.26} y={f.font * 0.48} width={f.font * 0.52} height={Math.max(1.2, f.font * 0.08)} rx={0.6} fill={ink} />
                )}
                <polygon
                  ref={(node) => {
                    shades.current[i] = node;
                  }}
                  points={f.points}
                  fill="#000000"
                  stroke="#000000"
                  strokeWidth={STROKE}
                  strokeLinejoin="round"
                  opacity={0}
                />
              </svg>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
