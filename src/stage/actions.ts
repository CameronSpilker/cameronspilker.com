/**
 * The shared action library: every action is a function of time on the rig.
 *
 * Ported from the Ace's Tree reference and made rig-agnostic. Each frame
 * starts from the rest pose (see `resetPose`), and every joint rotation an
 * action sets is blended from that joint's own rest angle by an envelope `k`
 * that is 0 at the start and the end. That is what returns any character to
 * the pose it was drawn in, whatever that pose was.
 *
 * Adding an action: add its key and label to `ACTIONS` in `protocol.ts`, then
 * add an entry here with a duration `d` and a frame function `f(t, dt)`. Use
 * `blend` for joint angles, scale anything size-dependent by `fit` or `rig.H`,
 * and keep `k` on everything so the action eases in and out.
 */
import * as THREE from "three";
import type { ActionKey } from "./protocol";
import type { Props } from "./props";
import type { Rig } from "./rig";

export type Action = { d: number; start?(): void; f(t: number, dt: number): void };

const PI = Math.PI;
const TAU = PI * 2;
const ez = (x: number) => x * x * (3 - 2 * x);
const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
/** Envelope: 0 at both ends of a duration d, 1 in the middle, ramps of length r. */
const env = (t: number, d: number, r = 0.5) => ez(clamp(Math.min(t / r, (d - t) / r)));
const mix = (a: number, b: number, k: number) => a + (b - a) * k;
const rnd = (a: number, b: number) => a + Math.random() * (b - a);

/** Height of a ball dropped from y0 after q seconds, bouncing to rest at radius r. */
function fall(y0: number, q: number, r = 0.24, e = 0.55) {
  const tt = Math.sqrt((2 * Math.max(0, y0 - r)) / 9.8);
  if (q < tt) return y0 - 4.9 * q * q;
  q -= tt;
  let v = 9.8 * tt * e;
  for (let i = 0; i < 6; i++) {
    const T = (2 * v) / 9.8;
    if (q < T) return r + v * q - 4.9 * q * q;
    q -= T;
    v *= e;
  }
  return r;
}

type Axis = "x" | "y" | "z";

export function makeActions(rig: Rig, P: Props, flash: THREE.PointLight, reducedMotion: boolean): Record<ActionKey, Action> {
  const { j, root, mover } = rig;
  const restOf = (o: THREE.Object3D, axis: Axis) => rig.rest.get(o)?.[axis] ?? 0;
  const blend = (o: THREE.Object3D | undefined, axis: Axis, target: number, k: number) => {
    if (o) o.rotation[axis] = mix(restOf(o, axis), target, k);
  };
  const add = (o: THREE.Object3D | undefined, axis: Axis, delta: number) => {
    if (o) o.rotation[axis] = restOf(o, axis) + delta;
  };
  /** Raise both arms outward from hanging, angles in radians, armL mirrored. */
  const arms = (zl: number, zr: number, k: number) => {
    blend(j.armL, "z", -zl, k);
    blend(j.armR, "z", zr, k);
  };
  const legs = (l: number, r: number, k: number) => {
    blend(j.legL, "x", l, k);
    blend(j.legR, "x", r, k);
  };
  const wag = (phase: number, amount: number, k: number) => add(j.tail, "y", Math.sin(phase) * amount * k);
  /** Scale that makes the character `target` units tall, never larger than it is. */
  const fit = (target: number) => Math.min(1, target / rig.H);

  function flip(c: number, cy: number) {
    const ang = -ez(c) * TAU;
    root.rotation.x = ang;
    root.position.y += cy - cy * Math.cos(ang);
    root.position.z = -cy * Math.sin(ang);
  }
  function circle(k: number, a: number, R: number) {
    mover.position.set(Math.sin(a) * R * k, 0, (Math.cos(a) - 1) * R * k);
    mover.rotation.y = (PI / 2 + a) * k;
  }
  /** Shrink to s and lift so the hips sit at seatY, z forward offset. */
  function sit(k: number, s: number, seatY: number, z: number) {
    root.scale.setScalar(mix(1, s, k));
    root.position.set(0, (seatY - rig.hipY * s) * k, z * k);
  }

  const handL = new THREE.Vector3();
  const handR = new THREE.Vector3();
  function hands() {
    mover.updateMatrixWorld(true);
    j.armL.localToWorld(handL.copy(rig.handL));
    j.armR.localToWorld(handR.copy(rig.handR));
  }
  const between = (out: THREE.Vector3) => out.copy(handL).add(handR).multiplyScalar(0.5);

  function drive(t: number, d: number, veh: THREE.Object3D, wheels: (THREE.Group & { spin: THREE.Group })[], R: number, sp: number, seatY: number) {
    const k = env(t, d, 0.7);
    const a = t * sp;
    veh.visible = k > 0.01;
    veh.scale.setScalar(Math.max(0.01, k));
    circle(k, a, R);
    sit(k, fit(2.0), seatY, -0.45);
    blend(j.armL, "x", -1.0, k);
    blend(j.armR, "x", -1.0, k);
    blend(j.armL, "z", -0.15, k);
    blend(j.armR, "z", 0.15, k);
    legs(-1.45, -1.45, k);
    wheels[0].rotation.y = wheels[1].rotation.y = 0.32 * k;
    wheels.forEach((w) => (w.spin.rotation.x = (a * R) / 0.38));
  }

  const bolt = { i: 0, ev: [0.9, 1.6, 2.1, 2.9, 3.4, 3.9, 4.7, 5.3] };
  const shot = { p0: new THREE.Vector3(), held: false };
  const dunkState = { p0: new THREE.Vector3(), held: false };
  const throwState = { p0: new THREE.Vector3(), held: false };
  const tmp = new THREE.Vector3();

  return {
    wave: {
      d: 3.4,
      f(t) {
        const k = env(t, 3.4, 0.4);
        blend(j.armL, "z", -(2.5 + Math.sin(t * 9) * 0.38), k);
        blend(j.armR, "z", 0.5, k);
        add(j.head, "z", Math.sin(t * 3) * 0.05 * k);
        add(j.earL, "z", Math.sin(t * 6) * 0.08 * k);
      },
    },
    dance: {
      d: 6,
      f(t) {
        const k = env(t, 6, 0.4);
        const b = t * 6;
        root.position.y = Math.abs(Math.sin(b)) * 0.2 * k;
        root.rotation.y = Math.sin(b * 0.5) * 0.5 * k;
        root.rotation.z = Math.sin(b) * 0.1 * k;
        arms(1.7 + Math.sin(b) * 0.9, 1.7 + Math.sin(b + PI) * 0.9, k);
        legs(Math.sin(b) * 0.35, -Math.sin(b) * 0.35, k);
        add(j.head, "z", Math.sin(b) * 0.15 * k);
        wag(b * 2, 0.6, k);
      },
    },
    disco: {
      d: 8,
      f(t) {
        const k = env(t, 8, 0.5);
        const b = t * TAU * 2;
        const s2 = Math.sin(b / 2);
        const bounce = Math.abs(s2);
        P.shades.visible = P.phones.visible = true;
        mover.position.x = Math.sin(b / 8) * 0.8 * k;
        root.position.y = bounce * 0.28 * k;
        root.rotation.y = Math.sin(b / 4) * 0.6 * k;
        root.rotation.z = s2 * 0.1 * k;
        add(j.head, "x", Math.sin(b) * 0.12 * k);
        add(j.head, "z", Math.sin(b / 2) * 0.12 * k);
        arms(1.6 + (1 + s2) * 0.6, 1.6 + (1 - s2) * 0.6, k);
        blend(j.armL, "x", Math.cos(b / 2) * 0.5, k);
        blend(j.armR, "x", -Math.cos(b / 2) * 0.5, k);
        legs(s2 * 0.4, -s2 * 0.4, k);
        wag(b, 0.5, k);
        P.accent.emissiveIntensity = 0.6 + bounce * 1.8;
        flash.color.setHSL((t * 0.35) % 1, 0.9, 0.6);
        flash.position.set(0, 6, 3);
        flash.intensity = (3 + 4 * bounce) * Math.PI * (reducedMotion ? 0.3 : 1);
        const H = rig.H;
        P.notes.forEach((n, i) => {
          const ph = (t * 0.5 + i / 6) % 1;
          const a = i * 1.3 + t * 0.5;
          n.visible = true;
          n.position.set(Math.cos(a) * (1.6 + ph * 0.8), H * 0.6 + ph * H * 0.8, Math.sin(a) * (1.3 + ph * 0.6));
          n.material.opacity = Math.sin(ph * PI);
        });
      },
    },
    backflip: {
      d: 1.9,
      f(t) {
        const p = t / 1.9;
        const c = clamp((p - 0.15) / 0.7);
        const s = Math.sin(c * PI);
        const k = env(t, 1.9, 0.2);
        const crouch = p < 0.15 ? Math.sin((p / 0.15) * (PI / 2)) * 0.25 : p > 0.85 ? Math.cos(clamp((p - 0.85) / 0.15) * (PI / 2)) * 0.25 : 0;
        root.position.y = s * 2.8 - crouch;
        flip(c, rig.cy);
        arms(1.4 + s * 1.2, 1.4 + s * 1.2, k);
        legs(s * 0.5, s * 0.5, k);
      },
    },
    jump: {
      d: 1.5,
      f(t) {
        const p = t / 1.5;
        const c = clamp((p - 0.2) / 0.65);
        const s = Math.sin(c * PI);
        const k = env(t, 1.5, 0.2);
        const sq = p < 0.2 ? Math.sin((p / 0.2) * (PI / 2)) * 0.15 : p > 0.85 ? Math.cos(clamp((p - 0.85) / 0.15) * (PI / 2)) * 0.15 : 0;
        root.position.y = s * 2.6;
        root.scale.set(1 + sq * 0.3, 1 - sq * 0.5 + s * 0.06, 1 + sq * 0.3);
        arms(2.2 + s * 0.5, 2.2 + s * 0.5, k);
        legs(-s * 0.4, -s * 0.4, k);
      },
    },
    fly: {
      d: 7,
      f(t) {
        const k = env(t, 7, 1.2);
        const a = t * 0.9;
        mover.position.set(Math.sin(a) * 2.4 * k, 0, (Math.cos(a) - 1) * 2.4 * k);
        mover.rotation.y = Math.atan2(Math.cos(a), -Math.sin(a)) * k;
        root.position.y = k * (3.0 + Math.sin(t * 3) * 0.25);
        root.rotation.x = 0.4 * k;
        const fl = Math.sin(t * 12) * 0.45 * k;
        arms(1.5 + fl, 1.5 + fl, k);
        legs(-0.45, -0.45, k);
        add(j.head, "x", -0.2 * k);
        wag(t * 5, 0.4, k);
        add(j.earL, "z", Math.sin(t * 8) * 0.1 * k);
        add(j.earR, "z", -Math.sin(t * 8) * 0.1 * k);
      },
    },
    circles: {
      d: 6.5,
      f(t) {
        const k = env(t, 6.5, 0.7);
        const s = t * 12;
        circle(k, t * 1.8, 3.0);
        root.position.y = Math.abs(Math.sin(s)) * 0.15 * k;
        root.rotation.x = 0.16 * k;
        blend(j.armL, "x", Math.sin(s) * 0.9, k);
        blend(j.armR, "x", -Math.sin(s) * 0.9, k);
        arms(0.3, 0.3, k);
        legs(Math.sin(s) * 0.8, -Math.sin(s) * 0.8, k);
        wag(s, 0.3, k);
      },
    },
    lightning: {
      d: 6.5,
      start() {
        bolt.i = 0;
      },
      f(t) {
        const k = env(t, 6.5, 0.5);
        arms(2.7, 2.7, k);
        add(j.head, "x", -0.2 * k);
        if (!reducedMotion) root.position.y = Math.sin(t * 20) * 0.03 * k;
        while (bolt.i < bolt.ev.length && t >= bolt.ev[bolt.i]) {
          bolt.i++;
          const r = 2.8 + Math.random() * 4;
          const a = Math.random() * TAU;
          const strength = reducedMotion ? 0.25 : 1;
          P.spawnBolt(Math.cos(a) * r, Math.sin(a) * r, strength);
          if (bolt.i % 3 === 0) P.spawnBolt(rnd(-1.5, 1.5), rnd(1.8, 3.2), strength);
        }
        rig.glow(Math.min(0.6, flash.intensity / (22 * Math.PI)));
      },
    },
    ball: {
      d: 6.5,
      f(t) {
        const p = t / 6.5;
        const T = new THREE.Vector3(2.4, 0.55, 1.6);
        const cap = P.capsule;
        cap.visible = true;
        cap.scale.setScalar(1);
        if (p < 0.2) {
          const c = p / 0.2;
          cap.position.set(5 * (1 - c) + T.x * c, 4 * (1 - c) * (1 - c) + T.y + Math.sin(c * PI) * 1.4, 3.5 * (1 - c) + T.z * c);
          cap.rotation.set(c * 9, 0, 0);
        } else if (p < 0.4) {
          const c = ez((p - 0.2) / 0.2);
          cap.position.copy(T);
          cap.rotation.set(0, 0, 0);
          mover.position.set(T.x * c, 0, T.z * c);
          root.scale.setScalar(Math.max(0.001, 1 - c));
          root.position.y = c * 0.6;
          rig.glow(c * 0.5);
        } else if (p < 0.8) {
          const c = (p - 0.4) / 0.4;
          cap.position.copy(T);
          mover.position.copy(T).setY(0);
          root.scale.setScalar(0.001);
          cap.rotation.set(0, 0, reducedMotion ? 0 : Math.sin(c * PI * 6) * 0.35 * (c < 0.85 ? 1 : 0));
        } else {
          const c = (p - 0.8) / 0.2;
          cap.position.copy(T);
          cap.rotation.set(0, 0, 0);
          root.scale.setScalar(Math.max(0.001, ez(c) + Math.sin(c * PI) * 0.12));
          mover.position.set(T.x * (1 - ez(c)), 0, T.z * (1 - ez(c)));
          rig.glow((1 - c) * 0.5);
          cap.scale.setScalar(Math.max(0.01, 1 - c));
          if (c > 0.99) cap.visible = false;
        }
      },
    },
    bike: {
      d: 9,
      f(t) {
        const k = env(t, 9, 0.7);
        const ped = t * 9;
        P.bike.visible = k > 0.01;
        P.bike.scale.setScalar(Math.max(0.01, k));
        circle(k, t * 0.95, 3.6);
        sit(k, fit(2.3), 0.82, -0.35);
        blend(j.armL, "x", -1.0, k);
        blend(j.armR, "x", -1.0, k);
        arms(0.15, 0.15, k);
        legs(Math.sin(ped) * 0.8, Math.sin(ped + PI) * 0.8, k);
        P.bikeWheels.forEach((w) => (w.rotation.x = ped * 1.4));
        wag(ped, 0.3, k);
      },
    },
    scooter: {
      d: 8,
      f(t) {
        const k = env(t, 8, 0.7);
        const a = t * 0.8;
        const c = t * 5;
        P.scooter.visible = k > 0.01;
        P.scooter.scale.setScalar(Math.max(0.01, k));
        circle(k, a, 3.4);
        root.scale.setScalar(mix(1, fit(2.3), k));
        root.position.set(0, 0.235 * k, -0.1 * k);
        blend(j.armL, "x", -1.3, k);
        blend(j.armR, "x", -1.3, k);
        arms(0.15, 0.15, k);
        const kick = Math.max(0, Math.sin(c));
        legs(0, 0.9 * kick - 0.15 * (1 - kick), k);
        P.scooterWheels.forEach((w) => (w.rotation.x = (a * 3.4) / 0.16));
      },
    },
    car: {
      d: 9,
      f(t) {
        P.car.visible = true;
        drive(t, 9, P.car, P.carWheels, 3.8, 0.9, 0.66);
      },
    },
    tesla: {
      d: 9,
      f(t) {
        P.tesla.visible = true;
        drive(t, 9, P.tesla, P.teslaWheels, 4.2, 1.15, 0.6);
      },
    },
    tramp: {
      d: 7,
      f(t) {
        const S = fit(3.0);
        const D = [1.0, 1.0, 1.1, 1.3];
        const Hs = [1.4, 2.2, 3.0, 3.8];
        const T0 = 0.5;
        const k = env(t, 7, 0.3);
        P.tramp.visible = true;
        let y = 0.8;
        let c = 0;
        let air = 0;
        if (t < T0) y = 0.8 - 0.04 * Math.sin((t / T0) * PI);
        else {
          let st = T0;
          let i = 0;
          while (i < 4 && t > st + D[i]) {
            st += D[i];
            i++;
          }
          if (i < 4) {
            const u = (t - st) / D[i];
            air = Math.sin(u * PI);
            y = 0.8 + Hs[i] * 4 * u * (1 - u);
            c = Math.exp(-Math.pow(Math.min(u, 1 - u) / 0.09, 2)) * 0.3;
            if (i === 3) {
              P.trampMat.scale.y = -(0.02 + c);
              root.scale.setScalar(S);
              root.position.y = y - c;
              flip(clamp((u - 0.1) / 0.8), rig.cy * S);
              arms(2.3, 2.3, k);
              return;
            }
          } else {
            const u = (t - st) / (7 - st);
            y = 0.8 + 0.3 * Math.exp(-u * 3) * Math.abs(Math.sin(u * 10));
            c = 0.12 * Math.exp(-u * 2) * (1 - Math.abs(Math.sin(u * 10)));
          }
        }
        P.trampMat.scale.y = -(0.02 + c);
        root.scale.set(S * (1 + c * 0.3), S * (1 - c * 0.5), S * (1 + c * 0.3));
        root.position.y = y - c;
        arms(mix(0.3, 2.4, air), mix(0.3, 2.4, air), k);
        legs(-air * 0.3, -air * 0.3, k);
      },
    },
    shoot: {
      d: 6,
      start() {
        shot.held = false;
      },
      f(t) {
        const k = env(t, 6, 0.4);
        const tr = 2.3;
        P.hoop.visible = P.bball.visible = true;
        root.scale.setScalar(mix(1, fit(3.2), k));
        mover.position.x = 0.4 * k;
        mover.rotation.y = (PI / 2) * k;
        if (t < 1.4) {
          const bh = Math.abs(Math.sin((t * PI) / 0.42));
          blend(j.armR, "x", -0.3 - bh * 0.2, k);
          blend(j.armR, "z", 0.45, k);
          blend(j.armL, "z", -0.3, k);
          root.position.y = -0.02 * bh;
          hands();
          P.bball.position.set(handR.x, 0.24 + bh * Math.max(0.3, handR.y - 0.24), handR.z);
        } else {
          const g = clamp((t - 1.4) / 0.6);
          const jt = clamp((t - 2.0) / 0.7);
          const jh = Math.sin(jt * PI) * 1.0;
          root.position.y = jh - (t < 2 ? Math.sin(clamp((t - 1.4) / 0.3) * PI) * 0.1 : 0);
          const ar = t < tr ? -mix(0.3, 2.6, g) : -mix(2.6, 2.1, clamp((t - tr) / 0.3));
          blend(j.armL, "x", ar, k);
          blend(j.armR, "x", ar, k);
          blend(j.armL, "z", -0.25, k);
          blend(j.armR, "z", 0.25, k);
          legs(-jh * 0.15, -jh * 0.15, k);
          if (t < tr) {
            hands();
            between(P.bball.position);
            shot.p0.copy(P.bball.position);
            shot.held = true;
          } else {
            if (!shot.held) {
              hands();
              between(shot.p0);
              shot.held = true;
            }
            const u = (t - tr) / 0.95;
            if (u < 1) {
              P.bball.position.set(mix(shot.p0.x, 4.1, u), mix(shot.p0.y, 3.2, u) + 1.5 * Math.sin(u * PI), mix(shot.p0.z, 0, u));
            } else {
              const q = t - tr - 0.95;
              P.bball.position.set(4.1 + Math.min(q, 1.6) * 0.35, fall(3.2, q), Math.min(q, 1.6) * 0.12);
              P.net.scale.y = 1 + 0.25 * Math.exp(-q * 5) * Math.sin(q * 30);
            }
          }
        }
        P.bball.rotation.x = t * 6;
      },
    },
    dunk: {
      d: 5.8,
      start() {
        dunkState.held = false;
      },
      f(t) {
        const k = env(t, 5.8, 0.4);
        const S = fit(3.2);
        P.hoop.visible = P.bball.visible = true;
        root.scale.setScalar(mix(1, S, k));
        mover.rotation.y = (PI / 2) * k;
        mover.position.x = (-2.4 + 5.6 * ez(clamp(t / 3.1))) * k;
        const reach = (rig.shoulderY + rig.armLength) * S;
        const peak = clamp(3.45 - reach, 0.6, 2.6);
        const jt = clamp((t - 2.1) / 1.4);
        root.position.y = peak * Math.sin(jt * PI);
        const run = t < 2.1;
        const sw = t * 11;
        legs(run ? Math.sin(sw) * 0.8 : -0.7, run ? -Math.sin(sw) * 0.8 : 0.35, k);
        const up = clamp((t - 1.9) / 0.5);
        const tr = 2.85;
        const ax = t > tr ? -mix(2.8, 1.2, clamp((t - tr) / 0.5)) : -mix(1.0, 2.8, up);
        blend(j.armL, "x", ax, k);
        blend(j.armR, "x", ax, k);
        blend(j.armL, "z", -0.2, k);
        blend(j.armR, "z", 0.2, k);
        if (t <= tr) {
          hands();
          between(P.bball.position).x += 0.1;
          dunkState.p0.copy(P.bball.position);
          dunkState.held = true;
        } else {
          if (!dunkState.held) {
            hands();
            between(dunkState.p0);
            dunkState.held = true;
          }
          const q = t - tr;
          if (q < 0.15) P.bball.position.lerpVectors(dunkState.p0, tmp.set(4.1, 3.35, 0), q / 0.15);
          else {
            const qq = q - 0.15;
            P.bball.position.set(4.1 + Math.max(0, qq - 0.8) * 0.4, fall(3.35, qq), 0);
            P.net.scale.y = 1 + 0.3 * Math.exp(-qq * 4) * Math.sin(qq * 28);
            P.rim.position.y = 3.2 + 0.02 * Math.exp(-qq * 5) * Math.sin(qq * 40);
          }
        }
        P.bball.rotation.x = t * 5;
      },
    },
    football: {
      d: 5.5,
      start() {
        throwState.held = false;
      },
      f(t) {
        const k = env(t, 5.5, 0.4);
        const tr = 1.95;
        P.football.visible = true;
        root.scale.setScalar(mix(1, fit(3.6), k));
        mover.position.x = -2.2 * k;
        mover.rotation.y = (PI / 2) * k;
        const wind = clamp((t - 1.2) / 0.5);
        const thr = clamp((t - 1.7) / 0.28);
        const ax = t < 1.2 ? -1.6 : t < 1.7 ? mix(-1.6, 1.6, wind) : mix(1.6, -2.7, ez(thr));
        blend(j.armR, "x", ax, k);
        blend(j.armR, "z", t < 1.2 ? 0.35 : mix(0.35, 1.5, wind) * (1 - thr * 0.6), k);
        blend(j.armL, "x", t < 1.2 ? -1.6 : mix(-1.6, -0.4, wind), k);
        blend(j.armL, "z", -0.5, k);
        root.rotation.y = t > 1.2 ? mix(-0.4 * wind, 0.5, thr) * k : 0;
        root.position.y = Math.sin(thr * PI) * 0.05;
        const ball = P.football;
        if (t < tr) {
          hands();
          ball.position.copy(handR);
          ball.quaternion.setFromUnitVectors(tmp.set(0, 0, 1), new THREE.Vector3(1, 0.2, 0).normalize());
          P.footballSpin.rotation.z = 0;
          throwState.p0.copy(handR);
          throwState.held = true;
        } else {
          if (!throwState.held) {
            hands();
            throwState.p0.copy(handR);
            throwState.held = true;
          }
          const q = t - tr;
          const p0 = throwState.p0;
          const vx = 6.2;
          const vy = 5.0;
          const y = p0.y + vy * q - 4.9 * q * q;
          if (y > 0.17) {
            ball.position.set(p0.x + vx * q, y, p0.z);
            ball.quaternion.setFromUnitVectors(tmp.set(0, 0, 1), new THREE.Vector3(vx, vy - 9.8 * q, 0).normalize());
            P.footballSpin.rotation.z = q * 28;
          } else {
            const land = (vy + Math.sqrt(vy * vy + 19.6 * Math.max(0, p0.y - 0.17))) / 9.8;
            const qq = Math.max(0, q - land);
            ball.position.set(p0.x + vx * land + 0.9 * (1 - Math.exp(-qq * 2)), 0.17 + 0.45 * Math.exp(-qq * 3) * Math.abs(Math.sin(qq * 7)), p0.z);
            ball.quaternion.setFromUnitVectors(tmp.set(0, 0, 1), new THREE.Vector3(1, 0, 0));
            P.footballSpin.rotation.z = 0;
          }
        }
      },
    },
  };
}

/** Breathing in place between actions. Off under reduced motion. */
export function idle(rig: Rig, t: number, reducedMotion: boolean) {
  if (reducedMotion) return;
  const b = Math.sin(t * 1.6);
  const { j } = rig;
  const rest = (o: THREE.Object3D) => rig.rest.get(o);
  const r = rest(j.head);
  if (r) j.head.rotation.z = r.z + b * 0.03;
  rig.root.rotation.z = b * 0.008;
  const al = rest(j.armL);
  const ar = rest(j.armR);
  if (al) j.armL.rotation.z = al.z - Math.sin(t * 2.2) * 0.05;
  if (ar) j.armR.rotation.z = ar.z + Math.sin(t * 1.9) * 0.05;
  if (j.tail) {
    const rt = rest(j.tail);
    if (rt) j.tail.rotation.y = rt.y + Math.sin(t * 2.2) * 0.15;
  }
}
