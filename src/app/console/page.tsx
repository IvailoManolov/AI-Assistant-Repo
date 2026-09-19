"use client";

import { LogOut } from "lucide-react";
import { BrandMark } from "@/shared";
import { RoleGuard, useAuth } from "@/features/auth";
import { ConsoleWorkspace } from "@/features/sessions";

function ConsoleChrome() {
  const { session, signOut } = useAuth();

  return (
    <div className="bg-cream flex min-h-dvh flex-col">
      <header className="bg-paper flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line px-5 py-3.5 sm:px-6">
        <BrandMark />
        <span className="text-[13px] text-muted">Operator console</span>
        <div className="ml-auto flex items-center gap-3">
          <span className="hidden text-[13px] text-muted sm:inline">{session?.displayName}</span>
          <button
            type="button"
            onClick={signOut}
            className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-medium text-ink-soft transition-colors hover:text-coral-deep"
          >
            <LogOut className="size-3.5" strokeWidth={2.2} />
            Sign out
          </button>
        </div>
      </header>

      <ConsoleWorkspace />
    </div>
  );
}

export default function ConsolePage() {
  return (
    <RoleGuard role="admin">
      <ConsoleChrome />
    </RoleGuard>
  );
}
