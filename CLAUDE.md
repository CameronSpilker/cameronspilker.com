# Working in this repository

## House style

**Never use an em dash.** Not in page copy, not in code comments, not in
markdown, not in commit messages. This is enforced: `npm run check:prose` fails
the build on U+2014 (em dash) and U+2015 (horizontal bar), and it runs in CI
alongside lint and typecheck.

Do not fix a hit by swapping in a hyphen or an en dash. Rewrite the sentence. An
em dash is nearly always doing one of three jobs, and each has a plainer form:

| Job it was doing        | Use instead                       |
| ----------------------- | --------------------------------- |
| Introducing a list or an explanation | a colon                  |
| Splicing two sentences  | a full stop, and two sentences    |
| Enclosing an aside      | commas, or parentheses            |

A middle dot (`·`) is fine as a separator between short metadata fields, which
is what the mono labels across the site already use.

Other conventions that hold throughout:

- Copy is plain and specific. Say the number, name the tool, skip the adjective.
- Buttons say what the reader gets, never "Visit site" or "Learn more".
- Nothing on the site claims a result the repos cannot back up. If a link is not
  live yet, the page says so rather than linking to a placeholder.

## Structure

Content and presentation are separate on purpose. Copy changes belong in
`src/content/`; components read from there and never hold their own strings.

```
src/
├── app/            # App Router entry: layout, page, global styles
├── components/     # Section components (Hero, Projects, Lab, Experience, ...)
├── lib/            # Framework-free helpers (cron.ts drives the Lab countdown)
└── content/
    ├── site.ts        # name, tagline, contact links, Full Data Stack Lab URLs
    ├── projects.ts    # the four showcase panels and their calls to action
    ├── experience.ts  # three detailed roles plus the compact earlier list
    └── lab.ts         # the Lab section's three tabs
```

`src/content/lab.ts` mirrors the `full-data-stack-lab` repository: the cron
strings are copied from its Dagster schedules and the model and test counts come
from a real `dbt build`. If that repo changes, this file is wrong until it is
updated with it.

## Before pushing

```bash
npm run check:prose
npm run lint
npm run typecheck
npm run build
```
