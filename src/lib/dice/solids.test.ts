/**
 * Run with `npm test`.
 *
 * The 3D dice make one promise: the face that lands toward you carries the
 * number that was rolled. These check the shapes are sound, the numbering is
 * a real die's, and every landing shows the face it was asked for.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  TILT,
  apply,
  axisAngle,
  dot,
  facesOf,
  kindsFor,
  labelsForValue,
  landing,
  rotationX,
  slerp,
  toMat,
  toQuat,
  tumbleAt,
  type Quat,
  type SolidKind,
  type Vec,
} from "./solids.ts";

const KINDS: SolidKind[] = ["d4", "d6", "d8", "d10", "d12", "d20", "tens", "units"];
const COUNT = { d4: 4, d6: 6, d8: 8, d10: 10, d12: 12, d20: 20, tens: 10, units: 10 };
const close = (a: number, b: number, eps = 1e-6) => Math.abs(a - b) < eps;
const closeVec = (a: Vec, b: Vec, eps = 1e-6) => a.every((x, i) => close(x, b[i], eps));

test("every solid has the right faces, flat and facing out", () => {
  for (const kind of KINDS) {
    const faces = facesOf(kind);
    assert.equal(faces.length, COUNT[kind], kind);
    for (const f of faces) {
      assert.ok(close(dot(f.normal, f.normal), 1), `${kind} normal is unit`);
      assert.ok(dot(f.normal, f.centroid) > 0, `${kind} normal points out`);
      assert.ok(close(dot(f.up, f.normal), 0) && close(dot(f.right, f.normal), 0), `${kind} frame lies in the face`);
      assert.ok(f.inradius > 0.05, `${kind} face has room for a label`);
      assert.ok(f.outline.length >= 3);
    }
  }
});

test("labels are a real die's, each used once", () => {
  const expected = (kind: SolidKind) => {
    if (kind === "tens") return ["00", "10", "20", "30", "40", "50", "60", "70", "80", "90"];
    if (kind === "units") return ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];
    return Array.from({ length: COUNT[kind] }, (_, i) => String(i + 1));
  };
  for (const kind of KINDS) {
    const labels = facesOf(kind).map((f) => f.label).sort();
    assert.deepEqual(labels, expected(kind).sort(), kind);
  }
});

test("opposite faces add up the way they do on real dice", () => {
  for (const kind of ["d6", "d8", "d10", "d12", "d20"] as const) {
    const faces = facesOf(kind);
    for (const f of faces) {
      const back = faces.find((g) => dot(g.normal, f.normal) < -0.999);
      assert.ok(back, `${kind} has an opposite face`);
      assert.equal(Number(f.label) + Number(back.label), COUNT[kind] + 1, kind);
    }
  }
});

test("every landing puts the asked for face toward the viewer, upright", () => {
  const tilt = rotationX(TILT);
  const front = apply(tilt, [0, 0, 1]);
  const upOnScreen = apply(tilt, [0, -1, 0]);
  for (const kind of KINDS) {
    const faces = facesOf(kind);
    for (const face of faces) {
      const m = landing(face, 0);
      assert.ok(closeVec(apply(m, face.normal), front), `${kind} ${face.label} faces front`);
      assert.ok(closeVec(apply(m, face.up), upOnScreen), `${kind} ${face.label} reads upright`);
      // And it is the face nearest the viewer, so it is the one you read.
      const best = faces.reduce((a, b) => (apply(m, b.normal)[2] > apply(m, a.normal)[2] ? b : a));
      assert.equal(best.label, face.label, `${kind} ${face.label} is the top face`);
    }
  }
});

test("the landed face stays on top with any twist", () => {
  for (const kind of KINDS) {
    const faces = facesOf(kind);
    for (const face of faces) {
      for (const twist of [-0.4, 0.2, 0.4]) {
        const m = landing(face, twist);
        const best = faces.reduce((a, b) => (apply(m, b.normal)[2] > apply(m, a.normal)[2] ? b : a));
        assert.equal(best.label, face.label);
      }
    }
  }
});

test("quaternions round trip and a throw ends where it should", () => {
  const face = facesOf("d20")[7];
  const m = landing(face, 0.3);
  const q = toQuat(m);
  const back = toMat(q);
  for (let i = 0; i < 3; i++) assert.ok(closeVec(back[i], m[i]), "matrix round trips");

  const from: Quat = toQuat(landing(facesOf("d20")[2], -0.2));
  for (const turns of [1, 2, 3]) {
    const start = toMat(tumbleAt(from, q, [0.3, 1, 0.2], turns, 0));
    const end = toMat(tumbleAt(from, q, [0.3, 1, 0.2], turns, 1));
    const fromM = toMat(from);
    for (let i = 0; i < 3; i++) {
      assert.ok(closeVec(start[i], fromM[i]), "starts where it lay");
      assert.ok(closeVec(end[i], m[i]), "ends on the landing");
    }
  }
  const half = slerp([1, 0, 0, 0], axisAngle([0, 0, 1], Math.PI / 2), 0.5);
  assert.ok(closeVec(apply(toMat(half), [1, 0, 0]), [Math.SQRT1_2, Math.SQRT1_2, 0]));
});

test("a d100 is a tens die and a units die", () => {
  assert.deepEqual(kindsFor(100), ["tens", "units"]);
  assert.deepEqual(kindsFor(20), ["d20"]);
  const read = (v: number) => labelsForValue(100, v).map((d) => d.label);
  assert.deepEqual(read(100), ["00", "0"]);
  assert.deepEqual(read(1), ["00", "1"]);
  assert.deepEqual(read(10), ["10", "0"]);
  assert.deepEqual(read(57), ["50", "7"]);
  assert.deepEqual(read(99), ["90", "9"]);
  // Every value maps back to itself, the way a table reads the pair.
  for (let v = 1; v <= 100; v++) {
    const [t, u] = read(v).map(Number);
    assert.equal(t + u === 0 ? 100 : t + u, v);
  }
  assert.deepEqual(labelsForValue(6, 4), [{ kind: "d6", label: "4" }]);
});
