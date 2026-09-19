/**
 * Refund state transitions, as pure functions.
 *
 * Nothing here reads or writes storage. The kernel calls these to work out
 * what the next record should be, and the guard is what puts it away, so a
 * transition is testable without a store and a write is never implicit in a
 * decision.
 */
import type { RefundRecord } from "./types.ts";

export type Decision = "approve" | "reject";

export type TransitionResult =
  | { ok: true; record: RefundRecord }
  | { ok: false; code: "already_decided"; record: RefundRecord };

/**
 * Two operators clicking the same held refund is not a race to win. The
 * second one is told the thing was already decided and by whom, rather than
 * silently overwriting the first decision.
 */
export function decide(
  record: RefundRecord,
  decision: Decision,
  operatorId: string,
  at: string,
): TransitionResult {
  if (record.state !== "held") return { ok: false, code: "already_decided", record };

  return {
    ok: true,
    record: {
      ...record,
      state: decision === "approve" ? "settled" : "rejected",
      decidedAt: at,
      decidedBy: operatorId,
    },
  };
}

export const isOpen = (record: RefundRecord): boolean => record.state === "held";

/**
 * A refund that still counts against a line for duplicate purposes. A
 * rejected one does not: rejecting a claim has to leave the customer able to
 * make a corrected one.
 */
export const isBinding = (record: RefundRecord): boolean => record.state !== "rejected";
