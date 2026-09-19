/**
 * Returns the environment to the data it shipped with.
 *
 * Prefers a running server, because the server holds sessions in memory as
 * well as on disk: truncating the files behind its back leaves it holding the
 * old ones, and its next write puts them straight back. Falls back to clearing
 * the files directly when nothing is listening, which is the right thing when
 * the server is stopped.
 *
 * The immutable half of data/seed is never touched either way.
 */
import { clearMutable, listMutableFiles } from "../src/mock-env/mutable.ts";

const port = process.env.PORT ?? 3000;
const url = `http://localhost:${port}/api/runtime/reset`;

async function viaServer() {
  const response = await fetch(url, {
    method: "POST",
    signal: AbortSignal.timeout(2000),
  });
  if (!response.ok) throw new Error(`Reset returned ${response.status}`);
  return response.json();
}

try {
  const { removed } = await viaServer();
  console.log(`Cleared ${removed} generated session(s) through the server on port ${port}.`);
} catch {
  const files = listMutableFiles();
  clearMutable();
  console.log(`No server on port ${port}. Cleared ${files.length} mutable seed file(s):`);
  for (const file of files) console.log(`  data/seed/mutable/${file}`);
}

console.log("data/seed/immutable is unchanged.");
