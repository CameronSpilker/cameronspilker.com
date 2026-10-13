/**
 * The stage: runs inside `<iframe sandbox="allow-scripts">` with no network.
 *
 * It owns the renderer, the world, the props and the action runner, all of it
 * app code. Generated code never runs on this thread: `load` hands it to a
 * blob Worker (see worker.ts), and what comes back is plain data that is
 * deserialised, re-checked against the rig contract, and only then shown.
 *
 * The page talks to it with the messages in protocol.ts and nothing else.
 */
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { makeActions, idle, type Action } from "./actions";
import { addSway, buildEnvironment } from "./environment";
import { buildFallback } from "./fallback";
import { findJoints, inspect } from "./inspect";
import { buildProps } from "./props";
import { LIMITS, isPageCommand, type ActionKey, type PageCommand, type StageEvent, type Style, type WorkerResult } from "./protocol";
import { makeRig, resetPose, type Rig } from "./rig";

declare const WORKER_SOURCE: string;

function send(event: StageEvent) {
  window.parent.postMessage(event, "*");
}

type World = ReturnType<typeof buildWorld>;
let world: World | null = null;
let building = false;

function buildWorld(style: Style, reducedMotion: boolean) {
  const canvas = document.getElementById("c") as HTMLCanvasElement;
  const env = buildEnvironment(canvas, { shadows: style === "realistic", flat: style === "faithful" });
  const { renderer, scene, camera, flash, uTime } = env;
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.maxPolarAngle = Math.PI * 0.51;
  controls.minDistance = 3;
  controls.maxDistance = 22;
  controls.autoRotateSpeed = 2;

  const shadowBlob = new THREE.Mesh(
    new THREE.CircleGeometry(1, 32),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.25, depthWrite: false }),
  );
  shadowBlob.rotation.x = -Math.PI / 2;
  shadowBlob.position.y = 0.012;
  scene.add(shadowBlob);

  let rig: Rig | null = null;
  let props: ReturnType<typeof buildProps> | null = null;
  let actions: Record<ActionKey, Action> | null = null;
  let current: ActionKey | null = null;
  let started = 0;
  const clock = new THREE.Timer();

  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / Math.max(1, h);
    camera.updateProjectionMatrix();
  }
  window.addEventListener("resize", resize);
  resize();

  function play(key: ActionKey | null) {
    props?.clearBolts();
    current = key;
    started = clock.getElapsed();
    if (key && actions) actions[key].start?.();
    send({ type: "action", action: key });
  }

  function mount(model: THREE.Object3D, joints: ReturnType<typeof findJoints>) {
    rig = makeRig(model, joints);
    scene.add(rig.mover);
    props = buildProps(scene, rig.mover, flash);
    // The party gear rides on the head, fitted to the face the rig measured.
    rig.j.head.add(props.shades, props.phones);
    props.shades.position.copy(rig.face);
    props.shades.scale.setScalar(rig.faceWidth);
    // Headphones sit level with the face and are sized from it, not from the
    // whole head joint, which can be a leafy crown or a hat.
    const r = Math.min(rig.headRadius, Math.max(0.3, rig.faceWidth * 0.85));
    props.phones.position.set(rig.headCenter.x, rig.face.y, rig.face.z - r);
    props.phones.scale.setScalar(r / 0.5);
    actions = makeActions(rig, props, flash, reducedMotion);

    // The reference camera, pulled back for tall characters and for portrait
    // screens, so the hoop and the flight paths stay in frame.
    const H = rig.H;
    const aspect = camera.aspect || 1;
    const dist = Math.max(10, H * 1.9) * Math.sqrt(Math.max(1, 1.3 / aspect));
    controls.target.set(0.6, Math.min(2.2, H * 0.42), 0);
    camera.position.set(0.48 * dist, 2.9, 0.86 * dist);
    controls.update();
  }

  function frame() {
    requestAnimationFrame(frame);
    clock.update();
    const dt = Math.min(clock.getDelta(), 0.05);
    const now = clock.getElapsed();
    uTime.value = reducedMotion ? 0 : now;
    if (rig && props && actions) {
      resetPose(rig);
      props.hideAll();
      props.trampMat.scale.y = -0.02;
      props.net.scale.set(1, 1, 1);
      props.rim.position.y = 3.2;
      flash.color.set(0xfff7b0);
      rig.glow(0);
      if (current) {
        const t = now - started;
        if (t >= actions[current].d) play(null);
        else actions[current].f(t, dt);
      }
      if (!current) idle(rig, now, reducedMotion);
      props.updateBolts(dt);
      if (current === "lightning") rig.glow(Math.min(0.6, flash.intensity / (22 * Math.PI)));
      const h = Math.max(0, rig.root.position.y);
      shadowBlob.position.set(rig.mover.position.x, 0.012, rig.mover.position.z);
      shadowBlob.scale.setScalar(Math.max(0.4, rig.H * 0.28 - h * 0.12) * Math.max(0.2, rig.root.scale.x));
      (shadowBlob.material as THREE.MeshBasicMaterial).opacity = Math.max(0.05, 0.28 - h * 0.05);
    }
    flash.intensity = Math.max(0, flash.intensity - dt * 28 * Math.PI);
    controls.update();
    renderer.render(scene, camera);
  }
  frame();

  return {
    mount,
    play,
    spin(on: boolean) {
      controls.autoRotate = on;
    },
    swayMaterial(m: THREE.Material, amp: number) {
      addSway(m, amp, uTime);
    },
  };
}

/** Run the builder in a worker and wait for its result, or kill it at the deadline. */
function runWorker(code: string): Promise<WorkerResult> {
  return new Promise((resolve) => {
    let worker: Worker;
    let url = "";
    try {
      url = URL.createObjectURL(new Blob([WORKER_SOURCE], { type: "text/javascript" }));
      worker = new Worker(url);
    } catch (error) {
      resolve({ ok: false, error: `Could not start the builder: ${String(error)}` });
      return;
    }
    const finish = (result: WorkerResult) => {
      clearTimeout(timer);
      worker.terminate();
      URL.revokeObjectURL(url);
      resolve(result);
    };
    const timer = setTimeout(
      () => finish({ ok: false, error: `The builder did not finish within ${LIMITS.buildMs / 1000} seconds. Remove loops that may not end and reduce work.` }),
      LIMITS.buildMs,
    );
    worker.onmessage = (event) => {
      const data = event.data as WorkerResult;
      if (!data || typeof data !== "object" || typeof data.ok !== "boolean") return finish({ ok: false, error: "The builder sent an invalid result." });
      finish(data);
    };
    worker.onerror = (event) => {
      event.preventDefault();
      finish({ ok: false, error: `The builder crashed: ${event.message || "unknown error"}` });
    };
    worker.postMessage({ code });
  });
}

/**
 * Turn the worker's data back into a scene, with the textures swapped back in.
 *
 * In the JSON each texture is a one-pixel data placeholder, which the loader
 * turns into a DataTexture. A canvas cannot be uploaded through a DataTexture,
 * so each one is replaced with a fresh texture over a canvas holding the
 * transferred bitmap, carrying the original's wrapping, repeat and colour space.
 */
function deserialize(result: Extract<WorkerResult, { ok: true }>) {
  const bitmaps = Array.isArray(result.bitmaps) ? result.bitmaps : [];
  const object = new THREE.ObjectLoader().parse(result.json as Record<string, unknown>);
  let nodes = 0;
  const canvases = new Map<number, HTMLCanvasElement>();
  const rebuilt = new Map<THREE.Texture, THREE.Texture>();

  function restore(texture: THREE.Texture) {
    const done = rebuilt.get(texture);
    if (done) return done;
    const index = result.textureMap?.[texture.uuid];
    const bitmap = typeof index === "number" ? bitmaps[index] : undefined;
    if (!(bitmap instanceof ImageBitmap)) return texture;
    let canvas = canvases.get(index as number);
    if (!canvas) {
      canvas = document.createElement("canvas");
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      canvas.getContext("2d")?.drawImage(bitmap, 0, 0);
      canvases.set(index as number, canvas);
    }
    const t = new THREE.CanvasTexture(canvas);
    t.name = texture.name;
    t.wrapS = texture.wrapS;
    t.wrapT = texture.wrapT;
    t.repeat.copy(texture.repeat);
    t.offset.copy(texture.offset);
    t.center.copy(texture.center);
    t.rotation = texture.rotation;
    t.colorSpace = texture.colorSpace;
    t.flipY = texture.flipY;
    t.anisotropy = Math.min(8, texture.anisotropy);
    t.magFilter = texture.magFilter;
    t.minFilter = texture.minFilter;
    t.generateMipmaps = texture.generateMipmaps;
    rebuilt.set(texture, t);
    texture.dispose();
    return t;
  }

  object.traverse((o) => {
    nodes++;
    const mats = (o as THREE.Mesh).material;
    for (const m of Array.isArray(mats) ? mats : mats ? [mats] : []) {
      const slots = m as unknown as Record<string, unknown>;
      for (const [key, value] of Object.entries(slots)) {
        if ((value as THREE.Texture)?.isTexture) slots[key] = restore(value as THREE.Texture);
      }
      m.needsUpdate = true;
      const sway = m.userData?.sway;
      if (typeof sway === "number" && sway > 0 && world) world.swayMaterial(m, Math.min(sway, 0.3));
    }
  });
  if (nodes > 20_000) throw new Error("The character has too many parts.");
  return object;
}

async function handle(command: PageCommand) {
  switch (command.type) {
    case "ping":
      send({ type: "pong", id: command.id });
      return;
    case "play":
      world?.play(command.action);
      return;
    case "stop":
      world?.play(null);
      return;
    case "spin":
      world?.spin(command.on);
      return;
    case "load":
    case "fallback": {
      if (building) return;
      building = true;
      try {
        let model: THREE.Object3D;
        let joints: ReturnType<typeof findJoints>;
        let fallback = false;
        if (command.type === "load") {
          const result = await runWorker(command.builderCode);
          if (!result.ok) {
            send({ type: "built", ok: false, error: result.error.slice(0, 600) });
            return;
          }
          world ??= buildWorld(command.style, command.reducedMotion);
          try {
            model = deserialize(result);
          } catch (error) {
            send({ type: "built", ok: false, error: `The character could not be loaded: ${String((error as Error)?.message ?? error).slice(0, 300)}` });
            return;
          }
          joints = findJoints(model);
        } else {
          world ??= buildWorld(command.style, command.reducedMotion);
          const built = buildFallback(command.palette, command.style);
          model = built.root;
          joints = built.joints;
          fallback = true;
        }
        const check = inspect(model, joints);
        if (!check.ok) {
          send({ type: "built", ok: false, error: check.error });
          return;
        }
        world.mount(model, joints);
        send({ type: "built", ok: true, triangles: check.triangles, instances: check.instances, fallback });
      } finally {
        building = false;
      }
      return;
    }
  }
}

window.addEventListener("message", (event) => {
  if (event.source !== window.parent) return;
  if (!isPageCommand(event.data)) return;
  void handle(event.data);
});

send({ type: "ready" });
