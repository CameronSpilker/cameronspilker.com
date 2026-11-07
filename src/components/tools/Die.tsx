import { useLayoutEffect, useMemo, useRef } from "react";
import { edgeFor, inkFor } from "@/lib/dice/roll";
import {
  apply,
  cssMatrix,
  dot,
  facesOf,
  landing,
  quatMultiply,
  slerp,
  toMat,
  toQuat,
  type Mat,
  type Quat,
  type SolidKind,
  type Vec,
} from "@/lib/dice/solids";
import { DT, type Track } from "@/lib/dice/physics";

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
  d8: 0.54,
  d10: 0.52,
  d12: 0.52,
  d20: 0.55,
  tens: 0.52,
  units: 0.52,
};

/**
 * Label size as a multiple of the face's inradius, for one digit and for two.
 * Triangles and kites are narrow at the label, so they need more of it.
 */
const FONT: Record<SolidKind, [number, number]> = {
  d4: [1.45, 1.2],
  d6: [1.05, 0.85],
  d8: [1.45, 1.2],
  d10: [1.35, 1.1],
  d12: [1.0, 0.82],
  d20: [1.5, 1.22],
  tens: [1.35, 1.1],
  units: [1.35, 1.1],
};

/** Light mostly from in front, a little from the top left. */
const LIGHT: Vec = (() => {
  const v: Vec = [-0.3, -0.35, 1];
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

const conjugate = ([w, x, y, z]: Quat): Quat => [w, -x, -y, -z];
const IDENTITY: Quat = [1, 0, 0, 0];

export function Die({
  kind,
  label,
  colour,
  size,
  x,
  y,
  track,
  throwId,
  glow,
}: {
  kind: SolidKind;
  /** The face to show, or null for the resting face. */
  label: string | null;
  colour: string;
  /** The die's box, in pixels. */
  size: number;
  /** Where its centre rests on the table, in pixels from the tray's corner. */
  x: number;
  y: number;
  /** This die's part of the latest throw, from the table simulation. */
  track: Track | null;
  /** Bumped once per roll. A new value plays `track`. */
  throwId: number;
  glow?: boolean;
}) {
  const faces = facesOf(kind);
  const r = size * RADIUS[kind];
  const ink = inkFor(colour);
  const edge = edgeFor(colour);

  const place = useRef<HTMLDivElement | null>(null);
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
          font: f.inradius * r * FONT[kind][f.label.length >= 2 ? 1 : 0],
        };
      }),
    [faces, r, kind],
  );

  useLayoutEffect(() => {
    const el = body.current;
    const at = place.current;
    if (!el || !at) return;

    const paint = (q: Quat, px: number, py: number, lift: number) => {
      const m = toMat(q);
      at.style.transform = `translate(${(px - size / 2).toFixed(2)}px, ${(py - size / 2).toFixed(2)}px)`;
      el.style.transform = `translate3d(0, ${(-lift).toFixed(2)}px, 0) ${cssMatrix(m)}`;
      faces.forEach((f, i) => {
        const n = apply(m, f.normal);
        const light = Math.max(0, dot(n, LIGHT));
        const shade = shades.current[i];
        // Faces toward the light keep their true colour. Faces turned away
        // darken a little, enough to read as a solid, not so much that their
        // numbers sink.
        if (shade) shade.style.opacity = ((1 - light) ** 1.6 * 0.42).toFixed(3);
      });
      const s = shadow.current;
      if (s) {
        const k = Math.max(0.6, 1 - lift / size);
        s.style.transform = `scale(${k.toFixed(3)})`;
        s.style.opacity = (0.35 * k).toFixed(3);
      }
    };

    const twist = (Math.random() - 0.5) * 0.42;
    const to = toQuat(landing(faces[target], twist));
    const thrown = throwId !== lastThrow.current;
    lastThrow.current = throwId;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (!thrown || reduced || !track || orientation.current === null) {
      orientation.current = to;
      paint(to, x, y, 0);
      return;
    }

    // Play the simulated throw. The die rolls as the table says it moved,
    // and the turn that brings it onto its landing face is spread over the
    // distance it rolls, so it is complete exactly when the die stops.
    const from = orientation.current;
    const last = track.x.length - 1;
    const rolledAt = (f: number): Quat => [track.roll[f * 4], track.roll[f * 4 + 1], track.roll[f * 4 + 2], track.roll[f * 4 + 3]];
    const free = quatMultiply(rolledAt(last), from);
    const correction = quatMultiply(to, conjugate(free));
    const total = track.travelled[last];
    const start = performance.now();
    let frame = 0;

    const step = (now: number) => {
      const exact = Math.min(last, Math.max(0, (now - start) / 1000 / DT));
      const f = Math.floor(exact);
      const g = Math.min(last, f + 1);
      const k = exact - f;
      const px = track.x[f] + (track.x[g] - track.x[f]) * k;
      const py = track.y[f] + (track.y[g] - track.y[f]) * k;
      const lift = track.lift[f] + (track.lift[g] - track.lift[f]) * k;
      const w = total > 0 ? track.travelled[f] / total : f / last;
      const q = f >= last ? to : quatMultiply(slerp(IDENTITY, correction, w), quatMultiply(rolledAt(f), from));
      paint(q, px, py, lift);
      orientation.current = q;
      if (f < last) frame = requestAnimationFrame(step);
      else orientation.current = to;
    };
    step(start);
    return () => {
      cancelAnimationFrame(frame);
      orientation.current = to;
    };
    // A throw is keyed on throwId; the rest only reposition the die.
  }, [throwId, target, faces, size, x, y, track]);

  return (
    <div
      ref={place}
      aria-hidden="true"
      className="absolute top-0 left-0"
      style={{ width: size, height: size, transform: `translate(${x - size / 2}px, ${y - size / 2}px)` }}
    >
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
                {/* Shading sits under the number, so a face turned away still reads. */}
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
                <text
                  x={0}
                  y={0}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill={ink}
                  fontSize={f.font}
                  fontWeight={800}
                  stroke={ink === "#ffffff" ? "rgba(0,0,0,0.35)" : "rgba(255,255,255,0.35)"}
                  strokeWidth={Math.max(0.8, f.font * 0.06)}
                  paintOrder="stroke"
                  className="font-sans"
                >
                  {f.label}
                </text>
                {/* 6 and 9 read the same upside down; real dice underline them. */}
                {(f.label === "6" || f.label === "9") && (
                  <rect x={-f.font * 0.26} y={f.font * 0.48} width={f.font * 0.52} height={Math.max(1.2, f.font * 0.08)} rx={0.6} fill={ink} />
                )}
              </svg>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
