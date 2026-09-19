/**
 * The mutable half of data/seed.
 *
 * Everything here is generated while the product is used: sessions so far,
 * and whatever the solution adds later. It is deliberately file backed rather
 * than memory only, because the operator console is meant to show history
 * across restarts. The immutable half never changes, so the supplied source
 * data is still recoverable exactly as it was given.
 *
 * Schema free on purpose. This module moves JSON arrays and has no opinion
 * about what is in them.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export const MUTABLE_DIR = join(process.cwd(), "data", "seed", "mutable");

function ensureDir() {
  if (!existsSync(MUTABLE_DIR)) mkdirSync(MUTABLE_DIR, { recursive: true });
}

export function readMutable<T>(file: string): T[] {
  ensureDir();
  const path = join(MUTABLE_DIR, file);
  if (!existsSync(path)) return [];
  const raw = readFileSync(path, "utf8").trim();
  if (!raw) return [];
  const parsed = JSON.parse(raw) as T[];
  return Array.isArray(parsed) ? parsed : [];
}

export function writeMutable(file: string, rows: unknown[]): void {
  ensureDir();
  writeFileSync(join(MUTABLE_DIR, file), JSON.stringify(rows, null, 2) + "\n");
}

/** Empties every mutable file without deleting it. Immutable seed untouched. */
export function clearMutable(): void {
  ensureDir();
  for (const file of readdirSync(MUTABLE_DIR)) {
    if (file.endsWith(".json")) writeMutable(file, []);
  }
}

export function listMutableFiles(): string[] {
  ensureDir();
  return readdirSync(MUTABLE_DIR).filter((f) => f.endsWith(".json"));
}
