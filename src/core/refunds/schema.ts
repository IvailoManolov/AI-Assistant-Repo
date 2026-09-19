/**
 * The refund schema.
 *
 * Two separate things live here, and keeping them apart matters:
 *
 *   1. The **shape** a refund request must have before anything will look at
 *      it. A request that does not name a customer, an order, a line and a
 *      quantity is not a refund the system refused; it is not a refund request
 *      at all, and it is rejected without a policy decision being recorded.
 *
 *   2. The **policy constants** the rules are written against, in one place so
 *      that changing the refund window is a one-line change with one obvious
 *      blast radius rather than a search for the number seven.
 *
 * The rules themselves are in `core/kernel/rules.ts`, because the kernel is
 * what evaluates them. This file is what they are evaluated against.
 */
import { isRefundReason, type RefundReason } from "./types.ts";

/* ------------------------------------------------------------- the policy */

/**
 * How long after arrival a refund can still be raised.
 *
 * Measured from delivery, not from the order being placed. An order that spent
 * three weeks with a carrier has not used up its customer's week.
 */
export const REFUND_WINDOW_DAYS = 7;

/**
 * How much of that window is left, given how long ago the order arrived.
 *
 * One definition, because three places need the answer: R12 when it decides,
 * the console when it draws the day track, and the reply when it tells the
 * customer how long they have. Null means the order has not arrived, so no
 * window has started. Negative means it has closed, which the console needs to
 * be able to say rather than showing a flat zero.
 */
export const refundDaysLeft = (daysSinceArrival: number | null): number | null =>
  daysSinceArrival === null ? null : REFUND_WINDOW_DAYS - daysSinceArrival;

/**
 * Pinned at zero, so every refund is held for a human. The branch above it is
 * written and tested rather than omitted, because that is where automation
 * would have to live the day it arrives. See decision D8.
 */
export const AUTO_APPROVAL_CEILING_MINOR = 0;

/** The only currency this system settles. */
export const SETTLEMENT_CURRENCY = "EUR";

/**
 * The order states a refund can be raised against, and the states it cannot.
 *
 * `returned` is conditional rather than absolute: it is refundable only once
 * the return has actually been received, which is a fact on the line rather
 * than on the order.
 */
export const REFUNDABLE_STATUSES = ["delivered"] as const;
export const CONDITIONALLY_REFUNDABLE_STATUSES = ["returned"] as const;
export const NOT_YET_ARRIVED_STATUSES = ["packaged", "in_transit"] as const;

/* -------------------------------------------------------------- the shape */

/**
 * What the system needs before it will evaluate anything.
 *
 * `customerId` is here because a refund belongs to an account, not to a
 * conversation. It is filled from the request envelope by the kernel and never
 * from the model, so by the time a request reaches this shape the question
 * "whose refund is this" has already been answered by something that cannot be
 * talked out of it.
 */
export type RefundRequest = {
  customerId: string;
  sessionId: string;
  orderId: string;
  itemId: string;
  quantity: number;
  amountMinor: number;
  reasonCode: RefundReason;
  /** Advisory only. No rule reads it. See decision D6. */
  certainty: number;
};

export type ShapeProblem =
  | "missing_customer"
  | "missing_session"
  | "missing_order"
  | "missing_item"
  | "bad_quantity"
  | "bad_amount"
  | "bad_reason";

export type ShapeCheck =
  | { ok: true; request: RefundRequest }
  | { ok: false; problems: ShapeProblem[] };

const text = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value.trim() : null;

const whole = (value: unknown): number | null =>
  typeof value === "number" && Number.isInteger(value) ? value : null;

/**
 * Checks the shape and nothing else. It asks no question about whether the
 * order exists, who owns it or whether it can be refunded: those are policy,
 * they are the kernel's, and answering them here would put the same decision
 * in two places.
 */
export function checkRefundRequestShape(input: {
  customerId: unknown;
  sessionId: unknown;
  orderId: unknown;
  itemId: unknown;
  quantity: unknown;
  amountMinor: unknown;
  reasonCode: unknown;
  certainty: unknown;
}): ShapeCheck {
  const problems: ShapeProblem[] = [];

  const customerId = text(input.customerId);
  const sessionId = text(input.sessionId);
  const orderId = text(input.orderId);
  const itemId = text(input.itemId);
  const quantity = whole(input.quantity);
  const amountMinor = whole(input.amountMinor);

  if (!customerId) problems.push("missing_customer");
  if (!sessionId) problems.push("missing_session");
  if (!orderId) problems.push("missing_order");
  if (!itemId) problems.push("missing_item");
  if (quantity === null || quantity < 1) problems.push("bad_quantity");
  if (amountMinor === null || amountMinor < 0) problems.push("bad_amount");
  if (!isRefundReason(input.reasonCode)) problems.push("bad_reason");

  if (problems.length > 0) return { ok: false, problems };

  return {
    ok: true,
    request: {
      customerId: customerId as string,
      sessionId: sessionId as string,
      orderId: orderId as string,
      itemId: itemId as string,
      quantity: quantity as number,
      amountMinor: amountMinor as number,
      reasonCode: input.reasonCode as RefundReason,
      certainty: Math.max(0, Math.min(100, whole(input.certainty) ?? 0)),
    },
  };
}
