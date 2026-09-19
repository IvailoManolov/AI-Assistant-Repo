"use client";

import { SESSIONS } from "../data/sessions.fixtures";
import { STATUS_STANDING, type AgentSession } from "../model/types";
import { StatusMarker } from "./status-marker";

/** Session times are the run's own UTC stamps, matching the transcript. */
export function clock(iso: string) {
  return new Date(iso).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  });
}

export function SessionRail({
  selected,
  onSelect,
}: {
  selected: AgentSession;
  onSelect: (s: AgentSession) => void;
}) {
  return (
    <nav aria-label="Sessions" className="thin-scroll h-full overflow-y-auto">
      <div className="bg-cream-deep sticky top-0 px-4 py-3">
        <h2 className="text-[13px] font-semibold">Sessions</h2>
        <p className="mt-0.5 text-[11px] text-muted">{SESSIONS.length} recorded today</p>
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
                aria-label={`${s.id} at ${clock(s.startedAt)}. ${STATUS_STANDING[s.outcome]} ${s.summary}`}
                className={`block w-full border-l-2 px-4 py-3 text-left transition-colors ${
                  active ? "border-coral bg-paper" : "border-transparent hover:bg-paper/70"
                }`}
              >
                <span className="flex items-center gap-2">
                  <StatusMarker status={s.outcome} />
                  <span className="font-mono text-[12px]">{s.id}</span>
                  <span className="ml-auto font-mono text-[11px] text-muted tabular-nums">
                    {clock(s.startedAt)}
                  </span>
                </span>
                <span className="mt-1 block text-[12px] leading-snug text-muted">{s.summary}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
