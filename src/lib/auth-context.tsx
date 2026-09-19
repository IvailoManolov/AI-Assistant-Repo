"use client";

import { createContext, useCallback, useContext, useMemo, useSyncExternalStore } from "react";

export type Role = "user" | "admin";

export type Session = {
  username: string;
  role: Role;
  displayName: string;
  signedInAt: string;
};

/**
 * Credentials are hardcoded on purpose. This is a demo environment with no
 * database and no real accounts; the sign-in exists to switch between the two
 * roles, not to protect anything.
 */
const ACCOUNTS: Record<string, { password: string; role: Role; displayName: string }> = {
  Admin: { password: "Test123$", role: "admin", displayName: "Operator" },
  User: { password: "Test123$", role: "user", displayName: "Anna Petrova" },
};

const STORAGE_KEY = "kiln.session";

/**
 * localStorage is an external store, so it is read through
 * useSyncExternalStore rather than mirrored into state inside an effect.
 * The snapshot is cached because the hook compares by reference.
 */
let cachedRaw: string | null = null;
let cachedSession: Session | null = null;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
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

function getSnapshot(): Session | null {
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
function getServerSnapshot(): Session | null {
  return null;
}

/**
 * Authoritative read, safe to call from an effect. Route guards use this
 * rather than the rendered snapshot, because the first client render after
 * hydration still carries the server's null and would redirect a signed-in
 * user back to the login screen.
 */
export function readStoredSession(): Session | null {
  if (typeof window === "undefined") return null;
  return getSnapshot();
}

type AuthValue = {
  session: Session | null;
  ready: boolean;
  signIn: (username: string, password: string) => { ok: true } | { ok: false; error: string };
  signOut: () => void;
};

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const session = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const signIn = useCallback((username: string, password: string) => {
    const account = ACCOUNTS[username.trim()];
    if (!account || account.password !== password) {
      return { ok: false as const, error: "That username and password do not match an account." };
    }
    const next: Session = {
      username: username.trim(),
      role: account.role,
      displayName: account.displayName,
      signedInAt: new Date().toISOString(),
    };
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Storage is blocked. Fall through to the in-memory snapshot below.
    }
    cachedRaw = JSON.stringify(next);
    cachedSession = next;
    emit();
    return { ok: true as const };
  }, []);

  const signOut = useCallback(() => {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Nothing to clean up.
    }
    cachedRaw = null;
    cachedSession = null;
    emit();
  }, []);

  const value = useMemo(
    () => ({ session, ready: true, signIn, signOut }),
    [session, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
