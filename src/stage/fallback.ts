/**
 * The character shown when the model's builder fails twice: a friendly
 * rounded figure in the drawing's own colours. It is app code, so it always
 * builds, and it follows the same rig contract as a generated character, so
 * every action works on it.
 */
import * as THREE from "three";
import type { JointName } from "./protocol";
import type { Style } from "./protocol";

export function buildFallback(palette: string[], style: Style) {
  const colors = palette.length ? palette : ["#7cc6a0", "#f2c14e", "#2d3142"];
  const pick = (i: number) => new THREE.Color(colors[i % colors.length]);
  const mat = (c: THREE.Color) =>
    style === "realistic"
      ? new THREE.MeshStandardMaterial({ color: c, roughness: 0.55 })
      : new THREE.MeshToonMaterial({ color: c });
  const body = mat(pick(0));
  const accent = mat(pick(1));
  const dark = new THREE.MeshStandardMaterial({ color: 0x15181c, roughness: 0.4 });
  const white = new THREE.MeshBasicMaterial({ color: 0xffffff });

  const M = (g: THREE.BufferGeometry, m: THREE.Material, x = 0, y = 0, z = 0) => {
    const o = new THREE.Mesh(g, m);
    o.position.set(x, y, z);
    o.castShadow = o.receiveShadow = true;
    return o;
  };

  const root = new THREE.Group();
  const torso = M(new THREE.CapsuleGeometry(0.62, 0.7, 8, 24), body, 0, 1.55, 0);
  root.add(torso);
  const belly = M(new THREE.SphereGeometry(0.45, 24, 16), accent, 0, 1.45, 0.3);
  belly.scale.set(1, 1.1, 0.6);
  root.add(belly);

  const head = new THREE.Group();
  head.position.set(0, 2.45, 0);
  root.add(head);
  head.add(M(new THREE.SphereGeometry(0.72, 32, 24), body, 0, 0.62, 0));
  [-0.24, 0.24].forEach((x) => {
    const e = M(new THREE.SphereGeometry(0.1, 16, 12), dark, x, 0.72, 0.62);
    e.scale.set(1, 1.2, 0.5);
    head.add(e);
    head.add(M(new THREE.SphereGeometry(0.03, 8, 8), white, x + 0.03, 0.78, 0.67));
  });
  const smile = M(new THREE.TorusGeometry(0.18, 0.03, 8, 24, Math.PI), dark, 0, 0.5, 0.66);
  smile.rotation.z = Math.PI;
  head.add(smile);
  head.userData.face = { x: 0, y: 0.72, z: 0.7, width: 0.7 };

  const limb = (parent: THREE.Object3D, x: number, y: number, len: number, r: number, end: THREE.Material) => {
    const g = new THREE.Group();
    g.position.set(x, y, 0);
    parent.add(g);
    g.add(M(new THREE.CapsuleGeometry(r, len, 6, 12), body, 0, -len / 2 - r, 0));
    g.add(M(new THREE.SphereGeometry(r * 1.5, 16, 12), end, 0, -len - r * 1.6, 0.02));
    return g;
  };
  const armL = limb(root, -0.7, 2.05, 0.6, 0.12, accent);
  const armR = limb(root, 0.7, 2.05, 0.6, 0.12, accent);
  armL.rotation.z = -0.25;
  armR.rotation.z = 0.25;
  const legL = limb(root, -0.3, 0.75, 0.32, 0.17, accent);
  const legR = limb(root, 0.3, 0.75, 0.32, 0.17, accent);

  const joints: Partial<Record<JointName, THREE.Object3D>> = { head, armL, armR, legL, legR };
  return { root, joints };
}
