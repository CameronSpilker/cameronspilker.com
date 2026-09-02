/**
 * Capture homepage screenshots for the project showcase.
 *
 *   npm run shots            # capture every project with an href
 *   npm run shots hoapulse   # capture one
 *
 * Writes public/shots/<slug>.png. Projects.tsx picks these up at build time;
 * a project without a capture falls back to its wireframe, so a failed run
 * degrades instead of breaking the page.
 *
 * Requires Playwright locally. It is not a dependency of the site:
 *   npm i -D playwright && npx playwright install chromium
 */
import { existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "public", "shots");

// Kept in step with src/content/projects.ts by hand. Four entries is not worth
// a build-time import of TypeScript.
const targets = [
  { slug: "hoapulse", url: "https://hoapulse.net" },
  { slug: "cardtacular", url: "https://cardtacular.com" },
  { slug: "plainstocks", url: "https://plainstocks.com" },
  // The dashboard, not the repo. The repo was the stand-in while the Evidence
  // build had nowhere to live; a showcase panel should show the product.
  { slug: "full-data-stack-lab", url: "https://lab.cameronspilker.com" },
];

const only = process.argv.slice(2);
const queue = only.length ? targets.filter((t) => only.includes(t.slug)) : targets;

if (!queue.length) {
  console.error(`No matching projects. Known slugs: ${targets.map((t) => t.slug).join(", ")}`);
  process.exit(1);
}

let chromium;
try {
  ({ chromium } = await import("playwright"));
} catch {
  console.error("Playwright is not installed. Run:\n  npm i -D playwright && npx playwright install chromium");
  process.exit(1);
}

if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
let failures = 0;

for (const { slug, url } of queue) {
  const page = await browser.newPage({
    viewport: { width: 1600, height: 1000 },
    deviceScaleFactor: 2,
  });
  try {
    await page.goto(url, { waitUntil: "networkidle", timeout: 45_000 });
    // Give lazy heroes and web fonts a beat to settle.
    await page.waitForTimeout(2500);
    await page.screenshot({ path: join(outDir, `${slug}.png`) });
    console.log(`captured  ${slug}`);
  } catch (error) {
    failures += 1;
    console.error(`failed    ${slug}: ${error.message.split("\n")[0]}`);
  } finally {
    await page.close();
  }
}

await browser.close();
process.exit(failures ? 1 : 0);
