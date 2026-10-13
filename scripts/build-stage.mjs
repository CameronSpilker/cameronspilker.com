/**
 * Bundle the character stage: the code that runs inside the sandboxed iframe.
 *
 *   npm run build:stage      (also runs before `dev` and `build`)
 *
 * The stage is not part of the Next app. It is a standalone script loaded by
 * public/character-stage/index.html, so it can run under its own CSP in an
 * opaque origin without Next's runtime. The builder worker is bundled first
 * and inlined into the stage as a string, because a sandboxed document has no
 * origin to load a worker script from; the stage starts it from a blob.
 *
 * Output: public/character-stage/stage.js (generated, not committed).
 */
import { build } from "esbuild";
import { mkdirSync } from "node:fs";

const common = {
  bundle: true,
  minify: true,
  format: "iife",
  target: ["es2020", "safari15"],
  legalComments: "none",
  logLevel: "warning",
};

const worker = await build({ ...common, entryPoints: ["src/stage/worker.ts"], write: false });
const workerSource = worker.outputFiles[0].text;

mkdirSync("public/character-stage", { recursive: true });
await build({
  ...common,
  entryPoints: ["src/stage/stage.ts"],
  outfile: "public/character-stage/stage.js",
  define: { WORKER_SOURCE: JSON.stringify(workerSource) },
});

console.log(`stage built: worker ${(workerSource.length / 1024).toFixed(0)} KB inlined`);
