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

const easeOut = (t: number) => 1 - (1 - t) ** 3;

export function Die({
  kind,
  label,
  colour,
  size,
  throwId,
  index,
  heading,
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
  /**
   * The side this roll comes in from, in radians, shared by every die in the
   * throw so they travel together instead of crossing.
   */
  heading: number;
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
          font: f.inradius * r * FONT[kind][f.label.length >= 2 ? 1 : 0],
        };
      }),
    [faces, r, kind],
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
        // Faces toward the light stay nearly their true colour; faces turned
        // away darken faster, which is what makes the solid read as one.
        if (shade) shade.style.opacity = ((1 - light) ** 1.5 * 0.6).toFixed(3);
      });
      const s = shadow.current;
      if (s) {
        const k = Math.max(0.55, 1 - lift / size);
        s.style.transform = `translate(${x.toFixed(2)}px, 0) scale(${k.toFixed(3)})`;
        s.style.opacity = String((0.35 * k).toFixed(3));
      }
    };

    const twist = (Math.random() - 0.5) * 0.42;
    const to = toQuat(landing(faces[target], twist));
    const thrown = throwId !== lastThrow.current;
    lastThrow.current = throwId;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (!thrown || reduced || orientation.current === null) {
      orientation.current = to;
      paint(to, 0, 0, 0);
      return;
    }

    // A throw: the whole handful comes in from one side, rolling forward the
    // way it travels, bouncing a few times before it settles.
    const from = orientation.current;
    const angle = heading + (Math.random() - 0.5) * 0.12;
    const reach = size * (1.15 + Math.random() * 0.12);
    const sx = Math.cos(angle) * reach;
    const sy = Math.sin(angle) * reach * 0.5;
    // Rolling toward (-sx, -sy) on the table turns about the axis across that
    // path. Whole turns that unwind to zero spin it forward, hence the sign.
    const len = Math.hypot(sx, sy) || 1;
    const axis: Vec = [sy / len, -sx / len, (Math.random() - 0.5) * 0.5];
    const turns = 2;
    const bounces = 3;
    const duration = 1000 + ((index * 53) % 3) * 30;
    const delay = ((index * 29) % 4) * 15;
    const start = performance.now() + delay;
    let frame = 0;

    const step = (now: number) => {
      const t = Math.min(1, Math.max(0, (now - start) / duration));
      const e = easeOut(t);
      const q = tumbleAt(from, to, axis, turns, e);
      const lift = Math.abs(Math.sin(Math.PI * bounces * e)) * (1 - e) * size * 0.42;
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
  }, [throwId, target, faces, size, index, heading]);

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
                  className="font-sans"
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
