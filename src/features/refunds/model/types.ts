/**
 * The console's view of a refund record.
 *
 * Mirrors what `/api/refunds` sends. Amounts stay in minor units all the way
 * to the component that formats them, so nothing between here and the screen
 * can round.
 */
export type RefundState = "held" | "settled" | "rejected";

export type RefundSignal = {
  code: string;
  detail: string;
  payload?: Record<string, unknown>;
};

export type OperatorRefund = {
  id: string;
  sessionId: string;
  customerId: string;
  orderId: string;
  itemId: string;
  itemName: string;
  quantity: number;
  amountMinor: number;
  currency: string;
  reasonCode: string;
  state: RefundState;
  signals: RefundSignal[];
  modelCertainty: number;
  proposedAt: string;
  decidedAt: string | null;
  decidedBy: string | null;
};

export const REASON_LABEL: Record<string, string> = {
  damaged_on_arrival: "Arrived damaged",
  return_received: "Return received",
  not_as_described: "Not as described",
  unspecified: "Not stated",
};

/**
 * What each signal is telling the operator, in a sentence they can act on.
 *
 * Signals never block anything, so this is the entire point of them: a person
 * reads this and decides. Anything the kernel can decide on its own is a rule,
 * not a signal, and never reaches this table.
 */
export const SIGNAL_LABEL: Record<string, string> = {
  claim_exceeds_record: "The customer asked for more than the order supports.",
  claim_below_record: "The customer asked for less than the order supports.",
  amount_mismatch: "The assistant proposed the wrong figure and was corrected.",
  identity_override_attempt: "The model tried to name a different account.",
  auto_approval_ceiling: "Above the automatic ceiling, so it needs you.",
  capability_violation: "An agent reached for a tool it does not hold.",
  session_invalid: "The conversation's token did not check out.",
};
