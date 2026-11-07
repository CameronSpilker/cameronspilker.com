import { useId, type CSSProperties } from "react";
import { edgeFor, inkFor, type DieSides } from "@/lib/dice/roll";

/**
 * One die, drawn flat in SVG: the silhouette a real one shows face on, a few
 * facet lines so it reads as a solid, and the face it landed on. A d6 shows
 * pips; the rest show numbers. With no `value` it shows its own name ("d20"),
 * which is how the table looks before the first roll.
 *
 * Everything is in a 100 by 100 box, so the caller sizes it with CSS.
 */

type Shape = {
  /** The outline, as an SVG path. */
  body: string;
  /** Facet lines inside the outline. */
  facets?: string;
  /** Where the number sits, and how big it may be. */
  cx: number;
  cy: number;
  font: number;
};

const pts = (list: [number, number][]) => `M ${list.map(([x, y]) => `${x} ${y}`).join(" L ")} Z`;
const lines = (list: [number, number, number, number][]) =>
  list.map(([x1, y1, x2, y2]) => `M ${x1} ${y1} L ${x2} ${y2}`).join(" ");

function polygon(n: number, r: number, cx: number, cy: number): [number, number][] {
  return Array.from({ length: n }, (_, i) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    return [Number((cx + r * Math.cos(a)).toFixed(2)), Number((cy + r * Math.sin(a)).toFixed(2))];
  });
}

const d12Outer = polygon(5, 47, 50, 53);
const d12Inner = polygon(5, 27, 50, 53);
const kite: [number, number][] = [
  [50, 3],
  [95, 46],
  [50, 97],
  [5, 46],
];
const kiteFacets = pts([
  [50, 3],
  [77, 58],
  [50, 72],
  [23, 58],
]) + " " + lines([
  [23, 58, 5, 46],
  [77, 58, 95, 46],
  [50, 72, 50, 97],
]);

const SHAPES: Record<DieSides, Shape> = {
  4: {
    body: pts([
      [50, 5],
      [96, 89],
      [4, 89],
    ]),
    cx: 50,
    cy: 64,
    font: 30,
  },
  6: { body: "M 24 6 H 76 Q 94 6 94 24 V 76 Q 94 94 76 94 H 24 Q 6 94 6 76 V 24 Q 6 6 24 6 Z", cx: 50, cy: 50, font: 44 },
  8: {
    body: pts([
      [50, 3],
      [96, 50],
      [50, 97],
      [4, 50],
    ]),
    facets: pts([
      [50, 3],
      [80, 66],
      [20, 66],
    ]) + " " + lines([
      [20, 66, 4, 50],
      [80, 66, 96, 50],
      [20, 66, 50, 97],
      [80, 66, 50, 97],
    ]),
    cx: 50,
    cy: 48,
    font: 28,
  },
  10: { body: pts(kite), facets: kiteFacets, cx: 50, cy: 47, font: 28 },
  12: {
    body: pts(d12Outer),
    facets:
      pts(d12Inner) +
      " " +
      lines(d12Inner.map(([x, y], i) => [x, y, d12Outer[i][0], d12Outer[i][1]] as [number, number, number, number])),
    cx: 50,
    cy: 54,
    font: 28,
  },
  20: {
    body: pts([
      [50, 3],
      [91, 26],
      [91, 74],
      [50, 97],
      [9, 74],
      [9, 26],
    ]),
    facets:
      pts([
        [50, 22],
        [78, 70],
        [22, 70],
      ]) +
      " " +
      lines([
        [50, 22, 50, 3],
        [50, 22, 9, 26],
        [50, 22, 91, 26],
        [78, 70, 91, 26],
        [78, 70, 91, 74],
        [78, 70, 50, 97],
        [22, 70, 9, 26],
        [22, 70, 9, 74],
        [22, 70, 50, 97],
      ]),
    cx: 50,
    cy: 55,
    font: 24,
  },
  100: { body: pts(kite), facets: kiteFacets, cx: 50, cy: 47, font: 28 },
};

/** Pip centres for each face of a d6, on a 100 box. */
const PIPS: Record<number, [number, number][]> = {
  1: [[50, 50]],
  2: [
    [30, 30],
    [70, 70],
  ],
  3: [
    [30, 30],
    [50, 50],
    [70, 70],
  ],
  4: [
    [30, 30],
    [70, 30],
    [30, 70],
    [70, 70],
  ],
  5: [
    [30, 30],
    [70, 30],
    [50, 50],
    [30, 70],
    [70, 70],
  ],
  6: [
    [30, 28],
    [70, 28],
    [30, 50],
    [70, 50],
    [30, 72],
    [70, 72],
  ],
};

export function Die({
  sides,
  colour,
  value,
  className,
  style,
  glow,
}: {
  sides: DieSides;
  colour: string;
  /** The face showing, or null before the first roll. */
  value: number | null;
  className?: string;
  style?: CSSProperties;
  /** A ring for a natural 20. */
  glow?: boolean;
}) {
  const shape = SHAPES[sides];
  const ink = inkFor(colour);
  const edge = edgeFor(colour);
  // useId can return characters that break url(#...) references; keep it plain.
  const sheen = `die-sheen-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;

  const label = value === null ? `d${sides}` : String(value);
  const scale = label.length >= 3 ? 0.78 : label.length === 2 && value === null ? 0.9 : 1;
  const font = shape.font * (value === null ? 0.82 : 1) * scale;

  return (
    <svg
      viewBox="0 0 100 100"
      aria-hidden="true"
      className={className}
      style={{
        ...style,
        filter: glow
          ? "drop-shadow(0 0 6px #fab219) drop-shadow(0 6px 10px rgba(0,0,0,0.25))"
          : "drop-shadow(0 6px 10px rgba(0,0,0,0.22))",
      }}
    >
      <defs>
        <linearGradient id={sheen} x1="0" y1="0" x2="0.8" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.38" />
          <stop offset="55%" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0.12" />
        </linearGradient>
      </defs>
      <path d={shape.body} fill={colour} />
      <path d={shape.body} fill={`url(#${sheen})`} />
      {shape.facets && (
        <path d={shape.facets} fill="none" stroke={edge} strokeOpacity="0.55" strokeWidth="1.6" strokeLinejoin="round" />
      )}
      <path d={shape.body} fill="none" stroke={edge} strokeWidth="3" strokeLinejoin="round" />
      {sides === 6 && value !== null && PIPS[value] ? (
        PIPS[value].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="8" fill={ink} />)
      ) : (
        <text
          x={shape.cx}
          y={shape.cy}
          textAnchor="middle"
          dominantBaseline="central"
          fill={ink}
          fontSize={font}
          fontWeight={800}
          className="font-mono"
        >
          {label}
        </text>
      )}
    </svg>
  );
}
