"use client";

import { useEffect, useMemo, useState } from "react";

import { NotificationBadge, useUnread } from "@/shared";
import { RefundBanner, RefundReview, type OperatorRefund } from "@/features/refunds";

import { SESSIONS_CHANGED, announceSessionsChanged } from "../model/events";
import { LIFECYCLE_STANDING, type AgentSession } from "../model/types";
import { DecisionTree } from "./decision-tree";
import { LogView } from "./log-view";
import { SessionRail } from "./session-rail";
import { StatusMarker } from "./status-marker";
import { Transcript } from "./transcript";

type InspectorTab = "decisions" | "logs";

/** Stable across renders so the unread set is not rebuilt on every poll. */
const idOf = (session: AgentSession) => session.id;

const POLL_MS = 3000;

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
      <div className="hidden shrink-0 items-center gap-1 border-b border-line px-4 py-2.5 sm:px-5 lg:flex">
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

      <div className="min-h-0 grow overflow-hidden">
        {tab === "decisions" ? (
          <div className="thin-scroll h-full overflow-y-auto px-4 py-4 sm:px-5">
            {session.tree.length > 0 ? (
              <DecisionTree key={session.id} nodes={session.tree} />
            ) : (
              <p className="pane-in max-w-[52ch] text-[13px] leading-relaxed text-muted">
                No decisions recorded. This session reached Robby before the agent
                pipeline was connected, so there is a transcript and a log but nothing to
                trace yet.
              </p>
            )}
          </div>
        ) : (
          <LogView logs={session.logs} sessionId={session.id} />
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

export function ConsoleWorkspace({ operatorId }: { operatorId: string }) {
  const [sessions, setSessions] = useState<AgentSession[]>([]);
  const [refunds, setRefunds] = useState<OperatorRefund[]>([]);
  const [reviewing, setReviewing] = useState<OperatorRefund | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tab, setTab] = useState<InspectorTab>("decisions");
  const [mobilePane, setMobilePane] = useState<"transcript" | "inspector">("transcript");
  const [feedError, setFeedError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let live = true;

    async function poll() {
      try {
        /**
         * Sessions and refunds together, because a session that raised one is
         * incomplete without it and two polls out of step would show a banner
         * for a refund that had already been decided.
         */
        const [sessionFeed, refundFeed] = await Promise.all([
          fetch("/api/sessions", { cache: "no-store" }),
          fetch(`/api/refunds?operatorId=${encodeURIComponent(operatorId)}`, { cache: "no-store" }),
        ]);
        if (!sessionFeed.ok) throw new Error(`Feed returned ${sessionFeed.status}`);

        const body = (await sessionFeed.json()) as { sessions: AgentSession[] };
        if (!live) return;
        setSessions(body.sessions);

        if (refundFeed.ok) {
          const held = (await refundFeed.json()) as { refunds: OperatorRefund[] };
          if (live) setRefunds(held.refunds);
        }

        setFeedError(null);
        setLoaded(true);
      } catch {
        if (live) setFeedError("The session feed is unreachable. Still trying.");
      }
    }

    void poll();
    const timer = setInterval(() => void poll(), POLL_MS);

    // A reset should show up straight away, not on the next tick.
    const onChanged = () => void poll();
    window.addEventListener(SESSIONS_CHANGED, onChanged);

    return () => {
      live = false;
      clearInterval(timer);
      window.removeEventListener(SESSIONS_CHANGED, onChanged);
    };
  }, [operatorId]);

  /**
   * Only live sessions can be new to the operator. Anything already closed
   * when the console opened is history, not a thing to chase.
   */
  const liveSessions = useMemo(() => sessions.filter((s) => s.lifecycle === "active"), [sessions]);
  const { unreadIds, markSeen } = useUnread(liveSessions, idOf);

  const selected = sessions.find((s) => s.id === selectedId) ?? sessions[0];

  /**
   * Whatever is on screen is not something the operator still has to be
   * chased about, including the newest session that is shown by default
   * before they have clicked anything.
   */
  const pendingIds = useMemo(
    () => unreadIds.filter((id) => id !== selected?.id),
    [unreadIds, selected?.id],
  );

  /** At most one refund per session in this system, so the first is the one. */
  const sessionRefund = refunds.find((r) => r.sessionId === selected?.id) ?? null;

  function review(refund: OperatorRefund) {
    setReviewing(refund);
    setReviewOpen(true);
  }

  function select(session: AgentSession) {
    // Leaving a session settles it for good, not just while it is open.
    if (selected) markSeen(selected.id);
    markSeen(session.id);
    setSelectedId(session.id);
  }

  if (!loaded || !selected) {
    return (
      <div className="flex grow items-center justify-center px-6 py-16">
        <p className="max-w-[46ch] text-center text-[13px] leading-relaxed text-muted">
          {feedError ??
            (loaded
              ? "No sessions yet. One opens the moment a customer sends their first message to Robby."
              : "Loading sessions.")}
        </p>
      </div>
    );
  }

  return (
    <>
      {feedError && (
        <p className="bg-danger-soft shrink-0 border-b border-line px-4 py-2 text-[12px] text-danger">
          {feedError}
        </p>
      )}

      {/* Mobile: the rail becomes a horizontal strip and the three views
          become one flat row of tabs, so one thing is readable at a time. */}
      <div className="thin-scroll flex shrink-0 gap-2 overflow-x-auto overflow-y-hidden border-b border-line px-4 py-2.5 lg:hidden">
        {sessions.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => select(s)}
            aria-current={s.id === selected.id ? "true" : undefined}
            aria-label={`${s.id}. ${LIFECYCLE_STANDING[s.lifecycle]}`}
            className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 font-mono text-[12px] transition-colors ${
              s.id === selected.id
                ? "bg-paper text-ink ring-1 ring-coral/45"
                : "text-muted hover:text-ink"
            }`}
          >
            <StatusMarker status={s.outcome} align="center" />
            {s.id}
            {s.lifecycle === "closed_inactive" && (
              <NotificationBadge tone="alert" label={LIFECYCLE_STANDING.closed_inactive} />
            )}
            {s.lifecycle === "active" && pendingIds.includes(s.id) && (
              <NotificationBadge tone="info" label="New session you have not opened." />
            )}
          </button>
        ))}
      </div>

      <div className="flex shrink-0 items-center gap-1 border-b border-line px-4 py-2 lg:hidden">
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

      <div className="grid min-h-0 grow overflow-hidden lg:grid-cols-[17rem_minmax(0,1fr)_minmax(0,1.15fr)]">
        <div className="bg-cream-deep hidden min-h-0 overflow-hidden border-r border-line lg:block">
          <SessionRail
            sessions={sessions}
            selectedId={selected.id}
            onSelect={select}
            unreadIds={pendingIds}
            unreadCount={pendingIds.length}
          />
        </div>

        <div
          className={`bg-paper min-h-0 overflow-hidden border-r border-line ${
            mobilePane === "transcript" ? "block" : "hidden"
          } lg:block`}
        >
          <div className="flex h-full min-h-0 flex-col">
            {sessionRefund && (
              <RefundBanner refund={sessionRefund} onOpen={() => review(sessionRefund)} />
            )}
            <div className="min-h-0 grow overflow-hidden">
              <Transcript key={selected.id} session={selected} />
            </div>
          </div>
        </div>

        <div
          className={`bg-paper min-h-0 overflow-hidden ${
            mobilePane === "inspector" ? "block" : "hidden"
          } lg:block`}
        >
          <Inspector session={selected} tab={tab} setTab={setTab} />
        </div>
      </div>

      <RefundReview
        refund={reviewing}
        operatorId={operatorId}
        open={reviewOpen}
        onClose={() => setReviewOpen(false)}
        onDecided={() => announceSessionsChanged()}
      />
    </>
  );
}
