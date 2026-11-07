/**
 * The shapes of the dice, and the rotations that land them.
 *
 * Coordinates are CSS's: x to the right, y down the screen, z toward the
 * viewer. Every solid is centred on the origin with its farthest vertex at
 * distance 1, and every face carries a frame (right, down, normal) so a flat
 * element drawn in that frame reads the right way round from outside.
 *
 * Kept free of the DOM so the geometry can be tested.
 */

export type Vec = [number, number, number];
/** A rotation, as a unit quaternion [w, x, y, z]. */
export type Quat = [number, number, number, number];

export type Face = {
  /** What is printed on it. */
  label: string;
  /** Outward unit normal. */
  normal: Vec;
  /** Unit vector along the face toward the top of the printed label. */
  up: Vec;
  /** Unit vector to the label's right: down × normal. */
  right: Vec;
  centroid: Vec;
  /** The outline in the face's own plane: x along `right`, y along `-up`. */
  outline: [number, number][];
  /** Distance from the centroid to the nearest edge, for sizing the label. */
  inradius: number;
};

/** The dice that can be drawn. A d100 is drawn as a tens d10 and a units d10. */
export type SolidKind = "d4" | "d6" | "d8" | "d10" | "d12" | "d20" | "tens" | "units";

const add = (a: Vec, b: Vec): Vec => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a: Vec, b: Vec): Vec => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const scale = (a: Vec, k: number): Vec => [a[0] * k, a[1] * k, a[2] * k];
export const dot = (a: Vec, b: Vec) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec, b: Vec): Vec => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const length = (a: Vec) => Math.sqrt(dot(a, a));
const unit = (a: Vec): Vec => scale(a, 1 / length(a));
const mean = (list: Vec[]): Vec => scale(list.reduce(add, [0, 0, 0]), 1 / list.length);

/** Order a face's vertices around its centre, so they draw as a polygon. */
function ring(points: Vec[]): Vec[] {
  const c = mean(points);
  const n = unit(c);
  const a = unit(sub(points[0], c));
  const b = cross(n, a);
  return [...points].sort((p, q) => {
    const dp = sub(p, c);
    const dq = sub(q, c);
    return Math.atan2(dot(dp, b), dot(dp, a)) - Math.atan2(dot(dq, b), dot(dq, a));
  });
}

const PHI = (1 + Math.sqrt(5)) / 2;

function icosahedron(): { vertices: Vec[]; faces: Vec[][] } {
  const v: Vec[] = [];
  for (const s of [-1, 1]) {
    for (const t of [-1, 1]) {
      v.push([0, s, t * PHI], [s, t * PHI, 0], [t * PHI, 0, s]);
    }
  }
  const edge = 2;
  const near = (a: Vec, b: Vec) => Math.abs(length(sub(a, b)) - edge) < 1e-9;
  const faces: Vec[][] = [];
  for (let i = 0; i < v.length; i++)
    for (let j = i + 1; j < v.length; j++)
      for (let k = j + 1; k < v.length; k++)
        if (near(v[i], v[j]) && near(v[j], v[k]) && near(v[i], v[k])) faces.push(ring([v[i], v[j], v[k]]));
  return { vertices: v, faces };
}

/** The raw faces of each shape, as vertex lists. Up is taken from the first vertex. */
function rawFaces(kind: SolidKind): { faces: Vec[][]; upFromEdge?: boolean } {
  switch (kind) {
    case "d4": {
      const v: Vec[] = [
        [1, 1, 1],
        [1, -1, -1],
        [-1, 1, -1],
        [-1, -1, 1],
      ];
      return { faces: [0, 1, 2, 3].map((skip) => ring(v.filter((_, i) => i !== skip))) };
    }
    case "d6": {
      const faces: Vec[][] = [];
      for (const axis of [0, 1, 2]) {
        for (const sign of [-1, 1]) {
          const pts: Vec[] = [];
          for (const a of [-1, 1])
            for (const b of [-1, 1]) {
              const p: Vec = [0, 0, 0];
              p[axis] = sign;
              p[(axis + 1) % 3] = a;
              p[(axis + 2) % 3] = b;
              pts.push(p);
            }
          faces.push(ring(pts));
        }
      }
      // A square's label sits parallel to an edge, not pointing at a corner.
      return { faces, upFromEdge: true };
    }
    case "d8": {
      const faces: Vec[][] = [];
      for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) faces.push(ring([[x, 0, 0], [0, y, 0], [0, 0, z]]));
      return { faces };
    }
    case "d20":
      return { faces: icosahedron().faces };
    case "d12": {
      // The dodecahedron is the icosahedron's dual: one pentagon per
      // icosahedron vertex, through the centres of the five faces around it.
      const ico = icosahedron();
      const faces = ico.vertices.map((vertex) =>
        ring(ico.faces.filter((f) => f.some((p) => length(sub(p, vertex)) < 1e-9)).map(mean)),
      );
      return { faces };
    }
    case "d10":
    case "tens":
    case "units": {
      // A pentagonal trapezohedron: two apexes and a zigzag ring of ten. The
      // apex height is the one that keeps each kite flat.
      const a = 0.1;
      const c = Math.cos(Math.PI / 5);
      const h = (a * (1 + c)) / (1 - c);
      const upper = (i: number): Vec => [Math.cos((2 * Math.PI * i) / 5), Math.sin((2 * Math.PI * i) / 5), -a];
      const lower = (i: number): Vec => [
        Math.cos((2 * Math.PI * i) / 5 + Math.PI / 5),
        Math.sin((2 * Math.PI * i) / 5 + Math.PI / 5),
        a,
      ];
      const top: Vec = [0, 0, -h];
      const bottom: Vec = [0, 0, h];
      const faces: Vec[][] = [];
      // Apex first, so labels point at the apex as they do on a real d10.
      for (let i = 0; i < 5; i++) faces.push([top, upper(i), lower(i), upper(i + 1)]);
      for (let i = 0; i < 5; i++) faces.push([bottom, lower(i), upper(i + 1), lower(i + 1)]);
      return { faces };
    }
  }
}

/** The face values, low to high, before they are placed. */
function labelsFor(kind: SolidKind): string[] {
  const n = { d4: 4, d6: 6, d8: 8, d10: 10, d12: 12, d20: 20, tens: 10, units: 10 }[kind];
  if (kind === "tens") return Array.from({ length: 10 }, (_, i) => (i * 10).toString().padStart(2, "0"));
  if (kind === "units") return Array.from({ length: 10 }, (_, i) => String(i));
  return Array.from({ length: n }, (_, i) => String(i + 1));
}

function buildFaces(kind: SolidKind): Face[] {
  const { faces: raw, upFromEdge } = rawFaces(kind);
  const radius = Math.max(...raw.flat().map(length));
  const faces = raw.map((pts) => {
    const points = pts.map((p) => scale(p, 1 / radius));
    const centroid = mean(points);
    let normal = unit(cross(sub(points[1], points[0]), sub(points[2], points[0])));
    if (dot(normal, centroid) < 0) normal = scale(normal, -1);
    const toward = upFromEdge ? scale(add(points[0], points[1]), 0.5) : points[0];
    const along = sub(toward, centroid);
    const up = unit(sub(along, scale(normal, dot(along, normal))));
    const down = scale(up, -1);
    const right = cross(down, normal);
    const outline = points.map((p): [number, number] => {
      const d = sub(p, centroid);
      return [dot(d, right), dot(d, down)];
    });
    let inradius = Infinity;
    for (let i = 0; i < outline.length; i++) {
      const [x1, y1] = outline[i];
      const [x2, y2] = outline[(i + 1) % outline.length];
      const len = Math.hypot(x2 - x1, y2 - y1);
      inradius = Math.min(inradius, Math.abs(x1 * y2 - x2 * y1) / len);
    }
    return { label: "", normal, up, right, centroid, outline, inradius };
  });

  // Number the faces the way real dice are: opposite faces add up to the same
  // total (7 on a d6, 21 on a d20). A d4 has no opposite faces.
  const values = labelsFor(kind);
  const opposite = (i: number) => faces.findIndex((f) => dot(f.normal, faces[i].normal) < -0.999);
  if (kind === "d4") {
    faces.forEach((f, i) => (f.label = values[i]));
  } else {
    let pair = 0;
    faces.forEach((f, i) => {
      if (f.label) return;
      const j = opposite(i);
      f.label = values[pair];
      faces[j].label = values[values.length - 1 - pair];
      pair++;
    });
  }
  return faces;
}

const cache = new Map<SolidKind, Face[]>();

export function facesOf(kind: SolidKind): Face[] {
  let faces = cache.get(kind);
  if (!faces) {
    faces = buildFaces(kind);
    cache.set(kind, faces);
  }
  return faces;
}

/** Which solid draws a die, and the labels that show a value on it. */
export function labelsForValue(sides: number, value: number): { kind: SolidKind; label: string }[] {
  if (sides === 100) {
    // Percentile: a tens die and a units die. 00 and 0 together read 100.
    const tens = Math.floor((value % 100) / 10) * 10;
    return [
      { kind: "tens", label: tens.toString().padStart(2, "0") },
      { kind: "units", label: String(value % 10) },
    ];
  }
  return [{ kind: `d${sides}` as SolidKind, label: String(value) }];
}

/** The solids a die of this many sides is drawn with. */
export function kindsFor(sides: number): SolidKind[] {
  return sides === 100 ? ["tens", "units"] : [`d${sides}` as SolidKind];
}

// Rotations. A 3 by 3 matrix is stored row by row, applied to column vectors.

export type Mat = [Vec, Vec, Vec];

export const apply = (m: Mat, v: Vec): Vec => [dot(m[0], v), dot(m[1], v), dot(m[2], v)];

export function multiply(a: Mat, b: Mat): Mat {
  const cols: Vec[] = [0, 1, 2].map((j) => [b[0][j], b[1][j], b[2][j]] as Vec);
  return a.map((row) => cols.map((col) => dot(row, col)) as Vec) as Mat;
}

export function rotationX(angle: number): Mat {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return [
    [1, 0, 0],
    [0, c, -s],
    [0, s, c],
  ];
}

export function rotationZ(angle: number): Mat {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return [
    [c, -s, 0],
    [s, c, 0],
    [0, 0, 1],
  ];
}

/** How far the resting die is tipped back, so a little of its sides shows. */
export const TILT = (-16 * Math.PI) / 180;

/**
 * The rotation that lands `face` toward the viewer, its label upright, then
 * turned by `twist` in the plane of the screen (dice never land square) and
 * tipped back by TILT.
 */
export function landing(face: Face, twist: number): Mat {
  // Rows are the face's frame, so the face's right goes to x, down to y and
  // normal to z.
  const frame: Mat = [face.right, scale(face.up, -1), face.normal];
  return multiply(rotationX(TILT), multiply(rotationZ(twist), frame));
}

export function toQuat(m: Mat): Quat {
  const [[m00, m01, m02], [m10, m11, m12], [m20, m21, m22]] = m;
  const trace = m00 + m11 + m22;
  let q: Quat;
  if (trace > 0) {
    const s = Math.sqrt(trace + 1) * 2;
    q = [0.25 * s, (m21 - m12) / s, (m02 - m20) / s, (m10 - m01) / s];
  } else if (m00 > m11 && m00 > m22) {
    const s = Math.sqrt(1 + m00 - m11 - m22) * 2;
    q = [(m21 - m12) / s, 0.25 * s, (m01 + m10) / s, (m02 + m20) / s];
  } else if (m11 > m22) {
    const s = Math.sqrt(1 + m11 - m00 - m22) * 2;
    q = [(m02 - m20) / s, (m01 + m10) / s, 0.25 * s, (m12 + m21) / s];
  } else {
    const s = Math.sqrt(1 + m22 - m00 - m11) * 2;
    q = [(m10 - m01) / s, (m02 + m20) / s, (m12 + m21) / s, 0.25 * s];
  }
  const n = Math.hypot(...q);
  return q.map((x) => x / n) as Quat;
}

export function toMat([w, x, y, z]: Quat): Mat {
  return [
    [1 - 2 * (y * y + z * z), 2 * (x * y - w * z), 2 * (x * z + w * y)],
    [2 * (x * y + w * z), 1 - 2 * (x * x + z * z), 2 * (y * z - w * x)],
    [2 * (x * z - w * y), 2 * (y * z + w * x), 1 - 2 * (x * x + y * y)],
  ];
}

export function quatMultiply(a: Quat, b: Quat): Quat {
  const [aw, ax, ay, az] = a;
  const [bw, bx, by, bz] = b;
  return [
    aw * bw - ax * bx - ay * by - az * bz,
    aw * bx + ax * bw + ay * bz - az * by,
    aw * by - ax * bz + ay * bw + az * bx,
    aw * bz + ax * by - ay * bx + az * bw,
  ];
}

export function axisAngle(axis: Vec, angle: number): Quat {
  const [x, y, z] = unit(axis);
  const s = Math.sin(angle / 2);
  return [Math.cos(angle / 2), x * s, y * s, z * s];
}

export function slerp(a: Quat, b: Quat, t: number): Quat {
  let cos = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
  let end = b;
  if (cos < 0) {
    cos = -cos;
    end = b.map((v) => -v) as Quat;
  }
  if (cos > 0.9995) {
    const q = a.map((v, i) => v + (end[i] - v) * t) as Quat;
    const n = Math.hypot(...q);
    return q.map((v) => v / n) as Quat;
  }
  const theta = Math.acos(cos);
  const sa = Math.sin((1 - t) * theta) / Math.sin(theta);
  const sb = Math.sin(t * theta) / Math.sin(theta);
  return a.map((v, i) => v * sa + end[i] * sb) as Quat;
}

/**
 * The die's rotation `e` of the way through a throw, for `e` in [0, 1].
 *
 * It slides from `from` to `to` while also spinning `turns` whole turns about
 * `axis`. Whole turns are no rotation at all, so the spin vanishes at both
 * ends: the throw starts exactly where the die lay and ends exactly on the
 * landing face.
 */
export function tumbleAt(from: Quat, to: Quat, axis: Vec, turns: number, e: number): Quat {
  return quatMultiply(axisAngle(axis, 2 * Math.PI * turns * (1 - e)), slerp(from, to, e));
}

/** A row-major rotation as CSS's column-major `matrix3d`, with a translation. */
export function cssMatrix(m: Mat, t: Vec = [0, 0, 0]): string {
  const f = (n: number) => (Math.abs(n) < 1e-10 ? 0 : Number(n.toFixed(6)));
  return `matrix3d(${[
    m[0][0], m[1][0], m[2][0], 0,
    m[0][1], m[1][1], m[2][1], 0,
    m[0][2], m[1][2], m[2][2], 0,
    t[0], t[1], t[2], 1,
  ]
    .map(f)
    .join(",")})`;
}
