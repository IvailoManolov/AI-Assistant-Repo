"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../model/auth-context";
import { readStoredSession } from "../model/session-store";
import { landingRouteFor } from "../model/accounts";
import type { Role } from "../model/types";

/**
 * Client-side only. There is no server session in this demo, so this keeps the
 * wrong role out of the wrong screen but is not a security boundary.
 */
export function RoleGuard({ role, children }: { role: Role; children: React.ReactNode }) {
  const router = useRouter();
  const { session } = useAuth();

  useEffect(() => {
    const current = readStoredSession();
    if (!current) {
      router.replace("/login");
    } else if (current.role !== role) {
      router.replace(landingRouteFor(current.role));
    }
  }, [session, role, router]);

  if (!session || session.role !== role) {
    return (
      <div className="grid min-h-dvh place-items-center px-6">
        <p className="text-sm text-muted">Checking your sign-in…</p>
      </div>
    );
  }

  return <>{children}</>;
}
