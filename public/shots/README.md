# Project screenshots

Homepage captures for the project showcase, named `<slug>.png` to match the
slugs in `src/content/projects.ts`.

Generate them with:

```bash
npm i -D playwright && npx playwright install chromium
npm run shots            # all projects
npm run shots hoapulse   # just one
```

`src/components/Projects.tsx` looks for `<slug>.webp`, `.png`, or `.jpg` here at
build time. A project without a file falls back to a wireframe in its own
colors, so it is always safe to leave one out, or to drop a hand-made image in
rather than running the script.
