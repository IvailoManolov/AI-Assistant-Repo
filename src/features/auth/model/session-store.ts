import type { Session } from "./types";

/**
 * localStorage is an external store, so it is read through
 * useSyncExternalStore rather than mirrored into React state inside an effect.
 * The snapshot is cached because the hook compares by reference.
 */
const STORAGE_KEY = "kiln.session";

let cachedRaw: string | null = null;
let cachedSession: Session | null = null;
const listeners = new Set<() => void>();

export function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

function emit() {
  for (const l of listeners) l();
}

export function getSnapshot(): Session | null {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
  if (raw === cachedRaw) return cachedSession;
  cachedRaw = raw;
  try {
    cachedSession = raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    cachedSession = null;
  }
  return cachedSession;
}

/** The server never has a session, so it always renders the signed-out shell. */
export function getServerSnapshot(): Session | null {
  return null;
}

/**
 * Authoritative read, safe to call from an effect. Route guards use this
 * rather than the rendered snapshot, because the first client render after
 * hydration still carries the server's null and would bounce a signed-in user
 * back to the login screen.
 */
export function readStoredSession(): Session | null {
  if (typeof window === "undefined") return null;
  return getSnapshot();
}

export function writeSession(next: Session) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Storage is blocked. The in-memory snapshot below still drives this tab.
  }
  cachedRaw = JSON.stringify(next);
  cachedSession = next;
  emit();
}

export function clearSession() {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to clean up.
  }
  cachedRaw = null;
  cachedSession = null;
  emit();
}
