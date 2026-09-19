/**
 * The refund schema: the shape of a request, and the policy it is measured
 * against.
 *
 * Shape and policy are tested apart because they fail apart. A malformed
 * request is not a refund that was refused, and the difference matters to
 * whoever reads the trace afterwards.
 */
import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";

import { clearRuntime } from "../../src/mock-env/runtime.ts";
import { customerContext } from "../../src/guard/auth-context.ts";
import { getOrder } from "../../src/guard/scoped-store.ts";
import { sessionToken } from "../../src/guard/sessions.ts";
import { execute, type Envelope } from "../../src/core/kernel/kernel.ts";
import {
  evaluateRefund,
  r11Paid,
  r12WithinWindow,
  r3Refundable,
  refundWindowRemaining,
} from "../../src/core/kernel/rules.ts";
import {
  AUTO_APPROVAL_CEILING_MINOR,
  REFUND_WINDOW_DAYS,
  checkRefundRequestShape,
} from "../../src/core/refunds/schema.ts";
import { setClock } from "../../src/core/runtime/clock.ts";
import { sequentialIds, setIdSource } from "../../src/core/runtime/ids.ts";
import type { Order, OrderLine } from "../../src/guard/records.ts";

const NOW = new Date("2026-09-19T09:00:00.000Z");
const DAY = 24 * 60 * 60 * 1000;
const daysAgo = (days: number) => new Date(NOW.getTime() - days * DAY).toISOString();

beforeEach(() => {
  clearRuntime();
  setClock({ now: () => NOW });
  setIdSource(sequentialIds());
});

const line = (over: Partial<OrderLine> = {}): OrderLine => ({
  itemId: "ITEM-201",
  name: "Wine Glass",
  quantity: 2,
  unitPriceMinor: 1490,
  ...over,
});

const order = (over: Partial<Order> = {}): Order => ({
  orderId: "ORD-200",
  customerId: "CUST-001",
  status: "delivered",
  currency: "EUR",
  totalMinor: 5480,
  lines: [line()],
  placedAt: daysAgo(6),
  paidAt: daysAgo(6),
  deliveredAt: daysAgo(2),
  cancelledAt: null,
  origin: "seed",
  ...over,
});

/* -------------------------------------------------------------- the shape */

const wellFormed = {
  customerId: "CUST-001",
  sessionId: "SES-1",
  orderId: "ORD-200",
  itemId: "ITEM-201",
  quantity: 1,
  amountMinor: 1490,
  reasonCode: "damaged_on_arrival",
  certainty: 90,
};

test("a well formed request is accepted and normalised", () => {
  const check = checkRefundRequestShape(wellFormed);
  assert.ok(check.ok);
  assert.equal(check.request.customerId, "CUST-001");
  assert.equal(check.request.reasonCode, "damaged_on_arrival");
});

test("certainty is clamped rather than trusted", () => {
  const high = checkRefundRequestShape({ ...wellFormed, certainty: 4000 });
  const low = checkRefundRequestShape({ ...wellFormed, certainty: -20 });
  assert.equal(high.ok && high.request.certainty, 100);
  assert.equal(low.ok && low.request.certainty, 0);
});

test("a request with no customer is not a refund request at all", () => {
  const check = checkRefundRequestShape({ ...wellFormed, customerId: "" });
  assert.equal(check.ok, false);
  assert.ok(!check.ok && check.problems.includes("missing_customer"));
});

test("every missing part is reported, not just the first", () => {
  const check = checkRefundRequestShape({
    customerId: null,
    sessionId: null,
    orderId: null,
    itemId: null,
    quantity: 0,
    amountMinor: -1,
    reasonCode: "because_i_said_so",
    certainty: 50,
  });
  assert.equal(check.ok, false);
  assert.ok(!check.ok && check.problems.length === 7);
});

test("a free text reason is refused, so the reason list stays countable", () => {
  const check = checkRefundRequestShape({ ...wellFormed, reasonCode: "it broke and I am cross" });
  assert.equal(check.ok, false);
  assert.ok(!check.ok && check.problems.includes("bad_reason"));
});

/* ------------------------------------------------------------- the policy */

test("the lifecycle decides what can be refunded, and says which is which", () => {
  assert.deepEqual(r3Refundable(order({ status: "delivered" }), line()), { ok: true });
  assert.deepEqual(
    r3Refundable(order({ status: "returned" }), line({ returnStatus: "received" })),
    { ok: true },
  );
  assert.deepEqual(r3Refundable(order({ status: "packaged" }), line()), {
    ok: false,
    code: "not_yet_delivered",
  });
  assert.deepEqual(r3Refundable(order({ status: "in_transit" }), line()), {
    ok: false,
    code: "not_yet_delivered",
  });
  /** Its own answer, not folded into "not refundable". */
  assert.deepEqual(r3Refundable(order({ status: "cancelled" }), line()), {
    ok: false,
    code: "order_cancelled",
  });
});

test("R11 money has to have moved before it can move back", () => {
  assert.equal(r11Paid(order()), true);
  assert.equal(r11Paid(order({ paidAt: null })), false);
});

test("R12 the window is measured from arrival, not from the order date", () => {
  /** Placed a month ago, arrived yesterday: still refundable. */
  const slowCarrier = order({ placedAt: daysAgo(30), paidAt: daysAgo(30), deliveredAt: daysAgo(1) });
  assert.equal(r12WithinWindow(slowCarrier).ok, true);

  assert.equal(r12WithinWindow(order({ deliveredAt: daysAgo(REFUND_WINDOW_DAYS) })).ok, true);
  assert.equal(r12WithinWindow(order({ deliveredAt: daysAgo(REFUND_WINDOW_DAYS + 1) })).ok, false);
});

test("an order that has not arrived has no window yet, which is R3's refusal not R12's", () => {
  const moving = order({ status: "in_transit", deliveredAt: null });
  assert.equal(r12WithinWindow(moving).ok, true);
  assert.equal(r3Refundable(moving, line()).ok, false);
});

test("the days left reported to the operator match the rule", () => {
  assert.equal(refundWindowRemaining(order({ deliveredAt: daysAgo(2) })), REFUND_WINDOW_DAYS - 2);
  assert.equal(refundWindowRemaining(order({ deliveredAt: null })), null);
  /** Negative once gone, so the console can say "closed" rather than "0 left". */
  assert.ok((refundWindowRemaining(order({ deliveredAt: daysAgo(24) })) ?? 0) < 0);
});

test("the ceiling is zero, so nothing this schema allows is ever automatic", () => {
  assert.equal(AUTO_APPROVAL_CEILING_MINOR, 0);
});

/* ---------------------------------------------------- through the kernel */

const envelope = (): Envelope => ({
  customerId: "CUST-001",
  sessionId: "SES-test",
  sessionToken: sessionToken("CUST-001", "SES-test").token,
  message: "",
  statedAmountsMinor: [],
});

const proposeOn = (orderId: string, itemId: string, amountMinor: number) =>
  execute(
    "refund",
    {
      id: "toolu-1",
      name: "propose_refund",
      input: {
        order_id: orderId,
        item_id: itemId,
        quantity: 1,
        amount_minor: amountMinor,
        reason_code: "damaged_on_arrival",
        certainty: 80,
      },
    },
    envelope(),
  );

test("a packaged order is refused for not having arrived", () => {
  assert.equal(proposeOn("ORD-401", "ITEM-102", 3800).code, "not_yet_delivered");
});

test("an order delivered outside the window is refused", () => {
  const result = proposeOn("ORD-402", "ITEM-404", 2750);
  assert.equal(result.code, "refund_window_expired");
  assert.equal(result.refund, undefined);
});

test("a cancelled order is refused as cancelled, and names its own reason", () => {
  const result = proposeOn("ORD-403", "ITEM-406", 8900);
  assert.equal(result.code, "order_cancelled");
  assert.equal(
    (result.result as { message: string }).message.includes("cancelled"),
    true,
    "the customer is told it was cancelled, not just that it failed",
  );
});

test("an unpaid order cannot be refunded even if its status allowed it", () => {
  const access = getOrder(customerContext("CUST-001"), "ORD-403");
  assert.ok(access.ok);
  assert.equal(access.value.paidAt, null);

  /** R11 evaluated directly, since R3 refuses this order first. */
  const evaluation = evaluateRefund({
    order: order({ paidAt: null }),
    customerId: "CUST-001",
    itemId: "ITEM-201",
    quantity: 1,
    proposedAmountMinor: 1490,
    statedAmountsMinor: [],
    priorRefunds: [],
  });
  assert.equal(evaluation.verdict.kind, "deny");
  assert.equal(evaluation.verdict.kind === "deny" && evaluation.verdict.code, "not_paid");
});

test("a malformed proposal is refused on shape, before any policy runs", () => {
  const result = execute(
    "refund",
    {
      id: "toolu-1",
      name: "propose_refund",
      input: { order_id: "ORD-200", item_id: "ITEM-201", quantity: 0, amount_minor: 1490 },
    },
    envelope(),
  );

  assert.equal(result.code, "invalid_arguments");
  /** The schema entry is the only one: no rule was given a chance to fire. */
  const rules = result.entries.filter((e) => /^R\d+/.test(e.label));
  assert.equal(rules.length, 0);
});

test("a good order still passes end to end with the new rules in place", () => {
  const result = proposeOn("ORD-200", "ITEM-201", 1490);
  assert.equal(result.status, "hold");
  assert.equal(result.refund?.amountMinor, 1490);

  const labels = result.entries.map((e) => e.label);
  assert.ok(labels.includes("R11 Payment settled"));
  assert.ok(labels.includes("R12 Refund window"));
});
