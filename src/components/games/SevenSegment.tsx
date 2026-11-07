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

function Digit({ char, dot }: { char: string; dot: boolean }) {
  const lit = GLYPHS[char] ?? "";
  return (
    <svg viewBox="-1 -1 14 20" className="h-full w-auto" aria-hidden="true">
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
        <rect
          x={10.6}
          y={16.2}
          width={1.6}
          height={1.6}
          rx={0.8}
          fill={dot ? "var(--pf-led)" : "var(--pf-led-off)"}
          opacity={dot ? 1 : 0.6}
          className={dot ? "pf-glow" : undefined}
        />
      </g>
    </svg>
  );
}

/**
 * `value` is padded on the left with blanks to `width` digits. A "." lights the
 * decimal point of the digit before it and takes no place of its own, so "7.5"
 * fills two digits.
 */
export function SevenSegment({ value, width }: { value: string; width: number }) {
  const digits: { char: string; dot: boolean }[] = [];
  for (const char of value) {
    if (char === "." && digits.length > 0) digits[digits.length - 1].dot = true;
    else digits.push({ char, dot: false });
  }
  while (digits.length < width) digits.unshift({ char: " ", dot: false });
  return (
    <span className="flex h-full">
      {digits.slice(-width).map((d, i) => (
        <Digit key={i} char={d.char} dot={d.dot} />
      ))}
    </span>
  );
}
