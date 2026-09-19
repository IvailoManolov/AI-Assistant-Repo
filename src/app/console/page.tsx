"use client";

import { useState } from "react";

import { BrandMark, Menu, MenuItem } from "@/shared";
import { RoleGuard, useAuth } from "@/features/auth";
import { ConsoleWorkspace, announceSessionsChanged } from "@/features/sessions";
import { OrdersView } from "@/features/orders";

type ResetState = "idle" | "confirming" | "working";

/**
 * What the operator is looking at.
 *
 * Two answers to two different questions. Sessions answers "what happened in
 * this conversation", and carries the transcript, the decision tree and the
 * log. Orders answers "what state is the shop in", and carries none of them:
 * an order has no decisions of its own, and showing an empty tree beside one
 * would be furniture rather than information.
 */
type View = "sessions" | "orders";

const VIEWS: { key: View; label: string }[] = [
  { key: "sessions", label: "Sessions" },
  { key: "orders", label: "Orders" },
];

function ViewToggle({ view, onChange }: { view: View; onChange: (v: View) => void }) {
  return (
    <div
      role="tablist"
      aria-label="Console view"
      className="bg-cream-deep flex items-center gap-0.5 rounded-full p-0.5"
    >
      {VIEWS.map((v) => (
        <button
          key={v.key}
          type="button"
          role="tab"
          aria-selected={view === v.key}
          onClick={() => onChange(v.key)}
          className={`rounded-full px-3.5 py-1.5 text-[12.5px] font-medium transition-colors ${
            view === v.key ? "bg-paper text-ink shadow-sm" : "text-muted hover:text-ink"
          }`}
        >
          {v.label}
        </button>
      ))}
    </div>
  );
}

function OperatorMenu() {
  const { session, signOut } = useAuth();
  const [state, setState] = useState<ResetState>("idle");
  const [result, setResult] = useState<string | null>(null);

  async function reset() {
    setState("working");
    try {
      const response = await fetch("/api/runtime/reset", { method: "POST" });
      if (!response.ok) throw new Error(`Reset returned ${response.status}`);
      const { removed } = (await response.json()) as { removed: number };
      announceSessionsChanged();
      setResult(
        removed === 0
          ? "Nothing to clear. Already at the supplied data."
          : `Cleared ${removed} session${removed === 1 ? "" : "s"}.`,
      );
    } catch {
      setResult("The reset did not go through. Nothing was cleared.");
    } finally {
      setState("idle");
      setTimeout(() => setResult(null), 6000);
    }
  }

  return (
    <div className="flex items-center gap-3">
      {result && (
        <span role="status" className="hidden text-[12px] text-muted sm:inline">
          {result}
        </span>
      )}

      <Menu label={session?.displayName ?? "Operator"} onClose={() => setState("idle")}>
        {(close) =>
          state === "confirming" ? (
            <div className="px-3 py-2.5">
              <p className="text-[12.5px] leading-snug text-ink">
                Clear every session created in this environment?
              </p>
              <p className="mt-1 text-[11.5px] leading-snug text-muted">
                The customers, orders and recorded sessions supplied with the exercise are
                left exactly as they are. This cannot be undone.
              </p>
              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    close();
                    void reset();
                  }}
                  className="bg-danger rounded-full px-3 py-1.5 text-[12.5px] font-semibold text-cream transition-opacity hover:opacity-90"
                >
                  Reset
                </button>
                <button
                  type="button"
                  onClick={() => setState("idle")}
                  className="rounded-full px-3 py-1.5 text-[12.5px] font-medium text-ink-soft transition-colors hover:bg-cream-deep"
                >
                  Keep them
                </button>
              </div>
            </div>
          ) : (
            <>
              <MenuItem onClick={() => setState("confirming")}>
                Reset to default
                <span className="mt-0.5 block text-[11.5px] leading-snug text-muted">
                  Clears sessions created here. Supplied data is untouched.
                </span>
              </MenuItem>
              <div className="my-1 border-t border-line" role="none" />
              <MenuItem onClick={signOut}>Sign out</MenuItem>
            </>
          )
        }
      </Menu>
    </div>
  );
}

function ConsoleChrome() {
  const { session } = useAuth();
  const [view, setView] = useState<View>("sessions");
  const operatorId = session?.username ?? "operator";

  return (
    <div className="bg-cream flex h-dvh flex-col overflow-hidden">
      <header className="bg-paper flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 border-b border-line px-5 py-3.5 sm:px-6">
        <BrandMark />
        <span className="hidden text-[13px] text-muted sm:inline">Operator console</span>
        <div className="ml-auto flex items-center gap-3">
          <ViewToggle view={view} onChange={setView} />
          <OperatorMenu />
        </div>
      </header>

      {view === "sessions" ? (
        <ConsoleWorkspace operatorId={operatorId} />
      ) : (
        <OrdersView operatorId={operatorId} />
      )}
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
