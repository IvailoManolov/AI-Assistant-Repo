/**
 * Temporary runtime storage for the mock commerce environment.
 *
 * Scaffolding only. Deliberately schema-free: it stores records in named
 * collections and has no opinion about what a record is. The solution defines
 * its own structures, including anything refund related, and stores them here.
 *
 * In memory only. Nothing here is persisted, and clearRuntime() returns the
 * process to the state it had at boot without touching the seed files.
 */
export type RuntimeRecord = Record<string, unknown>;

const collections = new Map<string, Map<string, RuntimeRecord>>();

function bucket(collection: string): Map<string, RuntimeRecord> {
  let found = collections.get(collection);
  if (!found) {
    found = new Map();
    collections.set(collection, found);
  }
  return found;
}

/** Stores a record, replacing any record already held under the same id. */
export function putRecord(collection: string, id: string, record: RuntimeRecord): RuntimeRecord {
  bucket(collection).set(id, record);
  return record;
}

export function getRecord(collection: string, id: string): RuntimeRecord | undefined {
  return collections.get(collection)?.get(id);
}

export function listRecords(collection: string): RuntimeRecord[] {
  return [...(collections.get(collection)?.values() ?? [])];
}

export function deleteRecord(collection: string, id: string): boolean {
  return collections.get(collection)?.delete(id) ?? false;
}

export function listCollections(): string[] {
  return [...collections.keys()];
}

/** Drops every runtime record. Seed files are untouched. */
export function clearRuntime(): void {
  collections.clear();
}
