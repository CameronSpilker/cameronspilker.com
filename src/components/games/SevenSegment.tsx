/**
 * A seven segment LED readout. Unlit segments stay faintly visible, the way
 * they do on real hardware, so a "1" still reads as part of an "8".
 */

const SEGMENTS = {
  a: { x: 2, y: 0, w: 6, h: 2 },
  b: { x: 8, y: 2, w: 2, h: 6 },
  c: { x: 8, y: 10, w: 2, h: 6 },
  d: { x: 2, y: 16, w: 6, h: 2 },
  e: { x: 0, y: 10, w: 2, h: 6 },
  f: { x: 0, y: 2, w: 2, h: 6 },
  g: { x: 2, y: 8, w: 6, h: 2 },
} as const;

type Segment = keyof typeof SEGMENTS;

const GLYPHS: Record<string, string> = {
  "0": "abcdef",
  "1": "bc",
  "2": "abged",
  "3": "abgcd",
  "4": "fgbc",
  "5": "afgcd",
  "6": "afgedc",
  "7": "abc",
  "8": "abcdefg",
  "9": "abcdfg",
  "-": "g",
  " ": "",
};

function Digit({ char }: { char: string }) {
  const lit = GLYPHS[char] ?? "";
  return (
    <svg viewBox="-1 -1 12 20" className="h-full w-auto" aria-hidden="true">
      <g transform="skewX(-6) translate(1 0)">
        {(Object.keys(SEGMENTS) as Segment[]).map((key) => {
          const s = SEGMENTS[key];
          const on = lit.includes(key);
          return (
            <rect
              key={key}
              x={s.x + 0.25}
              y={s.y + 0.25}
              width={s.w - 0.5}
              height={s.h - 0.5}
              rx={0.7}
              fill={on ? "var(--pf-led)" : "var(--pf-led-off)"}
              opacity={on ? 1 : 0.6}
              className={on ? "pf-glow" : undefined}
            />
          );
        })}
      </g>
    </svg>
  );
}

/** `value` is padded on the left with blanks to `width` characters. */
export function SevenSegment({ value, width }: { value: string; width: number }) {
  const chars = value.padStart(width, " ").slice(-width).split("");
  return (
    <span className="flex h-full gap-[0.12em]">
      {chars.map((char, i) => (
        <Digit key={i} char={char} />
      ))}
    </span>
  );
}
