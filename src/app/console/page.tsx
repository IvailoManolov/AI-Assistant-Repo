"use client";

import { useState } from "react";
import Link from "next/link";
import { LogOut } from "lucide-react";
import { RoleGuard } from "@/components/role-guard";
import { DecisionTree } from "@/components/decision-tree";
import { LogView } from "@/components/log-view";
import { useAuth } from "@/lib/auth-context";
import { SESSIONS, type AgentSession, type DecisionStatus } from "@/lib/sessions";

const OUTCOME_DOT: Record<DecisionStatus, string> = {
  ok: "bg-green",
  hold: "bg-amber",
  blocked: "bg-danger",
  skipped: "bg-console-muted",
  info: "bg-console-muted",
};

function clock(iso: string) {
  return new Date(iso).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  });
}

function SessionRail({
  selected,
  onSelect,
}: {
  selected: AgentSession;
  onSelect: (s: AgentSession) => void;
}) {
  return (
    <nav aria-label="Sessions" className="console-scroll h-full overflow-y-auto">
      <div className="sticky top-0 bg-console-panel px-4 py-3">
        <h2 className="text-[13px] font-semibold text-console-text">Sessions</h2>
        <p className="mt-0.5 text-[11px] text-console-muted">
          {SESSIONS.length} recorded today
        </p>
      </div>
      <ul>
        {SESSIONS.map((s) => {
          const active = s.id === selected.id;
          return (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => onSelect(s)}
                aria-current={active ? "true" : undefined}
                className={`block w-full border-l-2 px-4 py-3 text-left transition-colors ${
                  active
                    ? "border-coral bg-console-raised"
                    : "border-transparent hover:bg-console-raised/50"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className={`size-1.5 shrink-0 rounded-full ${OUTCOME_DOT[s.outcome]}`} aria-hidden />
                  <span className="font-mono text-[12px] text-console-text">{s.id}</span>
                  <span className="ml-auto font-mono text-[11px] text-console-muted tabular-nums">
                    {clock(s.startedAt)}
                  </span>
                </div>
                <p className="mt-1 text-[12px] leading-snug text-console-muted">
                  {s.summary}
                </p>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function Transcript({ session }: { session: AgentSession }) {
  return (
    <div className="console-scroll h-full overflow-y-auto px-4 py-4 sm:px-5">
      <div className="mb-4">
        <h2 className="text-[13px] font-semibold text-console-text">Transcript</h2>
        <p className="mt-0.5 text-[11px] text-console-muted">
          {session.customer}, signed in as{" "}
          <span className="font-mono">{session.customerId}</span>
        </p>
      </div>
      <ol className="space-y-3">
        {session.turns.map((turn) => {
          if (turn.role === "system") {
            return (
              <li
                key={turn.id}
                className="rounded-md border border-dashed border-console-line px-3 py-2 font-mono text-[11.5px] leading-relaxed text-console-muted"
              >
                {turn.text}
              </li>
            );
          }
          const isCustomer = turn.role === "customer";
          return (
            <li
              key={turn.id}
              className={`max-w-[92%] rounded-xl px-3.5 py-2.5 text-[13px] leading-relaxed ${
                isCustomer
                  ? "ml-auto bg-console-raised text-console-text"
                  : "bg-coral/12 text-console-text ring-1 ring-coral/25"
              }`}
            >
              <div className="mb-1 flex items-baseline gap-2">
                <span className="text-[11px] font-semibold text-console-muted">
                  {isCustomer ? session.customer : "Assistant"}
                </span>
                <span className="font-mono text-[10.5px] text-console-muted tabular-nums">
                  {turn.at}
                </span>
              </div>
              {turn.text}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

type InspectorTab = "decisions" | "logs";

function Inspector({
  session,
  tab,
  setTab,
}: {
  session: AgentSession;
  tab: InspectorTab;
  setTab: (t: InspectorTab) => void;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="hidden items-center gap-1 border-b border-console-line px-4 py-2.5 sm:px-5 lg:flex">
        {(["decisions", "logs"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            aria-current={tab === t ? "true" : undefined}
            className={`rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors ${
              tab === t
                ? "bg-console-raised text-console-text"
                : "text-console-muted hover:text-console-text"
            }`}
          >
            {t === "decisions" ? "Decision tree" : "Server log"}
          </button>
        ))}
        <span className="ml-auto font-mono text-[11px] text-console-muted tabular-nums">
          {(session.durationMs / 1000).toFixed(2)}s
        </span>
      </div>

      <div className="console-scroll min-h-0 grow overflow-y-auto px-4 py-4 sm:px-5">
        {tab === "decisions" ? (
          <DecisionTree key={session.id} nodes={session.tree} />
        ) : (
          <LogView logs={session.logs} />
        )}
      </div>
    </div>
  );
}

function ConsoleBody() {
  const { session: auth, signOut } = useAuth();
  const [selected, setSelected] = useState<AgentSession>(SESSIONS[0]);
  const [tab, setTab] = useState<InspectorTab>("decisions");
  const [mobilePane, setMobilePane] = useState<"transcript" | "inspector">("transcript");

  return (
    <div className="bg-console text-console-text flex min-h-dvh flex-col">
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-console-line px-5 py-3.5 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="size-3 rounded-full bg-coral" aria-hidden />
          <span className="font-display text-lg font-bold text-console-text">Kiln</span>
        </Link>
        <span className="text-[13px] text-console-muted">Operator console</span>
        <div className="ml-auto flex items-center gap-3">
          <span className="hidden text-[13px] text-console-muted sm:inline">
            {auth?.displayName}
          </span>
          <button
            type="button"
            onClick={signOut}
            className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-medium text-console-muted transition-colors hover:text-coral"
          >
            <LogOut className="size-3.5" strokeWidth={2.2} />
            Sign out
          </button>
        </div>
      </header>

      {/* Mobile: the rail becomes a horizontal strip and the two right panes
          become tabs, so one thing is readable at a time. */}
      <div className="console-scroll flex gap-2 overflow-x-auto border-b border-console-line px-4 py-2.5 lg:hidden">
        {SESSIONS.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setSelected(s)}
            aria-current={s.id === selected.id ? "true" : undefined}
            className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 font-mono text-[12px] transition-colors ${
              s.id === selected.id
                ? "bg-console-raised text-console-text ring-1 ring-coral/40"
                : "text-console-muted hover:text-console-text"
            }`}
          >
            <span className={`size-1.5 rounded-full ${OUTCOME_DOT[s.outcome]}`} aria-hidden />
            {s.id}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-1 border-b border-console-line px-4 py-2 lg:hidden">
        {(
          [
            { key: "transcript", label: "Transcript" },
            { key: "decisions", label: "Decision tree" },
            { key: "logs", label: "Server log" },
          ] as const
        ).map((p) => {
          const active =
            p.key === "transcript"
              ? mobilePane === "transcript"
              : mobilePane === "inspector" && tab === p.key;
          return (
            <button
              key={p.key}
              type="button"
              onClick={() => {
                if (p.key === "transcript") {
                  setMobilePane("transcript");
                } else {
                  setMobilePane("inspector");
                  setTab(p.key);
                }
              }}
              aria-current={active ? "true" : undefined}
              className={`rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors ${
                active
                  ? "bg-console-raised text-console-text"
                  : "text-console-muted hover:text-console-text"
              }`}
            >
              {p.label}
            </button>
          );
        })}
      </div>

      <div className="grid min-h-0 grow lg:grid-cols-[17rem_minmax(0,1fr)_minmax(0,1.15fr)]">
        <div className="hidden border-r border-console-line bg-console-panel lg:block">
          <SessionRail selected={selected} onSelect={setSelected} />
        </div>

        <div
          className={`min-h-0 border-r border-console-line bg-console-panel ${
            mobilePane === "transcript" ? "block" : "hidden"
          } lg:block`}
        >
          <Transcript session={selected} />
        </div>

        <div className={`min-h-0 ${mobilePane === "inspector" ? "block" : "hidden"} lg:block`}>
          <Inspector session={selected} tab={tab} setTab={setTab} />
        </div>
      </div>
    </div>
  );
}

export default function ConsolePage() {
  return (
    <RoleGuard role="admin">
      <ConsoleBody />
    </RoleGuard>
  );
}
