/**
 * Every code the kernel can emit, in one place.
 *
 * Deny codes are internal. A customer never sees one: the composer is handed
 * a decision object that already carries the disclosable wording, and the
 * code stays in the trace and the log. The rule throughout is that a
 * customer-facing failure never carries an internal reason code, and an
 * internal log never omits one.
 */
export const DENY_CODES = [
  /** The agent proposed a tool outside its grant. Stage 1. */
  "capability_violation",
  /** Unknown order, unowned order, or an item that is not on the order. */
  "not_found",
  /** The order has not arrived yet, so there is nothing to refund. R3. */
  "not_yet_delivered",
  /** The order is in a state with no refund path. R3. */
  "not_refundable_status",
  /** More units asked for than the line holds, once prior refunds are counted. R5. */
  "quantity_exceeds_line",
  /** This exact refund already exists and is not rejected. R6. */
  "duplicate_refund",
  /** The order is not in a currency this system settles. R7. */
  "currency_unsupported",
  /** The tool call did not typecheck against its own schema. */
  "invalid_arguments",
  /** The model returned something that is not a valid protocol message. */
  "model_protocol_error",
  /** An operator acted on a refund somebody had already decided. */
  "already_decided",
  /** The conversation's token is unknown, or belongs to another account. */
  "session_invalid",
  /** The order was cancelled. There is nothing to send back. R3. */
  "order_cancelled",
  /** The money never moved, so there is nothing to return. R11. */
  "not_paid",
  /** It arrived too long ago. R12. */
  "refund_window_expired",
] as const;

export type DenyCode = (typeof DENY_CODES)[number];

/**
 * Signals are evidence, never control flow. Nothing branches on one. They
 * exist so the human who does branch has the full picture.
 */
export const SIGNAL_CODES = [
  /** The model put a customer id in the arguments. Overwritten, then logged. */
  "identity_override_attempt",
  /** The customer stated more than the record supports. R8. */
  "claim_exceeds_record",
  /** The customer stated less than the record supports. R8. */
  "claim_below_record",
  /** The model's amount did not match the recomputed one. R4. */
  "amount_mismatch",
  /** The composer put a figure in the text that no decision carried. R10. */
  "output_fidelity_violation",
  /** The amount was above the auto-approval ceiling, so a human was required. R9. */
  "auto_approval_ceiling",
] as const;

export type SignalCode = (typeof SIGNAL_CODES)[number];

/** What the customer is told, by deny code. No code appears in the wording. */
export const CUSTOMER_WORDING: Record<DenyCode, string> = {
  capability_violation: "I could not complete that here.",
  not_found: "No order with that reference is available on this account.",
  not_yet_delivered: "That order has not been delivered yet, so there is nothing to refund on it yet.",
  not_refundable_status: "That order is not in a state where a refund can be raised.",
  quantity_exceeds_line: "That is more units than the order holds for that item.",
  duplicate_refund: "A refund for that item is already open on this order.",
  currency_unsupported: "That order is not in a currency I can refund.",
  invalid_arguments: "I could not complete that here.",
  model_protocol_error: "I could not complete that here.",
  already_decided: "That refund has already been decided.",
  session_invalid: "This conversation has expired. Please start a new one.",
  order_cancelled: "That order was cancelled, so there is nothing to refund on it.",
  not_paid: "That order has not been paid for, so there is nothing to refund.",
  refund_window_expired:
    "That order arrived more than a week ago, which is outside the refund window.",
};
