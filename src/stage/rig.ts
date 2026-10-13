/**
 * What the action library knows about a character, measured once at load.
 *
 * The reference actions were tuned by hand for one tree: its arm angles, its
 * seat height on the bike, the height of its middle for a backflip. A shared
 * library cannot hardcode any of that, so it is measured here from the rig the
 * builder returned: every joint's rest rotation, the hip and shoulder heights,
 * where each hand ends, and where the face is for the sunglasses.
 *
 * Hierarchy: mover (moves along paths) > root (pose: hop, flip, scale) >
 * base (recentres the model so its feet sit on y = 0) > the builder's root.
 */
import * as THREE from "three";
import type { JointName } from "./protocol";

type Joints = Record<"head" | "armL" | "armR" | "legL" | "legR", THREE.Object3D> &
  Partial<Record<"tail" | "earL" | "earR" | "extra", THREE.Object3D>>;

export type Rig = {
  mover: THREE.Group;
  root: THREE.Group;
  j: Joints;
  rest: Map<THREE.Object3D, THREE.Euler>;
  /** Height of the character standing, in units. */
  H: number;
  /** Middle of the bounding box, the point a flip turns about. */
  cy: number;
  hipY: number;
  shoulderY: number;
  /** Hand positions in each arm's local frame. */
  handL: THREE.Vector3;
  handR: THREE.Vector3;
  armLength: number;
  /** Face anchor and head size in the head joint's local frame. */
  face: THREE.Vector3;
  faceWidth: number;
  headCenter: THREE.Vector3;
  headRadius: number;
  glow(k: number): void;
};

const _v = new THREE.Vector3();

/** Bounding box of `node`'s subtree in `frame`'s local coordinates, with `frame` at rest rotation zero. */
function localBox(node: THREE.Object3D, frame: THREE.Object3D) {
  const saved = frame.rotation.clone();
  frame.rotation.set(0, 0, 0);
  frame.updateMatrixWorld(true);
  const inv = frame.matrixWorld.clone().invert();
  const box = new THREE.Box3();
  node.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || !mesh.geometry) return;
    if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
    const gb = (o as THREE.InstancedMesh).isInstancedMesh
      ? ((o as THREE.InstancedMesh).computeBoundingBox(), (o as THREE.InstancedMesh).boundingBox!)
      : mesh.geometry.boundingBox!;
    const m = inv.clone().multiply(o.matrixWorld);
    box.union(gb.clone().applyMatrix4(m));
  });
  frame.rotation.copy(saved);
  frame.updateMatrixWorld(true);
  return box;
}

export function makeRig(model: THREE.Object3D, joints: Partial<Record<JointName, THREE.Object3D>>): Rig {
  const mover = new THREE.Group();
  const root = new THREE.Group();
  const base = new THREE.Group();
  mover.add(root);
  root.add(base);
  base.add(model);

  mover.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(model);
  const center = box.getCenter(new THREE.Vector3());
  base.position.set(-center.x, -box.min.y, -center.z);
  mover.updateMatrixWorld(true);

  const j = joints as Joints;
  const rest = new Map<THREE.Object3D, THREE.Euler>();
  for (const o of Object.values(j)) if (o) rest.set(o, o.rotation.clone());

  const yIn = (o: THREE.Object3D) => root.worldToLocal(o.getWorldPosition(_v)).y;
  const H = box.max.y - box.min.y;
  const hipY = (yIn(j.legL) + yIn(j.legR)) / 2;
  const shoulderY = (yIn(j.armL) + yIn(j.armR)) / 2;

  const hand = (arm: THREE.Object3D) => {
    const b = localBox(arm, arm);
    if (b.isEmpty()) return new THREE.Vector3(0, -0.8, 0);
    return new THREE.Vector3((b.min.x + b.max.x) / 2, b.min.y, (b.min.z + b.max.z) / 2);
  };
  const handL = hand(j.armL);
  const handR = hand(j.armR);
  const armLength = Math.max(0.3, (handL.length() + handR.length()) / 2);

  const headBox = localBox(j.head, j.head);
  const headCenter = headBox.isEmpty() ? new THREE.Vector3(0, 0.4, 0) : headBox.getCenter(new THREE.Vector3());
  const headSize = headBox.isEmpty() ? new THREE.Vector3(0.8, 0.8, 0.8) : headBox.getSize(new THREE.Vector3());
  const headRadius = Math.max(0.2, Math.max(headSize.x, headSize.z) / 2);

  // The builder can say where the face is; otherwise assume the front of the head.
  const hint = j.head.userData?.face as { x?: unknown; y?: unknown; z?: unknown; width?: unknown } | undefined;
  const num = (v: unknown, d: number) => (typeof v === "number" && Number.isFinite(v) ? v : d);
  const face = hint
    ? new THREE.Vector3(num(hint.x, headCenter.x), num(hint.y, headCenter.y), num(hint.z, headBox.max.z))
    : new THREE.Vector3(headCenter.x, headCenter.y + headSize.y * 0.08, headBox.max.z);
  const faceWidth = Math.min(3, Math.max(0.2, hint ? num(hint.width, headSize.x * 0.7) : headSize.x * 0.7));

  // Lightning and the capsule make the character glow. Keep each material's
  // own emissive so glowing eyes the builder made survive the effect.
  const lit: { m: THREE.MeshStandardMaterial; base: THREE.Color }[] = [];
  model.traverse((o) => {
    const mats = (o as THREE.Mesh).material;
    for (const m of Array.isArray(mats) ? mats : mats ? [mats] : []) {
      const e = (m as THREE.MeshStandardMaterial).emissive;
      if (e?.isColor && !lit.some((x) => x.m === m)) lit.push({ m: m as THREE.MeshStandardMaterial, base: e.clone() });
    }
  });
  const glow = (k: number) => {
    for (const { m, base } of lit) m.emissive.setRGB(base.r + k, base.g + k * 0.9, base.b + k * 0.25);
  };

  return {
    mover,
    root,
    j,
    rest,
    H,
    cy: H / 2,
    hipY,
    shoulderY,
    handL,
    handR,
    armLength,
    face,
    faceWidth,
    headCenter,
    headRadius,
    glow,
  };
}

/** Put every joint back to rest and clear the pose transforms. Called every frame before an action. */
export function resetPose(rig: Rig) {
  rig.mover.position.set(0, 0, 0);
  rig.mover.rotation.set(0, 0, 0);
  rig.root.position.set(0, 0, 0);
  rig.root.rotation.set(0, 0, 0);
  rig.root.scale.setScalar(1);
  for (const [o, e] of rig.rest) o.rotation.copy(e);
}
