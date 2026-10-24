/**
 * Renders the share card: the image LinkedIn, Slack and the rest show when
 * someone posts a link to the site, and the thumbnail on the LinkedIn
 * Featured spot.
 *
 *   node scripts/make-share-card.mjs
 *
 * Writes `src/app/opengraph-image.png`, which Next.js serves as `og:image` for
 * every page that does not set its own. 1200 x 627 is LinkedIn's recommended
 * link image size. The Featured card shows it at roughly a fifth of that, so
 * the words are big and few.
 *
 * Colours are the light Ocean tokens from `globals.css`, and the screenshots
 * are the ones in `public/shots`, so rerun this after either changes.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

let chromium;
try {
  ({ chromium } = await import("playwright"));
} catch {
  console.error("Playwright is not installed. Run:\n  npm i -D playwright && npx playwright install chromium");
  process.exit(1);
}

const root = fileURLToPath(new URL("..", import.meta.url));
const out = `${root}src/app/opengraph-image.png`;

const shot = (slug) =>
  `data:image/webp;base64,${readFileSync(`${root}public/shots/${slug}.webp`).toString("base64")}`;

const html = `<!doctype html>
<html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;700;800&family=Geist+Mono:wght@500&display=block" rel="stylesheet">
<style>
  * { box-sizing: border-box; margin: 0; }
  body {
    width: 1200px; height: 627px; overflow: hidden; position: relative;
    font-family: "Plus Jakarta Sans", sans-serif; color: #0b2233;
    background-color: #eef6f9;
    background-image:
      radial-gradient(620px 620px at 0% 0%, rgba(143,211,244,.75), transparent 70%),
      radial-gradient(560px 560px at 100% 20%, rgba(132,240,213,.65), transparent 70%),
      radial-gradient(640px 640px at 45% 100%, rgba(165,184,255,.6), transparent 70%);
  }
  .copy { position: absolute; left: 72px; top: 0; bottom: 0; width: 600px;
    display: flex; flex-direction: column; justify-content: center; }
  .chip { align-self: flex-start; font: 500 20px "Geist Mono", monospace; color: #0969c0;
    padding: 10px 18px; border-radius: 999px; background: rgba(255,255,255,.7);
    border: 1px solid rgba(255,255,255,.95); }
  h1 { font-weight: 800; font-size: 84px; line-height: 1.02; letter-spacing: -2.5px; margin-top: 30px; }
  .grad { padding-bottom: 10px; background-image: linear-gradient(90deg, #0a7bd6, #11a597, #5f6bff);
    -webkit-background-clip: text; background-clip: text; color: transparent; }
  p { font-weight: 500; font-size: 27px; line-height: 1.4; color: #46606f; margin-top: 26px; max-width: 540px; }
  .url { font: 500 24px "Geist Mono", monospace; color: #0b2233; margin-top: 34px; }
  .stack { position: absolute; right: -70px; top: 50%; width: 560px; height: 520px; transform: translateY(-50%); }
  .card { position: absolute; width: 440px; aspect-ratio: 16 / 10; border-radius: 18px; overflow: hidden;
    background: rgba(255,255,255,.62); border: 6px solid rgba(255,255,255,.9);
    box-shadow: 0 24px 60px rgba(10,105,192,.22); }
  .card img { width: 100%; height: 100%; object-fit: cover; object-position: top; display: block; }
</style></head>
<body>
  <div class="stack">
    <div class="card" style="left:90px; top:10px; transform: rotate(5deg)"><img src="${shot("plainstocks")}"></div>
    <div class="card" style="left:40px; top:150px; transform: rotate(-4deg)"><img src="${shot("full-data-stack-lab")}"></div>
    <div class="card" style="left:10px; top:270px; transform: rotate(2deg)"><img src="${shot("cardtacular")}"></div>
  </div>
  <div class="copy">
    <span class="chip">Analytics engineer · building with AI</span>
    <h1>Cameron Spilker</h1>
    <h1 class="grad" style="margin-top:6px; font-size:60px; letter-spacing:-1.5px">I like building things.</h1>
    <p>Data people and AI agents can rely on, plus a few side projects.</p>
    <span class="url">cameronspilker.com</span>
  </div>
</body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 627 } });
await page.setContent(html, { waitUntil: "networkidle" });
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: out });
await browser.close();
console.log(`wrote ${out}`);
