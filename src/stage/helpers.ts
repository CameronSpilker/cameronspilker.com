/**
 * The `helpers` object a generated builder receives, alongside THREE.
 *
 * These run inside the builder worker, so they draw on OffscreenCanvas rather
 * than on a DOM canvas, and they mark anything the stage has to finish (leaf
 * sway, which needs a shader hook that does not survive serialisation) in
 * `userData` rather than doing it here.
 *
 * Adding a helper means adding it here and describing it in
 * `src/lib/character/prompt.ts`, which is the only documentation the model sees.
 */
import * as THREE from "three";

type Vec = [number, number, number];

export type LeafSpec = {
  /** Centre of the ellipsoid the leaves are scattered in. */
  c: Vec;
  /** Radii of that ellipsoid. */
  r: Vec;
  /** Number of leaves. */
  n: number;
  /** Size multiplier. */
  s?: number;
  /** Extra upward tilt of the leaf normals. */
  up?: number;
};

export type LeafOptions = {
  texture?: THREE.Texture;
  /** HSL ranges for per-leaf colour, each [min, max] in 0..1. */
  hue?: [number, number];
  sat?: [number, number];
  light?: [number, number];
  /** Leaf plane size in units, width and height. */
  size?: [number, number];
  /** Sway amplitude, applied by the stage. 0 turns it off. */
  sway?: number;
};

/** A small deterministic generator, so a retry of the same code draws the same character. */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeHelpers(seed = 7) {
  const random = mulberry32(seed);
  const rnd = (a = 0, b = 1) => a + random() * (b - a);
  const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
  const UP = V3(0, 1, 0);

  function mesh(geometry: THREE.BufferGeometry, material: THREE.Material, x = 0, y = 0, z = 0) {
    const m = new THREE.Mesh(geometry, material);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
  }

  /** A tapered tube through `points`, radius r0 at the start and r1 at the end. */
  function tube(points: Vec[], r0: number, r1: number, material: THREE.Material, ts = 20, rs = 10) {
    const curve = new THREE.CatmullRomCurve3(points.map((p) => V3(...p)));
    const g = new THREE.TubeGeometry(curve, ts, 1, rs, false);
    const pos = g.attributes.position;
    const v = new THREE.Vector3();
    for (let i = 0; i <= ts; i++) {
      const c = curve.getPointAt(i / ts);
      const r = r0 + (r1 - r0) * (i / ts);
      for (let j = 0; j <= rs; j++) {
        const k = i * (rs + 1) + j;
        v.fromBufferAttribute(pos, k).sub(c).multiplyScalar(r).add(c);
        pos.setXYZ(k, v.x, v.y, v.z);
      }
    }
    g.computeVertexNormals();
    return mesh(g, material);
  }

  /** A cylinder from a to b, added to parent. */
  function bar(parent: THREE.Object3D, a: Vec, b: Vec, radius: number, material: THREE.Material) {
    const A = V3(...a);
    const B = V3(...b);
    const d = B.clone().sub(A);
    const c = mesh(new THREE.CylinderGeometry(radius, radius, d.length(), 10), material);
    c.position.copy(A.clone().add(B).multiplyScalar(0.5));
    c.quaternion.setFromUnitVectors(UP, d.normalize());
    parent.add(c);
    return c;
  }

  /** A procedural texture. `draw` gets a 2D context exactly like a canvas one. */
  function canvasTex(
    width: number,
    height: number,
    draw: (g: OffscreenCanvasRenderingContext2D, w: number, h: number) => void,
    opts: { srgb?: boolean } = {},
  ) {
    const w = Math.max(1, Math.min(1024, Math.round(width)));
    const h = Math.max(1, Math.min(1024, Math.round(height)));
    const canvas = new OffscreenCanvas(w, h);
    const g = canvas.getContext("2d");
    if (!g) throw new Error("2D canvas unavailable");
    draw(g, w, h);
    const t = new THREE.CanvasTexture(canvas as unknown as HTMLCanvasElement);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 8;
    if (opts.srgb !== false) t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  let defaultLeaf: THREE.Texture | undefined;
  function leafTexture() {
    defaultLeaf ??= canvasTex(128, 192, (g, w, h) => {
      g.clearRect(0, 0, w, h);
      const gr = g.createLinearGradient(0, h, 0, 0);
      gr.addColorStop(0, "#9fc96a");
      gr.addColorStop(1, "#d7f0a6");
      g.fillStyle = gr;
      g.beginPath();
      g.moveTo(w / 2, h - 4);
      g.bezierCurveTo(w * 1.05, h * 0.78, w * 0.95, h * 0.25, w / 2, 3);
      g.bezierCurveTo(w * 0.05, h * 0.25, -w * 0.05, h * 0.78, w / 2, h - 4);
      g.fill();
      g.strokeStyle = "rgba(60,95,30,.55)";
      g.lineWidth = 2.5;
      g.beginPath();
      g.moveTo(w / 2, h - 4);
      g.lineTo(w / 2, 10);
      g.stroke();
    });
    return defaultLeaf;
  }

  /**
   * Many small textured cards scattered through ellipsoids, as one instanced
   * mesh: foliage, fur tufts, feathers, scales. Every instance counts toward
   * the instance limit.
   */
  function leafMass(parent: THREE.Object3D, specs: LeafSpec[], opts: LeafOptions = {}) {
    const [lw, lh] = opts.size ?? [0.36, 0.54];
    const geometry = new THREE.PlaneGeometry(lw, lh).translate(0, lh / 2, 0);
    const material = new THREE.MeshStandardMaterial({
      map: opts.texture ?? leafTexture(),
      alphaTest: 0.5,
      side: THREE.DoubleSide,
      roughness: 0.65,
    });
    material.userData.sway = opts.sway ?? 0.06;
    const total = specs.reduce((a, s) => a + Math.max(0, Math.floor(s.n)), 0);
    const im = new THREE.InstancedMesh(geometry, material, Math.max(1, total));
    const d = new THREE.Object3D();
    const col = new THREE.Color();
    const [h0, h1] = opts.hue ?? [0.24, 0.31];
    const [s0, s1] = opts.sat ?? [0.45, 0.65];
    const [l0, l1] = opts.light ?? [0.36, 0.52];
    let k = 0;
    for (const s of specs) {
      for (let i = 0; i < Math.floor(s.n); i++) {
        const v = V3();
        do v.set(rnd(-1, 1), rnd(-1, 1), rnd(-1, 1));
        while (v.lengthSq() > 1 || v.lengthSq() < 0.01);
        const dir = v.clone().normalize();
        const rr = Math.cbrt(random()) * 0.55 + 0.45;
        d.position.set(s.c[0] + dir.x * s.r[0] * rr, s.c[1] + dir.y * s.r[1] * rr, s.c[2] + dir.z * s.r[2] * rr);
        const out = dir.clone();
        if (s.up) out.y += s.up;
        out.normalize();
        d.quaternion.setFromUnitVectors(UP, out);
        d.rotateY(random() * Math.PI * 2);
        d.rotateX(rnd(-0.5, 0.5));
        d.scale.setScalar((s.s ?? 1) * rnd(0.75, 1.25));
        d.updateMatrix();
        im.setMatrixAt(k, d.matrix);
        col.setHSL(rnd(h0, h1), rnd(s0, s1), rnd(l0, l1));
        im.setColorAt(k, col);
        k++;
      }
    }
    im.count = k;
    im.castShadow = true;
    im.receiveShadow = true;
    parent.add(im);
    return im;
  }

  /** An empty pivot at (x, y, z) in parent. Joints are made with this. */
  function pivot(parent: THREE.Object3D, x = 0, y = 0, z = 0) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    parent.add(g);
    return g;
  }

  return { rnd, V3, mesh, tube, bar, canvasTex, leafTexture, leafMass, pivot };
}

export type Helpers = ReturnType<typeof makeHelpers>;
