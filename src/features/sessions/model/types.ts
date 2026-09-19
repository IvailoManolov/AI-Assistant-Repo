/**
 * The console's view of the session domain. The types themselves live in core
 * because the store writes them; this module adds the words the operator
 * reads.
 */
import type { DecisionStatus, SessionLifecycle } from "@/core/sessions/types";

export type {
  AgentSession,
  DecisionNode,
  DecisionStatus,
  LogLine,
  NodeKind,
  SessionLifecycle,
  Turn,
} from "@/core/sessions/types";

export const STATUS_LABEL: Record<DecisionStatus, string> = {
  ok: "Passed",
  hold: "Held",
  blocked: "Blocked",
  skipped: "Skipped",
  info: "Noted",
};

/**
 * Where a session sits from the operator's point of view. This is the tooltip
 * on the status marker in the rail: it answers "does this one need me?".
 */
export const STATUS_STANDING: Record<DecisionStatus, string> = {
  ok: "Closed. The assistant finished and nothing here needs you.",
  hold: "Waiting on you. An action is drafted but has not been applied.",
  blocked: "Refused. The assistant stopped before it acted.",
  skipped: "Not run. An earlier step ruled this one out.",
  info: "Noted. No action either way.",
};

/** The conversation's own standing, which is a different thing from its outcome. */
export const LIFECYCLE_STANDING: Record<SessionLifecycle, string> = {
  active: "Live. The customer is in this conversation right now.",
  closed: "Finished. The conversation ran to an end.",
  closed_inactive: "Closed by inactivity. Five minutes of silence and nobody picked it up.",
};
