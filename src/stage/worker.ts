/**
 * The builder worker: the only place generated code runs.
 *
 * It is created from a blob inside the sandboxed stage iframe, so it inherits
 * that iframe's opaque origin and its CSP (no network). It gets one message,
 * the builder source, runs it once, checks the result, flattens it into a form
 * that can cross a thread, and posts it back. The stage terminates it after
 * that or after `LIMITS.buildMs`, whichever comes first.
 */
import * as THREE from "three";
import { makeHelpers } from "./helpers";
import { inspect, JOINT_TAG } from "./inspect";
import { LIMITS, REQUIRED_JOINTS, OPTIONAL_JOINTS, type WorkerResult } from "./protocol";

// The repo's TypeScript config has DOM types, not worker types; this is the
// part of the worker scope used here.
const scope = self as unknown as {
  postMessage(message: unknown, transfer?: Transferable[]): void;
  onmessage: ((event: MessageEvent) => void) | null;
};
const post = scope.postMessage.bind(scope) as (message: WorkerResult, transfer?: Transferable[]) => void;

// Belt and braces. The CSP already refuses every connection; these make the
// failure immediate and obvious rather than a blocked request in a console.
for (const name of ["fetch", "XMLHttpRequest", "WebSocket", "EventSource", "importScripts", "indexedDB", "caches"]) {
  try {
    Object.defineProperty(scope, name, { value: undefined, configurable: false, writable: false });
  } catch {
    // Some are not configurable in some engines. The CSP still holds.
  }
}

/**
 * Parametric geometries serialise as their parameters, so any vertex the
 * builder moved after construction (every tapered `tube`, for one) would be
 * lost on the way across. Copying into a plain BufferGeometry keeps the data.
 */
function flatten(g: THREE.BufferGeometry) {
  if (g.type === "BufferGeometry") return g;
  const out = new THREE.BufferGeometry();
  for (const [name, attr] of Object.entries(g.attributes)) out.setAttribute(name, attr);
  if (g.index) out.setIndex(g.index);
  for (const group of g.groups) out.addGroup(group.start, group.count, group.materialIndex);
  return out;
}

function materialsOf(o: THREE.Object3D): THREE.Material[] {
  const m = (o as THREE.Mesh).material;
  if (!m) return [];
  return Array.isArray(m) ? m : [m];
}

async function run(code: string): Promise<WorkerResult> {
  const helpers = makeHelpers();
  let out: unknown;
  try {
    const build = new Function("THREE", "helpers", `"use strict";\n${code}`);
    out = build(THREE, helpers);
  } catch (error) {
    return { ok: false, error: `The builder threw: ${String((error as Error)?.message ?? error).slice(0, 400)}` };
  }

  if (!out || typeof out !== "object") return { ok: false, error: "The builder must return { root, joints }." };
  if (typeof (out as { then?: unknown }).then === "function")
    return { ok: false, error: "The builder must return synchronously, not a Promise." };
  const { root, joints } = out as { root?: THREE.Object3D; joints?: Record<string, THREE.Object3D> };
  if (!root?.isObject3D) return { ok: false, error: "`root` must be a THREE.Group." };
  if (!joints || typeof joints !== "object") return { ok: false, error: "`joints` must be an object of THREE.Group pivots." };

  const result = inspect(root, joints);
  if (!result.ok) return result;

  for (const name of [...REQUIRED_JOINTS, ...OPTIONAL_JOINTS]) {
    const j = joints[name];
    if (j) j.userData[JOINT_TAG] = name;
  }

  root.traverse((o) => {
    const holder = o as THREE.Mesh;
    if (holder.geometry) holder.geometry = flatten(holder.geometry);
  });

  // Textures cross as transferable bitmaps. In the JSON each one is reduced to
  // a one-pixel placeholder, and `textureMap` says which bitmap replaces it.
  const bitmaps: ImageBitmap[] = [];
  const bySource = new Map<unknown, number>();
  const textureMap: Record<string, number> = {};
  const textures = new Set<THREE.Texture>();
  root.traverse((o) => {
    for (const m of materialsOf(o)) {
      for (const value of Object.values(m)) if ((value as THREE.Texture)?.isTexture) textures.add(value as THREE.Texture);
    }
  });
  if (textures.size > LIMITS.maxTextures)
    return { ok: false, error: `Too many textures: ${textures.size}, limit is ${LIMITS.maxTextures}. Reuse them.` };

  // Clones share an image, so read every texture's image before replacing any.
  const images = new Map<THREE.Texture, unknown>();
  for (const texture of textures) images.set(texture, texture.image);
  for (const [texture, image] of images) {
    const drawable = typeof OffscreenCanvas !== "undefined" && image instanceof OffscreenCanvas;
    if (!drawable && !(image instanceof ImageBitmap)) continue;
    const { width, height } = image as { width: number; height: number };
    if (width > LIMITS.maxTextureSide || height > LIMITS.maxTextureSide)
      return { ok: false, error: `A texture is larger than ${LIMITS.maxTextureSide}px.` };
    let index = bySource.get(image);
    if (index === undefined) {
      index = bitmaps.push(await createImageBitmap(image as ImageBitmapSource)) - 1;
      bySource.set(image, index);
    }
    textureMap[texture.uuid] = index;
  }
  for (const texture of images.keys()) {
    if (texture.uuid in textureMap) texture.image = { data: new Uint8Array(4), width: 1, height: 1 };
  }

  let json: unknown;
  try {
    json = root.toJSON();
  } catch (error) {
    return { ok: false, error: `The character could not be serialised: ${String((error as Error)?.message ?? error).slice(0, 300)}` };
  }
  return { ok: true, json, bitmaps, textureMap, triangles: result.triangles, instances: result.instances };
}

scope.onmessage = async (event: MessageEvent) => {
  const code = (event.data as { code?: unknown })?.code;
  if (typeof code !== "string") return;
  scope.onmessage = null;
  let result: WorkerResult;
  try {
    result = await run(code);
  } catch (error) {
    result = { ok: false, error: `Build failed: ${String((error as Error)?.message ?? error).slice(0, 300)}` };
  }
  post(result, result.ok ? result.bitmaps : []);
};
