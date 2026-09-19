/**
 * Operator approval, as a kernel action.
 *
 * An operator clicking approve is not a write to the store. It is a tool call
 * like any other, carrying an operator principal, and the rules run again
 * against the record as it is at the moment of the click. An order that
 * became ineligible between the proposal and the click is caught here rather
 * than paid.
 *
 * The audit trail therefore has one shape for both halves of a refund: the
 * machine proposing it and the human allowing it leave the same kind of line.
 */
import { operatorContext } from "../../guard/auth-context.ts";
import { getOrder, getRefund, replaceRefund } from "../../guard/scoped-store.ts";
import { formatMinor } from "../money.ts";
import { decide, type Decision } from "../refunds/lifecycle.ts";
import type { RefundRecord } from "../refunds/types.ts";
import { nowIso } from "../runtime/clock.ts";
import type { DenyCode } from "./codes.ts";
import { r2Line, r3Refundable, r4Recompute, r7Currency } from "./rules.ts";
import type { TraceEntry } from "./kernel.ts";

export type ApprovalResult =
  | { ok: true; record: RefundRecord; entries: TraceEntry[] }
  | { ok: false; code: DenyCode; detail: string; entries: TraceEntry[] };

const entry = (
  label: string,
  status: TraceEntry["status"],
  detail: string,
  payload?: Record<string, unknown>,
): TraceEntry => ({ label, status, detail, ...(payload ? { payload } : {}) });

export function decideRefund(input: {
  refundId: string;
  decision: Decision;
  operatorId: string;
}): ApprovalResult {
  const ctx = operatorContext(input.operatorId);
  const entries: TraceEntry[] = [
    entry("Operator action", "info", `${input.operatorId} chose to ${input.decision} ${input.refundId}.`),
  ];

  const access = getRefund(ctx, input.refundId);
  if (!access.ok) {
    return {
      ok: false,
      code: "not_found",
      detail: "No such refund.",
      entries: [...entries, entry("R2 Record exists", "blocked", `${input.refundId} is not a refund on this system.`)],
    };
  }

  const record = access.value;

  /**
   * Rejection needs no re-check. Refusing to pay cannot become unsafe
   * because the order changed underneath it.
   */
  if (input.decision === "approve") {
    const order = getOrder(ctx, record.orderId);
    if (!order.ok) {
      return {
        ok: false,
        code: "not_found",
        detail: "The order behind this refund is no longer readable.",
        entries: [...entries, entry("R2 Record exists", "blocked", `${record.orderId} could not be read at approval time.`)],
      };
    }

    const line = r2Line(order.value, record.itemId);
    if (!line) {
      return {
        ok: false,
        code: "not_found",
        detail: "The line behind this refund is no longer on the order.",
        entries: [...entries, entry("R2 Record exists", "blocked", `${record.itemId} is no longer on ${record.orderId}.`)],
      };
    }

    if (!r7Currency(order.value)) {
      return {
        ok: false,
        code: "currency_unsupported",
        detail: `${record.orderId} is priced in ${order.value.currency}.`,
        entries: [...entries, entry("R7 Supported currency", "blocked", `${order.value.currency} is not settleable.`)],
      };
    }

    const status = r3Refundable(order.value, line);
    if (!status.ok) {
      return {
        ok: false,
        code: status.code,
        detail: `${record.orderId} is ${order.value.status} at approval time.`,
        entries: [
          ...entries,
          entry("R3 Refundable status", "blocked", `${record.orderId} became ${order.value.status} after the proposal.`, {
            code: status.code,
          }),
        ],
      };
    }
    entries.push(entry("R3 Refundable status", "ok", `${record.orderId} is still ${order.value.status}.`));

    const recomputed = r4Recompute(line, record.quantity);
    if (recomputed !== record.amountMinor) {
      return {
        ok: false,
        code: "invalid_arguments",
        detail: `The held amount no longer matches the record.`,
        entries: [
          ...entries,
          entry("R4 Amount authority", "blocked", `Held ${formatMinor(record.amountMinor)}, record now supports ${formatMinor(recomputed)}.`, {
            held_minor: record.amountMinor,
            computed_minor: recomputed,
          }),
        ],
      };
    }
    entries.push(
      entry("R4 Amount authority", "ok", `${formatMinor(recomputed)} still matches the record.`),
    );
  }

  const transition = decide(record, input.decision, input.operatorId, nowIso());
  if (!transition.ok) {
    return {
      ok: false,
      code: "already_decided",
      detail: `${record.id} was already ${record.state}.`,
      entries: [
        ...entries,
        entry("Lifecycle", "blocked", `${record.id} is ${record.state}, decided by ${record.decidedBy ?? "someone else"}.`, {
          code: "already_decided",
          state: record.state,
        }),
      ],
    };
  }

  const stored = replaceRefund(ctx, transition.record);
  if (!stored.ok) {
    return {
      ok: false,
      code: "not_found",
      detail: "The refund could not be written back.",
      entries: [...entries, entry("Handler", "blocked", "Write back failed.")],
    };
  }

  entries.push(
    entry(
      "Handler",
      transition.record.state === "settled" ? "ok" : "blocked",
      transition.record.state === "settled"
        ? `${formatMinor(record.amountMinor, record.currency)} settled on ${record.orderId}.`
        : `Refund ${record.id} rejected. Nothing paid.`,
      { refund_id: record.id, state: transition.record.state, by: input.operatorId },
    ),
  );

  return { ok: true, record: stored.value, entries };
}
