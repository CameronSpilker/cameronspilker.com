/**
 * Props the actions borrow: vehicles, trampoline, hoop, balls, the capsule,
 * party gear and lightning. Built once by the app, never by the model, and
 * hidden unless an action shows them. Shapes and sizes follow the Ace's Tree
 * reference.
 */
import * as THREE from "three";
import { canvasTexture } from "./environment";

const TAU = Math.PI * 2;
const UP = new THREE.Vector3(0, 1, 0);
const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const rnd = (a: number, b: number) => a + Math.random() * (b - a);

function M(g: THREE.BufferGeometry, m: THREE.Material, x = 0, y = 0, z = 0) {
  const o = new THREE.Mesh(g, m);
  o.position.set(x, y, z);
  o.castShadow = true;
  o.receiveShadow = true;
  return o;
}

const metal = (c: number, r = 0.35, m = 0.6) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m });
const paint = (c: number) =>
  new THREE.MeshPhysicalMaterial({ color: c, metalness: 0.55, roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.08 });

function bar(parent: THREE.Object3D, a: number[], b: number[], r: number, m: THREE.Material) {
  const A = V3(a[0], a[1], a[2]);
  const B = V3(b[0], b[1], b[2]);
  const d = B.clone().sub(A);
  const c = M(new THREE.CylinderGeometry(r, r, d.length(), 10), m);
  c.position.copy(A.clone().add(B).multiplyScalar(0.5));
  c.quaternion.setFromUnitVectors(UP, d.normalize());
  parent.add(c);
  return c;
}

export type Wheel = THREE.Group & { spin: THREE.Group };

export function buildProps(scene: THREE.Scene, mover: THREE.Group, flash: THREE.PointLight) {
  const mTire = new THREE.MeshStandardMaterial({ color: 0x101214, roughness: 0.9 });
  const mGlass = new THREE.MeshStandardMaterial({
    color: 0x9fc4d8,
    transparent: true,
    opacity: 0.28,
    roughness: 0.05,
    metalness: 0.2,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const mChrome = metal(0xcfd3d6, 0.15, 0.95);
  const mSeat = new THREE.MeshStandardMaterial({ color: 0x2a211c, roughness: 0.8 });

  function spokeWheel(parent: THREE.Object3D, x: number, y: number, z: number, R: number) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    const t = M(new THREE.TorusGeometry(R, R * 0.11, 10, 32), mTire);
    t.rotation.y = Math.PI / 2;
    g.add(t);
    for (let i = 0; i < 4; i++) {
      const s = M(new THREE.BoxGeometry(0.02, R * 1.9, 0.02), mChrome);
      s.rotation.x = (i * Math.PI) / 4;
      g.add(s);
    }
    parent.add(g);
    return g;
  }
  function solidWheel(parent: THREE.Object3D, x: number, y: number, z: number, R: number, W: number, rim = 0xb8bcc0) {
    const g = new THREE.Group() as Wheel;
    const h = new THREE.Group();
    g.position.set(x, y, z);
    g.add(h);
    const t = M(new THREE.CylinderGeometry(R, R, W, 32), mTire);
    t.rotation.z = Math.PI / 2;
    h.add(t);
    const r = M(new THREE.CylinderGeometry(R * 0.62, R * 0.62, W * 1.02, 24), metal(rim, 0.2, 0.9));
    r.rotation.z = Math.PI / 2;
    h.add(r);
    for (let i = 0; i < 5; i++) {
      const s = M(new THREE.BoxGeometry(W * 1.05, R * 1.1, 0.05), mTire);
      s.rotation.x = (i * Math.PI) / 5;
      h.add(s);
    }
    parent.add(g);
    g.spin = h;
    return g;
  }

  // Bike
  const bike = new THREE.Group();
  mover.add(bike);
  const mBike = paint(0xc2362a);
  const bikeRear = spokeWheel(bike, 0, 0.4, -0.7, 0.4);
  const bikeFront = spokeWheel(bike, 0, 0.4, 0.7, 0.4);
  (
    [
      [[0, 0.4, -0.7], [0, 0.38, -0.05]],
      [[0, 0.38, -0.05], [0, 0.78, -0.4]],
      [[0, 0.78, -0.4], [0, 0.4, -0.7]],
      [[0, 0.38, -0.05], [0, 0.98, 0.35]],
      [[0, 0.78, -0.4], [0, 0.98, 0.35]],
      [[0, 0.98, 0.35], [0, 0.4, 0.7]],
    ] as number[][][]
  ).forEach(([a, b]) => bar(bike, a, b, 0.03, mBike));
  bar(bike, [-0.3, 1.05, 0.35], [0.3, 1.05, 0.35], 0.025, mTire);
  bar(bike, [0, 0.98, 0.35], [0, 1.05, 0.35], 0.025, mTire);
  bike.add(M(new THREE.BoxGeometry(0.2, 0.05, 0.34), mTire, 0, 0.8, -0.4));

  // Kick scooter
  const scooter = new THREE.Group();
  mover.add(scooter);
  const mSc = paint(0x2f86c9);
  scooter.add(M(new THREE.BoxGeometry(0.34, 0.07, 1.3), mSc, 0, 0.2, 0));
  const scRear = spokeWheel(scooter, 0, 0.16, -0.7, 0.16);
  const scFront = spokeWheel(scooter, 0, 0.16, 0.78, 0.16);
  bar(scooter, [0, 0.2, 0.7], [0, 1.1, 0.32], 0.035, mChrome);
  bar(scooter, [-0.28, 1.12, 0.32], [0.28, 1.12, 0.32], 0.03, mTire);
  scooter.add(M(new THREE.BoxGeometry(0.3, 0.02, 0.3), mTire, 0, 0.37, -0.76));

  // Convertible
  const car = new THREE.Group();
  mover.add(car);
  const mCar = paint(0xb3261e);
  car.add(M(new THREE.BoxGeometry(1.7, 0.4, 3.6), mCar, 0, 0.5, 0));
  car.add(M(new THREE.BoxGeometry(1.62, 0.2, 1.1), mCar, 0, 0.78, 1.15));
  car.add(M(new THREE.BoxGeometry(1.62, 0.2, 0.9), mCar, 0, 0.78, -1.3));
  [-1, 1].forEach((s) => car.add(M(new THREE.BoxGeometry(0.08, 0.3, 1.4), mCar, s * 0.82, 0.82, -0.15)));
  const ws = M(new THREE.PlaneGeometry(1.5, 0.55), mGlass, 0, 1.05, 0.62);
  ws.rotation.x = -0.45;
  car.add(ws);
  car.add(M(new THREE.BoxGeometry(0.9, 0.12, 0.5), mSeat, 0, 0.62, -0.5));
  car.add(M(new THREE.BoxGeometry(0.9, 0.5, 0.1), mSeat, 0, 0.9, -0.8));
  const sw = M(new THREE.TorusGeometry(0.18, 0.025, 8, 20), mTire, 0, 1.0, 0.26);
  sw.rotation.x = -1.0;
  car.add(sw);
  const lamp = new THREE.MeshStandardMaterial({ color: 0xfff2b0, emissive: 0xffe9a0, emissiveIntensity: 0.8 });
  const tail = new THREE.MeshStandardMaterial({ color: 0xff2a1a, emissive: 0xff2a1a, emissiveIntensity: 0.8 });
  [-0.55, 0.55].forEach((x) => {
    car.add(M(new THREE.SphereGeometry(0.12, 16, 12), lamp, x, 0.62, 1.8));
    car.add(M(new THREE.SphereGeometry(0.09, 12, 10), tail, x, 0.62, -1.8));
  });
  car.add(M(new THREE.BoxGeometry(1.8, 0.08, 0.1), mChrome, 0, 0.42, 1.82));
  car.add(M(new THREE.BoxGeometry(1.8, 0.08, 0.1), mChrome, 0, 0.42, -1.82));
  const carWheels = (
    [
      [-0.85, 1.15],
      [0.85, 1.15],
      [-0.85, -1.15],
      [0.85, -1.15],
    ] as const
  ).map(([x, z]) => solidWheel(car, x, 0.38, z, 0.38, 0.26));

  // Electric car with a glass roof
  const tesla = new THREE.Group();
  mover.add(tesla);
  const mTes = paint(0xf1f2f2);
  const hull = M(new THREE.SphereGeometry(1, 48, 16, 0, TAU, Math.PI / 2, Math.PI / 2), mTes, 0, 0.72, 0);
  hull.scale.set(0.95, 0.42, 2.15);
  tesla.add(hull);
  const hood = M(new THREE.SphereGeometry(1, 32, 12), mTes, 0, 0.7, 1.25);
  hood.scale.set(0.9, 0.14, 0.95);
  tesla.add(hood);
  const deck = M(new THREE.SphereGeometry(1, 32, 12), mTes, 0, 0.72, -1.35);
  deck.scale.set(0.9, 0.14, 0.8);
  tesla.add(deck);
  const roof = M(new THREE.SphereGeometry(1, 40, 16, 0, TAU, 0, Math.PI / 2), mGlass, 0, 0.74, -0.1);
  roof.scale.set(0.82, 0.62, 1.15);
  tesla.add(roof);
  tesla.add(M(new THREE.BoxGeometry(1.55, 0.05, 2.0), new THREE.MeshStandardMaterial({ color: 0x1b1c1e, roughness: 0.7 }), 0, 0.46, 0));
  tesla.add(M(new THREE.BoxGeometry(0.9, 0.1, 0.5), mSeat, 0, 0.54, -0.5));
  tesla.add(M(new THREE.BoxGeometry(0.9, 0.55, 0.1), mSeat, 0, 0.82, -0.8));
  tesla.add(
    M(new THREE.BoxGeometry(1.4, 0.04, 0.04), new THREE.MeshStandardMaterial({ color: 0xff2020, emissive: 0xff2020, emissiveIntensity: 1.2 }), 0, 0.74, -2.0),
  );
  const headlight = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 1.4 });
  [-1, 1].forEach((s) => {
    const h = M(new THREE.BoxGeometry(0.4, 0.025, 0.03), headlight, s * 0.55, 0.74, 2.0);
    h.rotation.y = s * 0.25;
    tesla.add(h);
  });
  const teslaWheels = (
    [
      [-0.9, 1.2],
      [0.9, 1.2],
      [-0.9, -1.2],
      [0.9, -1.2],
    ] as const
  ).map(([x, z]) => solidWheel(tesla, x, 0.37, z, 0.37, 0.25, 0xd8dadc));

  // Trampoline
  const tramp = new THREE.Group();
  scene.add(tramp);
  const frameMat = metal(0x2b2d30, 0.4, 0.8);
  const tFrame = M(new THREE.TorusGeometry(1.65, 0.07, 12, 48), frameMat, 0, 0.8, 0);
  tFrame.rotation.x = Math.PI / 2;
  tramp.add(tFrame);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU;
    bar(tramp, [Math.cos(a) * 1.65, 0.8, Math.sin(a) * 1.65], [Math.cos(a) * 1.8, 0, Math.sin(a) * 1.8], 0.045, frameMat);
  }
  const trampMat = M(
    new THREE.SphereGeometry(1, 40, 8, 0, TAU, 0, Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0x1b3a78, roughness: 0.8, side: THREE.DoubleSide }),
    0,
    0.8,
    0,
  );
  trampMat.scale.set(1.6, -0.02, 1.6);
  tramp.add(trampMat);
  const padRing = M(new THREE.TorusGeometry(1.6, 0.09, 10, 48), new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 }), 0, 0.82, 0);
  padRing.rotation.x = Math.PI / 2;
  tramp.add(padRing);

  // Hoop
  const hoop = new THREE.Group();
  scene.add(hoop);
  bar(hoop, [5.1, 0, 0], [5.1, 3.6, 0], 0.07, metal(0x3a3d41, 0.5, 0.7));
  hoop.add(
    M(new THREE.BoxGeometry(0.06, 1.05, 1.7), new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.75, roughness: 0.2 }), 4.85, 3.6, 0),
  );
  const orange = metal(0xe5651b, 0.4, 0.5);
  const rim = M(new THREE.TorusGeometry(0.24, 0.018, 8, 32), orange, 4.1, 3.2, 0);
  rim.rotation.x = Math.PI / 2;
  hoop.add(rim);
  bar(hoop, [4.34, 3.2, 0], [4.82, 3.2, 0], 0.02, orange);
  const net = M(
    new THREE.CylinderGeometry(0.24, 0.13, 0.45, 16, 5, true),
    new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true, transparent: true, opacity: 0.7 }),
    4.1,
    2.97,
    0,
  );
  net.castShadow = false;
  hoop.add(net);

  const bball = M(
    new THREE.SphereGeometry(0.24, 32, 24),
    new THREE.MeshStandardMaterial({
      roughness: 0.7,
      map: canvasTexture(256, 128, (g, w, h) => {
        g.fillStyle = "#c4521b";
        g.fillRect(0, 0, w, h);
        for (let i = 0; i < 2500; i++) {
          g.fillStyle = `rgba(0,0,0,${rnd(0.03, 0.09)})`;
          g.fillRect(Math.random() * w, Math.random() * h, 2, 2);
        }
        g.strokeStyle = "#17100c";
        g.lineWidth = 4;
        g.beginPath();
        g.moveTo(0, h / 2);
        g.lineTo(w, h / 2);
        [0, w / 2, w].forEach((x) => {
          g.moveTo(x, 0);
          g.lineTo(x, h);
        });
        g.stroke();
        g.beginPath();
        g.arc(w * 0.25, h / 2, h * 0.5, -1.2, 1.2);
        g.arc(w * 0.75, h / 2, h * 0.5, Math.PI - 1.2, Math.PI + 1.2);
        g.stroke();
      }),
    }),
  );
  scene.add(bball);

  const football = new THREE.Group();
  const footballSpin = new THREE.Group();
  football.add(footballSpin);
  scene.add(football);
  {
    const lace = new THREE.MeshStandardMaterial({ color: 0xf3f0e6 });
    const b = M(new THREE.SphereGeometry(0.16, 24, 16), new THREE.MeshStandardMaterial({ color: 0x6b3a1e, roughness: 0.55 }));
    b.scale.set(1, 1, 1.75);
    footballSpin.add(b);
    for (let i = -2; i <= 2; i++)
      footballSpin.add(M(new THREE.BoxGeometry(0.07, 0.012, 0.016), lace, 0, 0.158 * Math.sqrt(Math.max(0, 1 - Math.pow((i * 0.07) / 0.28, 2))), i * 0.07));
    [-0.18, 0.18].forEach((z) => footballSpin.add(M(new THREE.TorusGeometry(0.12, 0.008, 6, 24), lace, 0, 0, z)));
  }

  // Capsule
  const capsule = new THREE.Group();
  scene.add(capsule);
  capsule.add(M(new THREE.SphereGeometry(0.55, 32, 20, 0, TAU, 0, Math.PI / 2), paint(0xe0412f)));
  capsule.add(M(new THREE.SphereGeometry(0.55, 32, 20, 0, TAU, Math.PI / 2, Math.PI / 2), paint(0xf4f4f0)));
  {
    const b = M(new THREE.TorusGeometry(0.55, 0.04, 10, 40), mTire);
    b.rotation.x = Math.PI / 2;
    capsule.add(b);
    const c = M(new THREE.CylinderGeometry(0.11, 0.11, 0.07, 20), mChrome, 0, 0, 0.54);
    c.rotation.x = Math.PI / 2;
    capsule.add(c);
  }

  // Party gear, built at unit scale (a face 1 unit wide) and fitted to the head later.
  const shades = new THREE.Group();
  const phones = new THREE.Group();
  const mLens = new THREE.MeshStandardMaterial({ color: 0x07080a, roughness: 0.08, metalness: 0.9 });
  const mFrame = new THREE.MeshStandardMaterial({ color: 0x101010, roughness: 0.4, metalness: 0.5 });
  [-0.25, 0.25].forEach((x) => {
    const l = M(new THREE.SphereGeometry(0.22, 24, 16), mLens, x, 0, 0.04);
    l.scale.set(1.05, 0.82, 0.22);
    shades.add(l);
    const f = M(new THREE.TorusGeometry(0.22, 0.022, 8, 28), mFrame, x, 0, 0.07);
    f.scale.set(1.05, 0.82, 1);
    shades.add(f);
  });
  shades.add(M(new THREE.BoxGeometry(0.1, 0.04, 0.04), mFrame, 0, 0.03, 0.07));
  const mPad = new THREE.MeshStandardMaterial({ color: 0x1b1b1f, roughness: 0.6 });
  const mAccent = new THREE.MeshStandardMaterial({ color: 0x22e0ff, emissive: 0x22e0ff, emissiveIntensity: 1.2 });
  // Headphones at unit scale around a head of radius 0.5 centred on the origin.
  const band = M(new THREE.TorusGeometry(0.56, 0.04, 10, 40, Math.PI), mPad);
  phones.add(band);
  [-1, 1].forEach((s) => {
    const cup = M(new THREE.CylinderGeometry(0.17, 0.17, 0.13, 28), mPad, s * 0.55, 0, 0);
    cup.rotation.z = Math.PI / 2;
    phones.add(cup);
    const ring = M(new THREE.TorusGeometry(0.12, 0.02, 8, 24), mAccent, s * 0.62, 0, 0);
    ring.rotation.y = Math.PI / 2;
    phones.add(ring);
  });

  const noteTex = canvasTexture(64, 64, (g) => {
    g.fillStyle = "#fff";
    g.beginPath();
    g.ellipse(22, 48, 10, 7, -0.4, 0, TAU);
    g.fill();
    g.fillRect(29, 10, 5, 38);
    g.fillRect(34, 10, 16, 7);
  });
  const notes = [0, 1, 2, 3, 4, 5].map((i) => {
    const s = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: noteTex, transparent: true, color: new THREE.Color().setHSL(i / 6, 0.8, 0.6), depthWrite: false, fog: false }),
    );
    s.scale.set(0.5, 0.5, 0.5);
    scene.add(s);
    return s;
  });

  // Lightning
  type Bolt = { g: THREE.Group; ring: THREE.Mesh; life: number };
  const bolts: Bolt[] = [];
  const ringGeo = new THREE.RingGeometry(0.3, 0.4, 40);
  function spawnBolt(x: number, z: number, strength: number) {
    const pts: THREE.Vector3[] = [];
    let px = x;
    let pz = z;
    const n = 10;
    for (let i = 0; i <= n; i++) {
      pts.push(V3(i === n ? x : px, 10 * (1 - i / n), i === n ? z : pz));
      px = x + rnd(-0.6, 0.6);
      pz = z + rnd(-0.6, 0.6);
    }
    const g = new THREE.Group();
    (
      [
        [0, 0],
        [0.03, 0],
        [-0.03, 0],
        [0, 0.03],
      ] as const
    ).forEach(([dx, dz], i) =>
      g.add(
        new THREE.Line(
          new THREE.BufferGeometry().setFromPoints(pts.map((p) => p.clone().add(V3(dx, 0, dz)))),
          new THREE.LineBasicMaterial({ color: i ? 0xfff3a0 : 0xffffff, transparent: true, fog: false }),
        ),
      ),
    );
    const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xffe566, transparent: true, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(x, 0.03, z);
    g.add(ring);
    scene.add(g);
    bolts.push({ g, ring, life: 0 });
    flash.intensity = 14 * Math.PI * strength;
    flash.position.set(x, 6, z);
  }
  function updateBolts(dt: number) {
    for (let i = bolts.length - 1; i >= 0; i--) {
      const b = bolts[i];
      b.life += dt;
      const a = Math.max(0, 1 - b.life / 0.9);
      b.g.children.forEach((c) => {
        const mat = (c as THREE.Mesh).material as THREE.Material & { opacity: number };
        if (mat) mat.opacity = (c as THREE.Line).isLine ? (b.life < 0.3 ? 1 : a) : a;
      });
      b.ring.scale.setScalar(1 + b.life * 9);
      if (b.life > 0.9) {
        scene.remove(b.g);
        bolts.splice(i, 1);
      }
    }
  }
  function clearBolts() {
    bolts.splice(0).forEach((b) => scene.remove(b.g));
  }

  const hideable: THREE.Object3D[] = [bike, scooter, car, tesla, tramp, hoop, bball, football, capsule, shades, phones, ...notes];

  return {
    bike,
    bikeWheels: [bikeRear, bikeFront],
    scooter,
    scooterWheels: [scRear, scFront],
    car,
    carWheels,
    tesla,
    teslaWheels,
    tramp,
    trampMat,
    hoop,
    rim,
    net,
    bball,
    football,
    footballSpin,
    capsule,
    shades,
    phones,
    accent: mAccent,
    notes,
    spawnBolt,
    updateBolts,
    clearBolts,
    hideAll() {
      hideable.forEach((p) => (p.visible = false));
    },
  };
}

export type Props = ReturnType<typeof buildProps>;
