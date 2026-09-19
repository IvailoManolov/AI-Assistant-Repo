/**
 * Test entry point for `npm test` and for the pre-commit guard.
 *
 * Every test lives under `tests/`, one folder per feature, so this walks that
 * one directory rather than the whole repository. A test file anywhere else is
 * reported rather than run: the point of the layout is that there is one place
 * to look, and silently picking up strays would undo it.
 *
 * Node runs TypeScript directly by stripping types, so the suite needs no test
 * framework and no build step.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const TESTS = join(ROOT, "tests");
const SKIP = new Set(["node_modules", ".next", ".git", "dist", "build", ".husky"]);
const TEST_PATTERN = /\.test\.ts$/;

function walk(dir, found = []) {
  for (const entry of readdirSync(dir)) {
    if (SKIP.has(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, found);
    else if (TEST_PATTERN.test(entry)) found.push(relative(ROOT, full));
  }
  return found;
}

if (!existsSync(TESTS)) {
  console.error("No tests/ directory. Every suite belongs in tests/<feature>/<feature>.test.ts");
  process.exit(1);
}

const tests = walk(TESTS).sort();

/** A suite that drifted back into src/ would never run. Say so loudly. */
const strays = walk(join(ROOT, "src")).filter((f) => !f.startsWith("tests"));
if (strays.length > 0) {
  console.error("Test files found outside tests/. Move them to tests/<feature>/:");
  for (const stray of strays) console.error(`  ${stray}`);
  process.exit(1);
}

if (tests.length === 0) {
  console.error("tests/ holds no .test.ts files.");
  process.exit(1);
}

const byFeature = new Map();
for (const file of tests) {
  const feature = file.split("/")[1];
  byFeature.set(feature, [...(byFeature.get(feature) ?? []), file]);
}

console.log(`Running ${tests.length} suite(s) across ${byFeature.size} feature(s):`);
for (const [feature, files] of byFeature) {
  console.log(`  ${feature}: ${files.map((f) => f.split("/").pop()).join(", ")}`);
}

const result = spawnSync(
  process.execPath,
  ["--disable-warning=MODULE_TYPELESS_PACKAGE_JSON", "--test", ...tests],
  { stdio: "inherit" },
);

process.exit(result.status ?? 1);
