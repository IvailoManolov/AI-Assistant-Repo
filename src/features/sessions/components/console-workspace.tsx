"use client";

import { useState } from "react";
import { SESSIONS } from "../data/sessions.fixtures";
import { STATUS_STANDING, type AgentSession } from "../model/types";
import { DecisionTree } from "./decision-tree";
import { LogView } from "./log-view";
import { SessionRail } from "./session-rail";
import { StatusMarker } from "./status-marker";
import { Transcript } from "./transcript";

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
      <div className="hidden items-center gap-1 border-b border-line px-4 py-2.5 sm:px-5 lg:flex">
        {(["decisions", "logs"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            aria-current={tab === t ? "true" : undefined}
            className={`rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors ${
              tab === t ? "bg-cream-deep text-ink" : "text-muted hover:text-ink"
            }`}
          >
            {t === "decisions" ? "Decision tree" : "Server log"}
          </button>
        ))}
        <span className="ml-auto font-mono text-[11px] text-muted tabular-nums">
          {(session.durationMs / 1000).toFixed(2)}s
        </span>
      </div>

      <div className="thin-scroll min-h-0 grow overflow-y-auto px-4 py-4 sm:px-5">
        {tab === "decisions" ? (
          <DecisionTree key={session.id} nodes={session.tree} />
        ) : (
          <LogView logs={session.logs} />
        )}
      </div>
    </div>
  );
}

const MOBILE_TABS = [
  { key: "transcript", label: "Transcript" },
  { key: "decisions", label: "Decision tree" },
  { key: "logs", label: "Server log" },
] as const;

export function ConsoleWorkspace() {
  const [selected, setSelected] = useState<AgentSession>(SESSIONS[0]);
  const [tab, setTab] = useState<InspectorTab>("decisions");
  const [mobilePane, setMobilePane] = useState<"transcript" | "inspector">("transcript");

  return (
    <>
      {/* Mobile: the rail becomes a horizontal strip and the three views
          become one flat row of tabs, so one thing is readable at a time. */}
      <div className="thin-scroll flex gap-2 overflow-x-auto border-b border-line px-4 py-2.5 lg:hidden">
        {SESSIONS.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setSelected(s)}
            aria-current={s.id === selected.id ? "true" : undefined}
            aria-label={`${s.id}. ${STATUS_STANDING[s.outcome]}`}
            className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 font-mono text-[12px] transition-colors ${
              s.id === selected.id
                ? "bg-paper text-ink ring-1 ring-coral/45"
                : "text-muted hover:text-ink"
            }`}
          >
            <StatusMarker status={s.outcome} align="center" />
            {s.id}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-1 border-b border-line px-4 py-2 lg:hidden">
        {MOBILE_TABS.map((p) => {
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
                active ? "bg-cream-deep text-ink" : "text-muted hover:text-ink"
              }`}
            >
              {p.label}
            </button>
          );
        })}
      </div>

      <div className="grid min-h-0 grow lg:grid-cols-[17rem_minmax(0,1fr)_minmax(0,1.15fr)]">
        <div className="bg-cream-deep hidden border-r border-line lg:block">
          <SessionRail selected={selected} onSelect={setSelected} />
        </div>

        <div
          className={`bg-paper min-h-0 border-r border-line ${
            mobilePane === "transcript" ? "block" : "hidden"
          } lg:block`}
        >
          <Transcript session={selected} />
        </div>

        <div className={`bg-paper min-h-0 ${mobilePane === "inspector" ? "block" : "hidden"} lg:block`}>
          <Inspector session={selected} tab={tab} setTab={setTab} />
        </div>
      </div>
    </>
  );
}
