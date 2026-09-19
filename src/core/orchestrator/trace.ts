/**
 * Turning kernel output into the tree the operator reads.
 *
 * The trace is not a debug artifact bolted on afterwards. Every stage of the
 * kernel emits an entry whether it passed or failed, and this module gives
 * each one an id and a duration. A reviewer watching the console sees the
 * checks that succeeded as well as the one that stopped things, which is the
 * only way to tell a system that decided from a system that never looked.
 */
import type { TraceEntry } from "../kernel/kernel.ts";
import { newId } from "../runtime/ids.ts";
import { stamp } from "../runtime/clock.ts";
import type { DecisionNode, DecisionStatus, LogLine, NodeKind } from "../sessions/types.ts";

const KIND_BY_PREFIX: { match: RegExp; kind: NodeKind }[] = [
  { match: /^Proposal/, kind: "model" },
  { match: /^Capability|^Auth binding/, kind: "policy" },
  { match: /^R\d+/, kind: "policy" },
  { match: /^Handler|^get_order|^get_orders|^propose_refund/, kind: "tool" },
  { match: /^Session check|^check_session/, kind: "policy" },
  { match: /^Operator action|^Routing|^Confirmation|^Triage/, kind: "outcome" },
];

const kindOf = (label: string): NodeKind =>
  KIND_BY_PREFIX.find((row) => row.match.test(label))?.kind ?? "outcome";

export const toNode = (entry: TraceEntry, ms = 0): DecisionNode => ({
  id: newId("NODE"),
  kind: kindOf(entry.label),
  label: entry.label,
  detail: entry.detail,
  status: entry.status,
  ms,
  ...(entry.payload ? { payload: entry.payload } : {}),
});

/** One parent per agent, so the tree reads as the pipeline that produced it. */
export function agentNode(input: {
  label: string;
  detail: string;
  status: DecisionStatus;
  ms: number;
  entries: readonly TraceEntry[];
}): DecisionNode {
  return {
    id: newId("NODE"),
    kind: "intent",
    label: input.label,
    detail: input.detail,
    status: input.status,
    ms: input.ms,
    children: input.entries.map((entry) => toNode(entry)),
  };
}

/**
 * The log is the same events as the tree, flattened and timestamped. Two
 * renderings of one history rather than two histories that have to agree.
 *
 * Every line the pipeline emits is info, deliberately. The log answers "what
 * did the system do in this session", and a level that varies with the outcome
 * makes it harder to read a session end to end: half the story disappears
 * behind a filter at exactly the moment somebody is trying to follow it. How
 * serious a step was is already in the decision tree, in colour, where it
 * belongs. The store keeps one exception, the warn it raises when a session
 * closes itself through inactivity, because that one is about the
 * conversation rather than about the work.
 */
export const toLogLine = (sessionId: string, scope: string, entry: TraceEntry): LogLine => ({
  at: stamp(),
  level: "info",
  scope,
  message: `${entry.label}: ${entry.detail}`,
  sessionId,
});
