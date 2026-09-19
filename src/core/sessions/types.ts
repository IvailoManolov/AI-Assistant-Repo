/**
 * Session domain types.
 *
 * These live in core rather than in the UI feature because the store writes
 * them and the console only reads them. The feature re-exports what it needs.
 */
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

/**
 * Every line belongs to a session. Logs are stored on the session they came
 * from, so there is no global stream to correlate against afterwards.
 */
export type LogLine = {
  at: string;
  level: "debug" | "info" | "warn" | "error";
  scope: string;
  message: string;
  sessionId: string;
};

/**
 * Where a session stands as a conversation, which is a different question
 * from `outcome`, which is what the assistant decided.
 *
 * `closed_inactive` is the only one the operator is chased about: it means the
 * customer walked away mid-conversation and nobody picked it up.
 */
export type SessionLifecycle = "active" | "closed" | "closed_inactive";

export type AgentSession = {
  id: string;
  customer: string;
  customerId: string;
  startedAt: string;
  lastActivityAt: string;
  lifecycle: SessionLifecycle;
  durationMs: number;
  /** One-line answer to "what happened here", for the sessions rail. */
  summary: string;
  outcome: DecisionStatus;
  turns: Turn[];
  tree: DecisionNode[];
  logs: LogLine[];
};

/** A hand-written session, before the store stamps session ids onto its logs. */
export type RecordedSession = Omit<AgentSession, "logs" | "lifecycle" | "lastActivityAt"> & {
  logs: Omit<LogLine, "sessionId">[];
};
