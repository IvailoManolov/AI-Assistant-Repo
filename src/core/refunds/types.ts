/**
 * The refund record and its lifecycle states.
 *
 * The mock environment deliberately defines none of this, so it is defined
 * here. Three states and nothing more: a system with one operator and one
 * button does not need `pending`, `expired` or partial settlement, and
 * inventing them would be inventing a lifecycle rather than designing one.
 *
 *   held ----approve----> settled
 *     |
 *     +-----reject------> rejected
 */
export type RefundState = "held" | "settled" | "rejected";

/**
 * Something the kernel noticed that a human should see but that did not stop
 * the refund. Signals never gate a branch; they are evidence, not control
 * flow. See rule R8.
 */
export type Signal = {
  code: string;
  detail: string;
  payload?: Record<string, unknown>;
};

/**
 * Amounts are minor units. `modelCertainty` is the number the model stated,
 * carried for display only: no rule reads it, by decision D6.
 */
export type RefundRecord = {
  id: string;
  sessionId: string;
  customerId: string;
  orderId: string;
  itemId: string;
  itemName: string;
  quantity: number;
  amountMinor: number;
  currency: string;
  reasonCode: RefundReason;
  state: RefundState;
  signals: Signal[];
  modelCertainty: number;
  proposedAt: string;
  decidedAt: string | null;
  decidedBy: string | null;
};

/**
 * A fixed list. No free-text reason reaches the record, so the set of things
 * a refund can be for stays countable and reportable.
 */
export const REFUND_REASONS = [
  "damaged_on_arrival",
  "return_received",
  "not_as_described",
  "unspecified",
] as const;

export type RefundReason = (typeof REFUND_REASONS)[number];

export const isRefundReason = (value: unknown): value is RefundReason =>
  typeof value === "string" && (REFUND_REASONS as readonly string[]).includes(value);
