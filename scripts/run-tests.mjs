/**
 * Test entry point for the pre-commit guard.
 *
 * There is no test suite yet. Rather than let the guard silently pass on an
 * empty run, this script looks for test files and reports honestly:
 *  - no test files found  -> pass, and say so loudly
 *  - test files found     -> hand off to the real runner
 *
 * When a runner is added, replace the handoff branch with it.
 */
import { readdirSync, statSync, existsSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const SKIP = new Set(["node_modules", ".next", ".git", "dist", "build", ".husky"]);
const TEST_PATTERN = /\.(test|spec)\.(ts|tsx|js|jsx|mjs)$/;

function findTests(dir, found = []) {
  for (const entry of readdirSync(dir)) {
    if (SKIP.has(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) findTests(full, found);
    else if (TEST_PATTERN.test(entry)) found.push(relative(ROOT, full));
  }
  return found;
}

const tests = existsSync(ROOT) ? findTests(ROOT) : [];

if (tests.length === 0) {
  console.log("No test files found. Nothing to run.");
  console.log("The pre-commit guard still ran typecheck and lint.");
  process.exit(0);
}

console.error(`Found ${tests.length} test file(s) but no runner is configured:`);
for (const t of tests) console.error(`  ${t}`);
console.error("\nWire a runner into scripts/run-tests.mjs before committing tests.");
process.exit(1);
