/**
 * House style check: no em dashes anywhere in this repository.
 *
 *   npm run check:prose
 *
 * The rule is in CLAUDE.md and it applies to copy, comments, commit-tracked
 * markdown, everything. A note in a style guide is a suggestion; a failing CI
 * step is a rule, so this runs in CI alongside lint and typecheck.
 *
 * Fix a hit by rewriting the sentence rather than swapping in a hyphen. An em
 * dash is almost always doing one of three jobs, and each has a better form: a
 * colon introduces, a full stop separates, and commas or parentheses enclose.
 */
import { existsSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

// U+2014 em dash and U+2015 horizontal bar, written as escapes so this file
// does not trip its own check.
const BANNED = [
  { char: "\u2014", name: "em dash" },
  { char: "\u2015", name: "horizontal bar" },
];

const EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".css", ".md", ".json", ".yml", ".yaml"];
const SKIP = ["package-lock.json"];

const files = execFileSync("git", ["ls-files"], { encoding: "utf8" })
  .split("\n")
  .filter(Boolean)
  .filter((file) => EXTENSIONS.some((ext) => file.endsWith(ext)))
  .filter((file) => !SKIP.some((skip) => file.endsWith(skip)))
  // A file deleted in the working tree is still tracked until it is committed.
  .filter((file) => existsSync(file));

let hits = 0;

for (const file of files) {
  const lines = readFileSync(file, "utf8").split("\n");
  lines.forEach((line, i) => {
    for (const { char, name } of BANNED) {
      if (!line.includes(char)) continue;
      hits += 1;
      console.error(`${file}:${i + 1}  ${name}\n    ${line.trim()}`);
    }
  });
}

if (hits > 0) {
  console.error(
    `\n${hits} line${hits === 1 ? "" : "s"} used a banned dash. Rewrite the sentence: ` +
      "a colon introduces, a full stop separates, commas or parentheses enclose.",
  );
  process.exit(1);
}

console.log(`No banned dashes in ${files.length} files.`);
