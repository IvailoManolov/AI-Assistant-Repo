/**
 * The operator's decision, and everything that follows from it.
 *
 * `decideRefund` in the kernel is the decision. This is the decision plus its
 * consequences: the session that raised the refund stops waiting on a person
 * and goes green.
 *
 * It sits here rather than in the HTTP route because the console is not the
 * only way a refund can be decided, and rather than in the kernel because the
 * kernel must not know that sessions exist. The kernel decides; this records
 * what the decision meant for the conversation it came from.
 *
 * No money moves. Settling a refund marks the record settled and leaves the
 * wallet alone, which is stated plainly rather than hidden: the payment rail
 * is out of scope and pretending otherwise would be the one lie in a system
 * built to be auditable.
 */
import { decideRefund, type ApprovalResult } from "../kernel/approval.ts";
import { formatMinor } from "../money.ts";
import { completeSession } from "../sessions/store.ts";
import type { Decision } from "./lifecycle.ts";

export type SettlementResult = ApprovalResult & {
  /** Whether the session that raised it was closed off as a result. */
  sessionCompleted: boolean;
};

export function settleRefund(input: {
  refundId: string;
  decision: Decision;
  operatorId: string;
}): SettlementResult {
  const result = decideRefund(input);
  if (!result.ok) return { ...result, sessionCompleted: false };

  const record = result.record;
  const amount = formatMinor(record.amountMinor, record.currency);
  const note =
    record.state === "settled"
      ? `${input.operatorId} approved ${record.id} for ${amount} on ${record.orderId}. No money has moved: settlement is out of scope.`
      : `${input.operatorId} rejected ${record.id} on ${record.orderId}. Nothing was paid.`;

  const session = completeSession(record.sessionId, note);
  return { ...result, sessionCompleted: session !== undefined };
}
