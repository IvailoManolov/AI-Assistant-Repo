export type DecisionStatus = "ok" | "hold" | "blocked" | "skipped" | "info";

export type NodeKind = "intent" | "model" | "tool" | "policy" | "outcome";

export type DecisionNode = {
  id: string;
  kind: NodeKind;
  label: string;
  detail: string;
  status: DecisionStatus;
  ms: number;
  /** Machine payload, rendered in mono and collapsed by default. */
  payload?: Record<string, unknown>;
  children?: DecisionNode[];
};

export type Turn = {
  id: string;
  role: "customer" | "assistant" | "system";
  at: string;
  text: string;
};

export type LogLine = {
  at: string;
  level: "debug" | "info" | "warn" | "error";
  scope: string;
  message: string;
};

export type AgentSession = {
  id: string;
  customer: string;
  customerId: string;
  startedAt: string;
  durationMs: number;
  /** One-line answer to "what happened here", for the sessions rail. */
  summary: string;
  outcome: DecisionStatus;
  turns: Turn[];
  tree: DecisionNode[];
  logs: LogLine[];
};

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
