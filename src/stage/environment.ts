/**
 * The world the character stands in: golden-hour sky, a grass field, a low
 * warm sun and a flash light the lightning action borrows. Ported from the
 * Ace's Tree reference to current three.js, where lights are physical by
 * default, so the ambient and directional intensities carry a factor of PI to
 * look the way they did under the old lighting model.
 */
import * as THREE from "three";

export type Environment = ReturnType<typeof buildEnvironment>;

const TAU = Math.PI * 2;
const rnd = (a: number, b: number) => a + Math.random() * (b - a);

export function canvasTexture(w: number, h: number, draw: (g: CanvasRenderingContext2D, w: number, h: number) => void) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d");
  if (g) draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Grass blades and leaves sway in the vertex shader, driven by one shared clock. */
export function addSway(material: THREE.Material, amp: number, uTime: { value: number }) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uTime;
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nuniform float uTime;")
      .replace(
        "#include <begin_vertex>",
        [
          "#include <begin_vertex>",
          "#ifdef USE_INSTANCING",
          "float ph = instanceMatrix[3].x * 2.1 + instanceMatrix[3].z * 1.7 + instanceMatrix[3].y;",
          "#else",
          "float ph = 0.0;",
          "#endif",
          `transformed.x += sin(uTime * 2.4 + ph) * ${amp.toFixed(4)} * uv.y;`,
          `transformed.z += cos(uTime * 2.0 + ph * 1.3) * ${amp.toFixed(4)} * uv.y;`,
        ].join("\n"),
      );
  };
  material.needsUpdate = true;
}

export function buildEnvironment(canvas: HTMLCanvasElement, opts: { shadows: boolean; flat: boolean }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  // Toon and flat materials take light as bands, so the flat style gets a
  // softer sun to keep the drawing's own colours from washing out.
  renderer.toneMappingExposure = opts.flat ? 0.95 : 1.05;
  renderer.shadowMap.enabled = opts.shadows;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xe2cba8, 22, 70);
  const uTime = { value: 0 };

  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(90, 32, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      vertexShader:
        "varying vec3 p;void main(){p=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
      fragmentShader:
        "varying vec3 p;void main(){float h=clamp(normalize(p).y,0.,1.);vec3 a=vec3(.93,.80,.64),b=vec3(.52,.68,.88),c=vec3(.25,.42,.72);vec3 col=mix(a,b,smoothstep(0.,.25,h));col=mix(col,c,smoothstep(.25,.9,h));gl_FragColor=vec4(col,1.);}",
    }),
  );
  scene.add(sky);

  scene.add(new THREE.HemisphereLight(0xcfe0ff, 0x4d5a2c, (opts.flat ? 0.55 : 0.75) * Math.PI));
  const sun = new THREE.DirectionalLight(0xffe2b4, (opts.flat ? 1.1 : 2.1) * Math.PI);
  sun.position.set(7, 9, 5);
  sun.castShadow = opts.shadows;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: 1, far: 40 });
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.03;
  scene.add(sun);

  // Decay 1 and a fixed range, the way the reference's flash behaved.
  const flash = new THREE.PointLight(0xfff7b0, 0, 60, 1);
  flash.position.set(0, 7, 0);
  scene.add(flash);

  const grassTex = canvasTexture(512, 512, (g, w, h) => {
    g.fillStyle = "#55702f";
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 9000; i++) {
      g.fillStyle = `hsla(${rnd(70, 105)},${rnd(35, 60)}%,${rnd(20, 42)}%,${rnd(0.25, 0.6)})`;
      g.fillRect(Math.random() * w, Math.random() * h, rnd(1, 2.5), rnd(3, 10));
    }
    for (let i = 0; i < 60; i++) {
      g.fillStyle = "rgba(95,75,40,.12)";
      g.beginPath();
      g.arc(Math.random() * w, Math.random() * h, rnd(8, 30), 0, TAU);
      g.fill();
    }
  });
  grassTex.repeat.set(26, 26);

  const ground = new THREE.Mesh(new THREE.CircleGeometry(60, 64), new THREE.MeshStandardMaterial({ map: grassTex, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  {
    const bg = new THREE.BufferGeometry();
    bg.setAttribute("position", new THREE.Float32BufferAttribute([-0.025, 0, 0, 0.025, 0, 0, 0, 1, 0], 3));
    bg.setAttribute("uv", new THREE.Float32BufferAttribute([0, 0, 1, 0, 0.5, 1], 2));
    bg.computeVertexNormals();
    const gm = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, side: THREE.DoubleSide });
    addSway(gm, 0.12, uTime);
    const N = 5000;
    const im = new THREE.InstancedMesh(bg, gm, N);
    const d = new THREE.Object3D();
    const col = new THREE.Color();
    for (let i = 0; i < N; i++) {
      const r = Math.sqrt(Math.random()) * 16;
      const a = Math.random() * TAU;
      d.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
      d.rotation.set(rnd(-0.15, 0.15), Math.random() * TAU, rnd(-0.2, 0.2));
      d.scale.set(1, rnd(0.2, 0.5), 1);
      d.updateMatrix();
      im.setMatrixAt(i, d.matrix);
      col.setHSL(rnd(0.22, 0.29), rnd(0.4, 0.6), rnd(0.2, 0.38));
      im.setColorAt(i, col);
    }
    im.receiveShadow = true;
    scene.add(im);
  }

  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 200);

  return { renderer, scene, camera, flash, uTime };
}
