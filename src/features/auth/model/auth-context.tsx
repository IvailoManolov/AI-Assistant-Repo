"use client";

import { createContext, useCallback, useContext, useMemo, useSyncExternalStore } from "react";
import { ACCOUNTS } from "./accounts";
import {
  clearSession,
  getServerSnapshot,
  getSnapshot,
  subscribe,
  writeSession,
} from "./session-store";
import type { Session, SignInResult } from "./types";

type AuthValue = {
  session: Session | null;
  signIn: (username: string, password: string) => SignInResult;
  signOut: () => void;
};

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const session = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const signIn = useCallback((username: string, password: string): SignInResult => {
    const account = ACCOUNTS[username.trim()];
    if (!account || account.password !== password) {
      return { ok: false, error: "That username and password do not match an account." };
    }
    writeSession({
      username: username.trim(),
      role: account.role,
      displayName: account.displayName,
      customerId: account.customerId,
      signedInAt: new Date().toISOString(),
    });
    return { ok: true };
  }, []);

  const signOut = useCallback(() => clearSession(), []);

  const value = useMemo(() => ({ session, signIn, signOut }), [session, signIn, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
