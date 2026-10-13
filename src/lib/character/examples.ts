/**
 * Two builders written by hand to the rig contract, ported from the Ace's
 * Pikachu and Ace's Tree pages. They do two jobs: they are the worked examples
 * in the system prompt (one per style), and they are the fixtures the stage is
 * tested against, so every action is known to work on a real rig before any
 * model output is involved.
 *
 * They are function bodies, the same shape the model returns. They are kept
 * free of backticks and dollar-brace sequences so they sit safely in a
 * template literal.
 */

/** "Faithful to the drawing": flat colours, simple shapes, the drawing's quirks kept. */
export const PIKACHU_BUILDER = String.raw`
// Flat cartoon materials taken from the drawing's own colours.
var mHead = new THREE.MeshToonMaterial({ color: 0x6fd3a0 });
var mBody = new THREE.MeshToonMaterial({ color: 0xcfd45a });
var mTip = new THREE.MeshToonMaterial({ color: 0x2f9a72 });
var mDark = new THREE.MeshToonMaterial({ color: 0x182026 });
var mWhite = new THREE.MeshBasicMaterial({ color: 0xffffff });
var M = helpers.mesh;

var root = new THREE.Group();
root.add(M(new THREE.BoxGeometry(1.05, 1.05, 0.8), mBody, 0, 0.85, 0));

// Head pivot at the neck; the face lives inside it.
var head = helpers.pivot(root, 0, 1.4, 0);
var skull = M(new THREE.SphereGeometry(0.7, 32, 24), mHead, 0, 0.55, 0);
skull.scale.set(0.85, 1, 0.82);
head.add(skull);
[-0.24, 0.24].forEach(function (x) {
  var e = M(new THREE.SphereGeometry(0.08, 16, 12), mDark, x, 0.67, 0.5);
  e.scale.set(1, 1.2, 0.5);
  head.add(e);
  head.add(M(new THREE.SphereGeometry(0.025, 8, 8), mWhite, x + 0.02, 0.72, 0.54));
});
var smile = M(new THREE.TorusGeometry(0.2, 0.03, 8, 24, Math.PI), mDark, 0, 0.43, 0.55);
smile.rotation.z = Math.PI;
head.add(smile);
head.userData.face = { x: 0, y: 0.67, z: 0.58, width: 0.62 };

// The drawing has one tall ear, tilted, with a dark tip. Only one.
var earR = helpers.pivot(head, 0.32, 1.1, 0);
earR.add(M(new THREE.CylinderGeometry(0.1, 0.17, 0.8, 12), mHead, 0, 0.4, 0));
earR.add(M(new THREE.CylinderGeometry(0.1, 0.1, 0.3, 12), mTip, 0, 0.95, 0));
earR.rotation.z = -0.55;

// Arms hang straight down from the shoulder pivots, then the rest pose is set by rotation.
function arm(side) {
  var g = helpers.pivot(root, side * 0.62, 1.2, 0);
  g.add(M(new THREE.CylinderGeometry(0.08, 0.08, 0.7, 10), mBody, 0, -0.35, 0));
  g.add(M(new THREE.BoxGeometry(0.28, 0.28, 0.2), mHead, 0, -0.8, 0));
  return g;
}
var armL = arm(-1);
var armR = arm(1);
armL.rotation.z = -0.15;
armR.rotation.z = 0.15;

function leg(side) {
  var g = helpers.pivot(root, side * 0.3, 0.35, 0);
  var f = M(new THREE.SphereGeometry(0.25, 16, 12), mHead, 0, -0.15, 0.1);
  f.scale.set(0.8, 0.7, 1.3);
  g.add(f);
  return g;
}
var legL = leg(-1);
var legR = leg(1);

// Boxy lightning-bolt tail.
var tail = helpers.pivot(root, 0.5, 0.7, -0.35);
var t1 = M(new THREE.BoxGeometry(0.7, 0.14, 0.14), mBody, 0.3, 0, 0);
t1.rotation.z = 0.2;
tail.add(t1);
var t2 = M(new THREE.BoxGeometry(0.6, 0.14, 0.14), mBody, 0.7, 0.28, 0);
t2.rotation.z = -0.2;
tail.add(t2);
tail.rotation.y = 0.3;

return { root: root, joints: { head: head, armL: armL, armR: armR, legL: legL, legR: legR, tail: tail, earR: earR } };
`;

/** "Realistic": procedural bark with a bump map, instanced leaves, real shadows. */
export const TREE_BUILDER = String.raw`
var TAU = Math.PI * 2, rnd = helpers.rnd, V3 = helpers.V3, M = helpers.mesh, tube = helpers.tube;

var barkTex = helpers.canvasTex(512, 512, function (g, w, h) {
  g.fillStyle = "#5b4332";
  g.fillRect(0, 0, w, h);
  for (var i = 0; i < 1400; i++) {
    var x = Math.random() * w, wd = rnd(1, 5), l = rnd(60, 260), y0 = rnd(-40, h), ph = rnd(0, 6), a = rnd(0.12, 0.5);
    g.strokeStyle = Math.random() < 0.65 ? "rgba(24,15,9," + a + ")" : "rgba(150,118,86," + a * 0.55 + ")";
    g.lineWidth = wd;
    g.beginPath();
    for (var y = 0; y <= l; y += 8) {
      var xx = x + Math.sin(y * 0.045 + ph) * 3 + Math.sin(y * 0.13 + ph * 2) * 1.2;
      if (y) g.lineTo(xx, y0 + y); else g.moveTo(xx, y0 + y);
    }
    g.stroke();
  }
  for (var k = 0; k < 4000; k++) {
    g.fillStyle = "rgba(" + (Math.random() < 0.5 ? "20,12,6" : "170,140,105") + "," + rnd(0.04, 0.16) + ")";
    g.fillRect(Math.random() * w, Math.random() * h, rnd(1, 3), rnd(2, 9));
  }
});
barkTex.repeat.set(3, 2);
var barkTube = barkTex.clone();
barkTube.rotation = Math.PI / 2;
barkTube.center.set(0.5, 0.5);
barkTube.repeat.set(1, 2);

var mBark = new THREE.MeshStandardMaterial({ map: barkTex, bumpMap: barkTex, bumpScale: 3.2, roughness: 0.95 });
var mBarkT = new THREE.MeshStandardMaterial({ map: barkTube, bumpMap: barkTube, bumpScale: 2.4, roughness: 0.95, color: 0xe8d8c4 });
var mDark = new THREE.MeshStandardMaterial({ color: 0x140b05, roughness: 0.85 });
var mRing = new THREE.MeshStandardMaterial({ color: 0x3b2412, roughness: 0.9 });
var mGloss = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.08 });
var mMoss = new THREE.MeshStandardMaterial({ color: 0x56752c, roughness: 1 });

var root = new THREE.Group();

// Trunk: a lathe profile with gnarly displacement.
var profPts = new THREE.CatmullRomCurve3([V3(0.001, 0.5, 0), V3(0.6, 0.5, 0), V3(0.68, 0.7, 0), V3(0.56, 1.0, 0), V3(0.5, 1.5, 0), V3(0.52, 2.0, 0), V3(0.62, 2.4, 0), V3(0.66, 2.62, 0), V3(0.5, 2.8, 0), V3(0.001, 2.88, 0)]).getPoints(48);
function prof(y) {
  for (var i = 1; i < profPts.length; i++) {
    if (profPts[i].y >= y) {
      var a = profPts[i - 1], b = profPts[i], t = (y - a.y) / Math.max(1e-6, b.y - a.y);
      return a.x + (b.x - a.x) * t;
    }
  }
  return 0.5;
}
var lathe = new THREE.LatheGeometry(profPts.map(function (p) { return new THREE.Vector2(Math.max(p.x, 0.001), p.y); }), 64);
var pos = lathe.attributes.position;
for (var i = 0; i < pos.count; i++) {
  var px = pos.getX(i), py = pos.getY(i), pz = pos.getZ(i), r = Math.hypot(px, pz);
  if (r < 0.06) continue;
  var an = Math.atan2(pz, px), f = 1 + 0.05 * Math.sin(an * 5 + py * 2.3) + 0.035 * Math.sin(an * 9 - py * 3.7);
  pos.setXYZ(i, px * f, py, pz * f);
}
lathe.computeVertexNormals();
root.add(M(lathe, mBark));
function surf(x, y) { return Math.sqrt(Math.max(prof(y) * prof(y) - x * x, 0)); }

// Face carved into the bark, as in the drawing.
[[-0.2, 2.3, 0.115], [0.2, 2.28, 0.085]].forEach(function (e) {
  var x = e[0], y = e[1], r = e[2], z = surf(x, y);
  var eye = M(new THREE.SphereGeometry(r, 24, 16), mDark, x, y, z - 0.005);
  eye.scale.set(1, 1.25, 0.45);
  root.add(eye);
  var ring = M(new THREE.TorusGeometry(r * 1.15, 0.028, 10, 32), mRing, x, y, z + 0.01);
  ring.scale.y = 1.2;
  root.add(ring);
  root.add(M(new THREE.SphereGeometry(0.022, 10, 8), mGloss, x + r * 0.3, y + r * 0.45, z + 0.05));
});
var smilePts = [];
for (var s = 0; s <= 8; s++) {
  var sx = -0.32 + (0.64 * s) / 8, sy = 1.78 + 0.2 * Math.pow(sx / 0.32, 2);
  smilePts.push([sx, sy, surf(sx, sy) + 0.012]);
}
root.add(tube(smilePts, 0.04, 0.04, mDark, 24, 8));
for (var m = 0; m < 9; m++) {
  var ma = rnd(1.7, 4.6), my = rnd(0.7, 2.4), mr = prof(my);
  var moss = M(new THREE.SphereGeometry(rnd(0.08, 0.16), 10, 8), mMoss, Math.sin(ma) * mr * 0.98, my, Math.cos(ma) * mr * 0.98);
  moss.scale.set(1, 0.7, 0.5);
  moss.lookAt(moss.position.clone().multiplyScalar(2).setY(my));
  root.add(moss);
}

// The crown is the head: three leafy spikes on top, like the drawing.
var head = helpers.pivot(root, 0, 2.75, 0);
[[-0.45, 0.5], [0.4, 0.55], [0, 0.7], [0.7, 0.3], [-0.7, 0.25]].forEach(function (c) {
  head.add(tube([[c[0] * 0.2, -0.1, 0], [c[0] * 0.6, c[1] * 0.5, rnd(-0.2, 0.2)], [c[0], c[1], rnd(-0.2, 0.2)]], 0.13, 0.05, mBarkT, 10, 7));
});
helpers.leafMass(head, [
  { c: [0, 1.0, 0], r: [1.15, 0.75, 1.0], n: 520, up: 0.3 },
  { c: [0.9, 0.75, 0], r: [0.6, 0.5, 0.6], n: 120, up: 0.4 },
  { c: [0, 0.35, 0], r: [1.0, 0.3, 0.9], n: 100, up: -0.2 },
  { c: [-0.55, 1.85, 0], r: [0.2, 0.55, 0.2], n: 80, up: 1.2 },
  { c: [0, 2.15, 0], r: [0.2, 0.7, 0.2], n: 90, up: 1.2 },
  { c: [0.6, 1.9, 0], r: [0.2, 0.55, 0.2], n: 80, up: 1.2 }
]);
// The carved face is on the trunk, below the crown pivot.
head.userData.face = { x: 0, y: -0.45, z: 0.62, width: 0.62 };

function twig(parent, o, dir, len, r, depth, tips) {
  var end = o.clone().addScaledVector(dir, len);
  var mid = o.clone().addScaledVector(dir, len * 0.5).add(V3(rnd(-0.5, 0.5), rnd(-0.3, 0.5), rnd(-0.5, 0.5)).multiplyScalar(len * 0.2));
  parent.add(tube([o.toArray(), mid.toArray(), end.toArray()], r, r * 0.55, mBarkT, 8, 6));
  if (depth > 0) {
    for (var n = 0; n < 2; n++) {
      var d2 = dir.clone().add(V3(rnd(-0.9, 0.9), rnd(-0.2, 0.9), rnd(-0.9, 0.9))).normalize();
      twig(parent, end.clone(), d2, len * 0.62, r * 0.55, depth - 1, tips);
    }
  } else tips.push(end);
}

// Branch arms hang down from the shoulder pivots; the rest pose rotates them
// to match the drawing: left arm raised high, right arm held out.
function makeArm(side) {
  var g = helpers.pivot(root, side * 0.58, 2.2, 0);
  g.add(tube([[0, 0, 0], [side * 0.22, -0.45, 0.06], [side * 0.38, -0.95, 0.1], [side * 0.4, -1.4, 0.12]], 0.17, 0.09, mBarkT, 24, 10));
  var tips = [], o = V3(side * 0.4, -1.4, 0.12);
  for (var n = 0; n < 4; n++) {
    var a = (n - 1.5) * 0.55, d = V3(side * 0.3 + Math.sin(a) * 0.8, -1, Math.cos(a) * 0.25).normalize();
    twig(g, o.clone(), d, 0.5, 0.055, 1, tips);
  }
  helpers.leafMass(g, tips.map(function (t) { return { c: t.toArray(), r: [0.16, 0.16, 0.16], n: 12, s: 0.7 }; }).concat([{ c: [side * 0.32, -0.9, 0.1], r: [0.25, 0.5, 0.25], n: 24, s: 0.8 }]));
  return g;
}
var armL = makeArm(-1), armR = makeArm(1);
armL.rotation.z = -2.5;
armR.rotation.z = 1.45;

function makeLeg(side) {
  var g = helpers.pivot(root, side * 0.32, 0.6, 0);
  g.add(tube([[0, 0, 0], [side * 0.03, -0.25, 0], [side * 0.05, -0.5, 0.02]], 0.27, 0.22, mBarkT, 12, 12));
  var heel = M(new THREE.SphereGeometry(0.28, 16, 12), mBark, side * 0.05, -0.5, 0.1);
  heel.scale.set(1, 0.5, 1.3);
  g.add(heel);
  [-0.24, 0, 0.24].forEach(function (dx) {
    g.add(tube([[side * 0.05, -0.5, 0.1], [side * 0.05 + dx * 0.5, -0.55, 0.35], [side * 0.05 + dx, -0.585, 0.6]], 0.13, 0.06, mBarkT, 10, 8));
  });
  return g;
}
var legL = makeLeg(-1), legR = makeLeg(1);

return { root: root, joints: { head: head, armL: armL, armR: armR, legL: legL, legR: legR } };
`;
