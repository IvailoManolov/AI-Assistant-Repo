/**
 * The rule set.
 *
 * Each rule is a small exported function so that it has a unit test of its
 * own, and `evaluateRefund` is the sequencer that runs them in order and
 * records what each one said. Nothing here reads storage, calls a model or
 * looks at a clock: given the same inputs it returns the same outcomes, which
 * is the half of the determinism contract that the kernel owns.
 *
 * Evaluation order is not the order the rules are numbered in. It runs:
 *
 *   R1/R2 existence and ownership, R7 currency, R3 status, R6 duplicate,
 *   R5 quantity, R4 amount authority, R8 reconciliation, R9 ceiling.
 *
 * R6 is checked before R5 deliberately. An exact repeat of a refund that is
 * already open is a more precise answer than "that is more units than the
 * line holds", and with a single-unit line the cumulative check would
 * otherwise swallow it.
 */
import { CURRENCY } from "../money.ts";
import { isBinding } from "../refunds/lifecycle.ts";
import {
  AUTO_APPROVAL_CEILING_MINOR,
  REFUND_WINDOW_DAYS,
  refundDaysLeft,
} from "../refunds/schema.ts";
import type { RefundRecord } from "../refunds/types.ts";
import { findLine, type Order, type OrderLine } from "../../guard/records.ts";
import { daysSince } from "../../guard/timeline.ts";
import type { DenyCode, SignalCode } from "./codes.ts";

/**
 * The policy constants live in the refund schema, not here. This module
 * evaluates rules; the schema is what they are evaluated against. Re-exported
 * so a reader of the rule set does not have to go and find them.
 */
export { AUTO_APPROVAL_CEILING_MINOR, REFUND_WINDOW_DAYS };

export type RuleId =
  | "R1" | "R2" | "R3" | "R4" | "R5"
  | "R6" | "R7" | "R8" | "R9" | "R10"
  | "R11" | "R12";

export const RULE_TITLES: Record<RuleId, string> = {
  R1: "Ownership",
  R2: "Record exists",
  R3: "Refundable status",
  R4: "Amount authority",
  R5: "Quantity available",
  R6: "No duplicate refund",
  R7: "Supported currency",
  R8: "Claim reconciliation",
  R9: "Human approval",
  R10: "Output fidelity",
  R11: "Payment settled",
  R12: "Refund window",
};

export type RuleStatus = "ok" | "blocked" | "info" | "hold";

export type RuleOutcome = {
  rule: RuleId;
  title: string;
  status: RuleStatus;
  detail: string;
  code?: DenyCode | SignalCode;
  payload?: Record<string, unknown>;
};

/* ------------------------------------------------------------------ rules */

/** R1. The order belongs to the authenticated customer. */
export const r1Owns = (order: Order, customerId: string): boolean =>
  order.customerId === customerId;

/** R2. The referenced line exists on the order. */
export const r2Line = (order: Order, itemId: string): OrderLine | undefined =>
  findLine(order, itemId);

type StatusDenial = Extract<
  DenyCode,
  "not_yet_delivered" | "not_refundable_status" | "order_cancelled"
>;

/**
 * R3. Where the order is in its lifecycle.
 *
 * Delivered is refundable. Returned is refundable once the return has actually
 * been received, which is a fact on the line rather than on the order. Packaged
 * and in transit have not arrived. Cancelled is its own answer, because
 * "cancelled" and "not refundable" are very different things to be told.
 */
export function r3Refundable(
  order: Order,
  line: OrderLine,
): { ok: true } | { ok: false; code: StatusDenial } {
  if (order.status === "delivered") return { ok: true };
  if (order.status === "returned" && line.returnStatus === "received") return { ok: true };
  if (order.status === "cancelled") return { ok: false, code: "order_cancelled" };
  if (order.status === "packaged" || order.status === "in_transit") {
    return { ok: false, code: "not_yet_delivered" };
  }
  return { ok: false, code: "not_refundable_status" };
}

/**
 * R11. The money has to have moved before it can move back.
 *
 * A cancelled basket and a paid order that went wrong look similar in a list
 * and are not similar at all: one of them has nothing to return.
 */
export const r11Paid = (order: Order): boolean => order.paidAt !== null;

/**
 * R12. The refund window, measured from arrival.
 *
 * From delivery rather than from the order being placed: an order that spent
 * three weeks with a carrier has not used up its customer's week. An order
 * that has not arrived has no window yet, which is R3's answer rather than
 * this one's, so a missing delivery date passes here and fails there.
 */
export function r12WithinWindow(order: Order): { ok: true; daysSinceArrival: number | null } | { ok: false; daysSinceArrival: number } {
  const elapsed = daysSince(order.deliveredAt);
  if (elapsed === null) return { ok: true, daysSinceArrival: null };
  return elapsed > REFUND_WINDOW_DAYS
    ? { ok: false, daysSinceArrival: elapsed }
    : { ok: true, daysSinceArrival: elapsed };
}

/** Days left to raise a refund, for the operator's view. Negative once gone. */
export function refundWindowRemaining(order: Order): number | null {
  return refundDaysLeft(daysSince(order.deliveredAt));
}

/**
 * R4. The authoritative amount, recomputed from the record.
 *
 * The model's figure is compared against this and never replaces it. That is
 * the whole point of letting the model propose an amount at all: a rejection
 * here is visible evidence in the trace that the system did not take the
 * number it was handed.
 */
export const r4Recompute = (line: OrderLine, quantity: number): number =>
  line.unitPriceMinor * quantity;

/** R5. Units still refundable on the line, after prior binding refunds. */
export function r5Available(line: OrderLine, priors: readonly RefundRecord[]): number {
  const spent = priors
    .filter((r) => r.itemId === line.itemId && isBinding(r))
    .reduce((sum, r) => sum + r.quantity, 0);
  return line.quantity - spent;
}

/** R6. An open or settled refund for the same order, item and quantity. */
export const r6Duplicate = (
  priors: readonly RefundRecord[],
  itemId: string,
  quantity: number,
): RefundRecord | undefined =>
  priors.find((r) => r.itemId === itemId && r.quantity === quantity && isBinding(r));

/** R7. Exists, and never fires on the supplied data. That is the point of it. */
export const r7Currency = (order: Order): boolean => order.currency === CURRENCY;

/**
 * R8. The customer's own figure against the record's.
 *
 * Signal only. Customers misstate amounts constantly, and refusing to act on
 * every mismatch would make escalation the default path. The operator is
 * shown both numbers and the gap, and decides.
 */
export function r8Reconcile(
  statedMinor: number | null,
  computedMinor: number,
): { code: Extract<SignalCode, "claim_exceeds_record" | "claim_below_record">; deltaMinor: number } | null {
  if (statedMinor === null || statedMinor === computedMinor) return null;
  return {
    code: statedMinor > computedMinor ? "claim_exceeds_record" : "claim_below_record",
    deltaMinor: statedMinor - computedMinor,
  };
}

/** R9. Above the ceiling means a human decides. The ceiling is zero. */
export const r9RequiresHuman = (amountMinor: number): boolean =>
  amountMinor > AUTO_APPROVAL_CEILING_MINOR;

/* -------------------------------------------------------------- sequencer */

/** The evaluated form of a `RefundRequest` plus the record it is about. */
export type RefundInput = {
  order: Order;
  customerId: string;
  itemId: string;
  quantity: number;
  proposedAmountMinor: number;
  /** Amounts the customer named in their own message. May be empty. */
  statedAmountsMinor: readonly number[];
  priorRefunds: readonly RefundRecord[];
};

export type RefundVerdict =
  | { kind: "deny"; code: DenyCode }
  | { kind: "hold"; amountMinor: number; line: OrderLine }
  | { kind: "allow"; amountMinor: number; line: OrderLine };

export type RefundEvaluation = { outcomes: RuleOutcome[]; verdict: RefundVerdict };

const money = (minor: number) => `${CURRENCY} ${(minor / 100).toFixed(2)}`;

export function evaluateRefund(input: RefundInput): RefundEvaluation {
  const { order, customerId, itemId, quantity, proposedAmountMinor, priorRefunds } = input;
  const outcomes: RuleOutcome[] = [];
  const deny = (rule: RuleId, code: DenyCode, detail: string, payload?: Record<string, unknown>): RefundEvaluation => {
    outcomes.push({ rule, title: RULE_TITLES[rule], status: "blocked", detail, code, payload });
    return { outcomes, verdict: { kind: "deny", code } };
  };
  const pass = (rule: RuleId, detail: string, payload?: Record<string, unknown>) => {
    outcomes.push({ rule, title: RULE_TITLES[rule], status: "ok", detail, payload });
  };

  if (!r1Owns(order, customerId)) {
    return deny("R1", "not_found", `${order.orderId} is not on this account.`, {
      internal: "ownership_denied",
    });
  }
  pass("R1", `${order.orderId} belongs to ${customerId}.`);

  const line = r2Line(order, itemId);
  if (!line) {
    return deny("R2", "not_found", `${itemId} is not a line on ${order.orderId}.`);
  }
  pass("R2", `${itemId} is on ${order.orderId}, ${line.quantity} unit(s) at ${money(line.unitPriceMinor)}.`);

  if (!r7Currency(order)) {
    return deny("R7", "currency_unsupported", `${order.orderId} is priced in ${order.currency}.`);
  }
  pass("R7", `${order.orderId} is priced in ${CURRENCY}.`);

  const status = r3Refundable(order, line);
  if (!status.ok) {
    return deny("R3", status.code, `${order.orderId} is ${order.status}.`, {
      status: order.status,
      return_status: line.returnStatus ?? null,
    });
  }
  pass(
    "R3",
    line.returnStatus
      ? `${order.orderId} is ${order.status} and the return was ${line.returnStatus}.`
      : `${order.orderId} is ${order.status}.`,
  );

  if (!r11Paid(order)) {
    return deny("R11", "not_paid", `${order.orderId} was never paid for.`, {
      paid_at: null,
      status: order.status,
    });
  }
  pass("R11", `${order.orderId} was paid on ${order.paidAt?.slice(0, 10)}.`);

  const window = r12WithinWindow(order);
  if (!window.ok) {
    return deny(
      "R12",
      "refund_window_expired",
      `${order.orderId} arrived ${window.daysSinceArrival} days ago, outside the ${REFUND_WINDOW_DAYS} day window.`,
      {
        delivered_at: order.deliveredAt,
        days_since_arrival: window.daysSinceArrival,
        window_days: REFUND_WINDOW_DAYS,
      },
    );
  }
  pass(
    "R12",
    window.daysSinceArrival === null
      ? `${order.orderId} has no arrival date, so no window has started.`
      : `Arrived ${window.daysSinceArrival} day(s) ago, inside the ${REFUND_WINDOW_DAYS} day window.`,
  );

  const duplicate = r6Duplicate(priorRefunds, itemId, quantity);
  if (duplicate) {
    return deny("R6", "duplicate_refund", `Refund ${duplicate.id} already covers this line.`, {
      refund_id: duplicate.id,
      state: duplicate.state,
    });
  }
  pass("R6", "No refund is already open for this line and quantity.");

  const available = r5Available(line, priorRefunds);
  if (quantity < 1 || quantity > available) {
    return deny("R5", "quantity_exceeds_line", `${quantity} asked for, ${available} refundable.`, {
      requested: quantity,
      available,
    });
  }
  pass("R5", `${quantity} of ${available} refundable unit(s).`);

  const computedMinor = r4Recompute(line, quantity);
  if (proposedAmountMinor !== computedMinor) {
    outcomes.push({
      rule: "R4",
      title: RULE_TITLES.R4,
      status: "blocked",
      code: "amount_mismatch",
      detail: `Proposed ${money(proposedAmountMinor)} rejected. Held at ${money(computedMinor)}, recomputed from the record.`,
      payload: { proposed_minor: proposedAmountMinor, computed_minor: computedMinor },
    });
  } else {
    pass("R4", `${money(computedMinor)} matches ${quantity} x ${money(line.unitPriceMinor)}.`);
  }

  const stated = input.statedAmountsMinor.length ? input.statedAmountsMinor[0] : null;
  const reconciliation = r8Reconcile(stated, computedMinor);
  if (reconciliation) {
    outcomes.push({
      rule: "R8",
      title: RULE_TITLES.R8,
      status: "info",
      code: reconciliation.code,
      detail: `Customer stated ${money(stated as number)}, record supports ${money(computedMinor)}. Gap ${money(Math.abs(reconciliation.deltaMinor))}.`,
      payload: {
        stated_minor: stated,
        computed_minor: computedMinor,
        delta_minor: reconciliation.deltaMinor,
      },
    });
  } else if (stated !== null) {
    pass("R8", `Customer stated ${money(stated)}, which the record supports.`);
  }

  if (r9RequiresHuman(computedMinor)) {
    outcomes.push({
      rule: "R9",
      title: RULE_TITLES.R9,
      status: "hold",
      code: "auto_approval_ceiling",
      detail: `${money(computedMinor)} is above the auto-approval ceiling of ${money(AUTO_APPROVAL_CEILING_MINOR)}. Held for an operator.`,
      payload: { amount_minor: computedMinor, ceiling_minor: AUTO_APPROVAL_CEILING_MINOR },
    });
    return { outcomes, verdict: { kind: "hold", amountMinor: computedMinor, line } };
  }

  pass("R9", `${money(computedMinor)} is within the auto-approval ceiling.`);
  return { outcomes, verdict: { kind: "allow", amountMinor: computedMinor, line } };
}
