"use client";

import { NotificationBadge } from "@/shared";

import { LIFECYCLE_STANDING, STATUS_STANDING, type AgentSession } from "../model/types";
import { StatusMarker } from "./status-marker";

/** Session times are the run's own UTC stamps, matching the transcript. */
export function clock(iso: string) {
  return new Date(iso).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  });
}

/**
 * At most one badge per row, in order of how much it wants the operator.
 * A row that carries three competing marks tells them nothing.
 */
function rowBadge(session: AgentSession, unread: boolean) {
  if (session.lifecycle === "closed_inactive") {
    return <NotificationBadge tone="alert" label={LIFECYCLE_STANDING.closed_inactive} />;
  }
  if (session.outcome === "hold") {
    return <NotificationBadge tone="attention" label={STATUS_STANDING.hold} />;
  }
  if (session.lifecycle === "active" && unread) {
    return <NotificationBadge tone="info" label="New session. You have not opened it yet." />;
  }
  return null;
}

export function SessionRail({
  sessions,
  selectedId,
  onSelect,
  unreadIds,
  unreadCount,
}: {
  sessions: AgentSession[];
  selectedId: string | null;
  onSelect: (s: AgentSession) => void;
  unreadIds: string[];
  unreadCount: number;
}) {
  const liveCount = sessions.filter((s) => s.lifecycle === "active").length;

  return (
    <nav aria-label="Sessions" className="thin-scroll h-full overflow-y-auto">
      <div className="bg-cream-deep sticky top-0 z-10 px-4 py-3">
        <div className="flex items-center gap-2">
          <h2 className="text-[13px] font-semibold">Sessions</h2>
          <NotificationBadge
            count={unreadCount}
            tone="info"
            live
            label={`${unreadCount} new session${unreadCount === 1 ? "" : "s"} you have not opened`}
          />
        </div>
        <p className="mt-0.5 text-[11px] text-muted">
          {sessions.length} in all, {liveCount} live
        </p>
      </div>
      <ul>
        {sessions.map((s) => {
          const active = s.id === selectedId;
          const unread = unreadIds.includes(s.id);
          return (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => onSelect(s)}
                aria-current={active ? "true" : undefined}
                aria-label={`${s.id} at ${clock(s.startedAt)}. ${LIFECYCLE_STANDING[s.lifecycle]} ${
                  STATUS_STANDING[s.outcome]
                } ${s.summary}`}
                className={`block w-full border-l-2 px-4 py-3 text-left transition-colors ${
                  active ? "border-coral bg-paper" : "border-transparent hover:bg-paper/70"
                }`}
              >
                <span className="flex items-center gap-2">
                  <StatusMarker status={s.outcome} />
                  <span className="font-mono text-[12px]">{s.id}</span>
                  {rowBadge(s, unread)}
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
