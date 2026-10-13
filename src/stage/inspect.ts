/**
 * Checks a built character against the rig contract and the size limits.
 *
 * Run twice: in the worker, so a bad build fails fast with a message the model
 * can act on, and again in the stage on the deserialised scene, because the
 * worker ran untrusted code and its say-so is not evidence.
 */
import * as THREE from "three";
import { LIMITS, REQUIRED_JOINTS, OPTIONAL_JOINTS, type JointName } from "./protocol";

export const JOINT_TAG = "__joint";

export type Inspection =
  | { ok: true; triangles: number; instances: number; box: THREE.Box3 }
  | { ok: false; error: string };

export function countGeometry(root: THREE.Object3D) {
  let triangles = 0;
  let instances = 0;
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || !mesh.geometry) return;
    const g = mesh.geometry;
    const tris = g.index ? g.index.count / 3 : (g.attributes.position?.count ?? 0) / 3;
    const n = (o as THREE.InstancedMesh).isInstancedMesh ? (o as THREE.InstancedMesh).count : 1;
    if ((o as THREE.InstancedMesh).isInstancedMesh) instances += n;
    triangles += tris * n;
  });
  return { triangles: Math.round(triangles), instances };
}

/** Joints found by tag, for the stage side where the builder's object is gone. */
export function findJoints(root: THREE.Object3D) {
  const joints: Partial<Record<JointName, THREE.Object3D>> = {};
  root.traverse((o) => {
    const name = o.userData?.[JOINT_TAG];
    if (typeof name === "string" && !(name in joints)) joints[name as JointName] = o;
  });
  return joints;
}

export function inspect(root: THREE.Object3D, joints: Partial<Record<string, THREE.Object3D>>): Inspection {
  const missing = REQUIRED_JOINTS.filter((j) => !joints[j]);
  if (missing.length) return { ok: false, error: `Missing required joints: ${missing.join(", ")}.` };

  for (const name of [...REQUIRED_JOINTS, ...OPTIONAL_JOINTS]) {
    const j = joints[name];
    if (!j) continue;
    if (!(j as THREE.Object3D).isObject3D) return { ok: false, error: `joints.${name} is not a THREE.Object3D.` };
    let p: THREE.Object3D | null = j;
    while (p && p !== root) p = p.parent;
    if (!p) return { ok: false, error: `joints.${name} is not inside root. Add it to root or to a descendant of root.` };
  }

  const { triangles, instances } = countGeometry(root);
  if (triangles > LIMITS.maxTriangles)
    return { ok: false, error: `Too heavy: ${triangles} triangles, limit is ${LIMITS.maxTriangles}. Lower segment counts.` };
  if (instances > LIMITS.maxInstances)
    return { ok: false, error: `Too many instances: ${instances}, limit is ${LIMITS.maxInstances}.` };

  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  if (box.isEmpty()) return { ok: false, error: "The character has no visible geometry." };
  const size = box.getSize(new THREE.Vector3());
  if (!(size.y >= LIMITS.minHeight && size.y <= LIMITS.maxHeight))
    return {
      ok: false,
      error: `Bounding box height is ${size.y.toFixed(2)} units; it must be between ${LIMITS.minHeight} and ${LIMITS.maxHeight} (aim for about 4).`,
    };
  if (size.x > 12 || size.z > 12)
    return { ok: false, error: `Bounding box is ${size.x.toFixed(1)} by ${size.z.toFixed(1)} units wide; keep it within 12.` };

  return { ok: true, triangles, instances, box };
}
