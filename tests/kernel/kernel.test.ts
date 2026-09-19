/**
 * One test per rule, plus the sequencer.
 *
 * The rules are pure functions over records, so none of this needs a store, a
 * model or a clock. R9 is tested on both sides of its ceiling even though the
 * ceiling is pinned at zero and the upper branch cannot fire in production:
 * code that never executes is code that is never really tested, and this is
 * the only thing keeping that branch honest.
 */
import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";

import { clearRuntime } from "../../src/mock-env/runtime.ts";
import { setClock } from "../../src/core/runtime/clock.ts";
import { customerContext } from "../../src/guard/auth-context.ts";
import { insertRefund } from "../../src/guard/scoped-store.ts";
import { sessionToken } from "../../src/guard/sessions.ts";
import type { Order, OrderLine } from "../../src/guard/records.ts";
import type { RefundRecord } from "../../src/core/refunds/types.ts";
import { execute, type Envelope } from "../../src/core/kernel/kernel.ts";
import { checkOutputFidelity, monetaryFigures } from "../../src/core/kernel/output-fidelity.ts";
import {
  AUTO_APPROVAL_CEILING_MINOR,
  evaluateRefund,
  r1Owns,
  r2Line,
  r3Refundable,
  r4Recompute,
  r5Available,
  r6Duplicate,
  r7Currency,
  r8Reconcile,
  r9RequiresHuman,
} from "../../src/core/kernel/rules.ts";

const line = (over: Partial<OrderLine> = {}): OrderLine => ({
  itemId: "ITEM-201",
  name: "Wine Glass",
  quantity: 2,
  unitPriceMinor: 1490,
  ...over,
});

/**
 * Two days ago, paid. Inside the refund window, so a test about R4 is not
 * quietly also a test about R12.
 */
const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date("2026-09-19T09:00:00.000Z");
const daysAgo = (days: number) => new Date(NOW.getTime() - days * DAY).toISOString();

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

const priorRefund = (over: Partial<RefundRecord> = {}): RefundRecord => ({
  id: "REF-prior",
  sessionId: "SES-test",
  customerId: "CUST-001",
  orderId: "ORD-200",
  itemId: "ITEM-201",
  itemName: "Wine Glass",
  quantity: 1,
  amountMinor: 1490,
  currency: "EUR",
  reasonCode: "damaged_on_arrival",
  state: "held",
  signals: [],
  modelCertainty: 80,
  proposedAt: "2026-09-19T09:00:00.000Z",
  decidedAt: null,
  decidedBy: null,
  ...over,
});

beforeEach(() => {
  clearRuntime();
  setClock({ now: () => NOW });
});

/* ------------------------------------------------------------- the rules */

test("R1 ownership", () => {
  assert.equal(r1Owns(order(), "CUST-001"), true);
  assert.equal(r1Owns(order(), "CUST-002"), false);
});

test("R2 the referenced line exists", () => {
  assert.equal(r2Line(order(), "ITEM-201")?.name, "Wine Glass");
  assert.equal(r2Line(order(), "ITEM-999"), undefined);
});

test("R3 refundable status covers the whole supplied vocabulary", () => {
  assert.deepEqual(r3Refundable(order({ status: "delivered" }), line()), { ok: true });

  assert.deepEqual(
    r3Refundable(order({ status: "returned" }), line({ returnStatus: "received" })),
    { ok: true },
  );

  assert.deepEqual(r3Refundable(order({ status: "returned" }), line()), {
    ok: false,
    code: "not_refundable_status",
  });

  assert.deepEqual(r3Refundable(order({ status: "in_transit" }), line()), {
    ok: false,
    code: "not_yet_delivered",
  });
});

test("R4 recomputes the amount from the record, per unit", () => {
  assert.equal(r4Recompute(line(), 1), 1490);
  assert.equal(r4Recompute(line(), 2), 2980);
});

test("R5 counts prior binding refunds against the line", () => {
  assert.equal(r5Available(line(), []), 2);
  assert.equal(r5Available(line(), [priorRefund()]), 1);
  assert.equal(r5Available(line(), [priorRefund(), priorRefund({ id: "REF-2" })]), 0);
});

test("R5 does not count a rejected refund", () => {
  assert.equal(r5Available(line(), [priorRefund({ state: "rejected" })]), 2);
});

test("R6 catches an exact repeat but not a rejected one", () => {
  assert.equal(r6Duplicate([priorRefund()], "ITEM-201", 1)?.id, "REF-prior");
  assert.equal(r6Duplicate([priorRefund({ state: "settled" })], "ITEM-201", 1)?.id, "REF-prior");
  assert.equal(r6Duplicate([priorRefund({ state: "rejected" })], "ITEM-201", 1), undefined);
  assert.equal(r6Duplicate([priorRefund()], "ITEM-201", 2), undefined);
});

test("R7 currency", () => {
  assert.equal(r7Currency(order()), true);
  assert.equal(r7Currency(order({ currency: "USD" })), false);
});

test("R8 reconciles the claim without ever blocking", () => {
  assert.equal(r8Reconcile(null, 2990), null);
  assert.equal(r8Reconcile(2990, 2990), null);
  assert.deepEqual(r8Reconcile(3490, 2990), { code: "claim_exceeds_record", deltaMinor: 500 });
  assert.deepEqual(r8Reconcile(1990, 2990), { code: "claim_below_record", deltaMinor: -1000 });
});

test("R9 holds anything above the ceiling, and the ceiling is zero", () => {
  assert.equal(AUTO_APPROVAL_CEILING_MINOR, 0);
  assert.equal(r9RequiresHuman(1), true);
  assert.equal(r9RequiresHuman(1490), true);
  assert.equal(r9RequiresHuman(0), false);
});

test("R10 flags a figure no decision carried, and passes one that was", () => {
  assert.deepEqual(monetaryFigures("a refund of EUR 34.90 against 29.90").sort(), [2990, 3490]);
  assert.equal(checkOutputFidelity("Refunding EUR 29.90.", [2990]).ok, true);
  assert.deepEqual(checkOutputFidelity("Refunding EUR 34.90.", [2990]).offending, [3490]);
  assert.equal(checkOutputFidelity("Order ORD-300 is returned.", []).ok, true);
});

/* -------------------------------------------------------- the sequencer */

test("a clean proposal is held, not allowed", () => {
  const evaluation = evaluateRefund({
    order: order(),
    customerId: "CUST-001",
    itemId: "ITEM-201",
    quantity: 1,
    proposedAmountMinor: 1490,
    statedAmountsMinor: [],
    priorRefunds: [],
  });
  assert.equal(evaluation.verdict.kind, "hold");
  assert.equal(evaluation.verdict.kind === "hold" && evaluation.verdict.amountMinor, 1490);
});

test("a wrong amount is rejected and the refund continues at the recomputed one", () => {
  const evaluation = evaluateRefund({
    order: order({ orderId: "ORD-300", lines: [line({ itemId: "ITEM-301", unitPriceMinor: 2990, quantity: 1 })] }),
    customerId: "CUST-001",
    itemId: "ITEM-301",
    quantity: 1,
    proposedAmountMinor: 3490,
    statedAmountsMinor: [3490],
    priorRefunds: [],
  });

  assert.equal(evaluation.verdict.kind, "hold");
  assert.equal(evaluation.verdict.kind === "hold" && evaluation.verdict.amountMinor, 2990);

  const r4 = evaluation.outcomes.find((o) => o.rule === "R4");
  assert.equal(r4?.status, "blocked");
  assert.equal(r4?.code, "amount_mismatch");

  const r8 = evaluation.outcomes.find((o) => o.rule === "R8");
  assert.equal(r8?.status, "info");
  assert.equal(r8?.code, "claim_exceeds_record");
});

test("the above-ceiling branch exists and can be reached", () => {
  const evaluation = evaluateRefund({
    order: order({ lines: [line({ unitPriceMinor: 0, quantity: 1 })] }),
    customerId: "CUST-001",
    itemId: "ITEM-201",
    quantity: 1,
    proposedAmountMinor: 0,
    statedAmountsMinor: [],
    priorRefunds: [],
  });
  assert.equal(evaluation.verdict.kind, "allow");
});

/* ------------------------------------------------------------ the stages */

/**
 * A real token, minted through the guard the same way the orchestrator mints
 * one. Tokens live in the runtime store, which `beforeEach` clears, so this
 * mints per call rather than once at module load.
 */
const envelope = (over: Partial<Envelope> = {}): Envelope => ({
  customerId: "CUST-001",
  sessionId: "SES-test",
  sessionToken: sessionToken("CUST-001", "SES-test").token,
  message: "",
  statedAmountsMinor: [],
  ...over,
});

test("stage 1 refuses a tool the agent does not hold", () => {
  const result = execute(
    "order",
    { id: "toolu-1", name: "propose_refund", input: { order_id: "ORD-200" } },
    envelope(),
  );
  assert.equal(result.status, "deny");
  assert.equal(result.code, "capability_violation");
  assert.equal(result.signals[0].code, "capability_violation");
});

test("stage 1 refuses a tool nobody holds", () => {
  const result = execute("refund", { id: "toolu-1", name: "drop_database", input: {} }, envelope());
  assert.equal(result.code, "capability_violation");
});

test("stage 2 overwrites a model-supplied identity and logs the attempt", () => {
  const result = execute(
    "order",
    { id: "toolu-1", name: "get_order", input: { order_id: "ORD-204", customer_id: "CUST-002" } },
    envelope(),
  );

  assert.equal(result.signals[0].code, "identity_override_attempt");
  /** The override is not cosmetic: the read still runs as CUST-001 and fails. */
  assert.equal(result.status, "deny");
  assert.equal(result.code, "not_found");
});

test("a refused read tells the customer nothing about why", () => {
  const unowned = execute("order", { id: "t", name: "get_order", input: { order_id: "ORD-204" } }, envelope());
  const absent = execute("order", { id: "t", name: "get_order", input: { order_id: "ORD-999" } }, envelope());

  /**
   * ORD-204 exists and belongs to CUST-002. ORD-999 does not exist at all.
   * The only thing that differs in the two answers is the reference the
   * customer themselves supplied, so nothing in either reply lets them work
   * out which of the two happened.
   */
  const shape = (result: unknown) => {
    const rest = { ...(result as Record<string, unknown>) };
    delete rest.order_id;
    return rest;
  };
  assert.deepEqual(shape(unowned.result), shape(absent.result));
  assert.equal(unowned.code, absent.code);

  /** And the internal record does distinguish them, for the operator. */
  const reason = (r: typeof unowned) => r.entries.at(-1)?.payload?.internal;
  assert.equal(reason(unowned), "ownership_denied");
  assert.equal(reason(absent), "absent");
});

test("the kernel writes the refund, and a second identical proposal is refused", () => {
  const propose = () =>
    execute(
      "refund",
      {
        id: "toolu-1",
        name: "propose_refund",
        input: {
          order_id: "ORD-200",
          item_id: "ITEM-201",
          quantity: 1,
          amount_minor: 1490,
          reason_code: "damaged_on_arrival",
          certainty: 90,
        },
      },
      envelope(),
    );

  const first = propose();
  assert.equal(first.status, "hold");
  assert.equal(first.refund?.state, "held");
  assert.equal(first.refund?.amountMinor, 1490);

  const second = propose();
  assert.equal(second.status, "deny");
  assert.equal(second.code, "duplicate_refund");
});

test("the model's amount never becomes the refund's amount", () => {
  const result = execute(
    "refund",
    {
      id: "toolu-1",
      name: "propose_refund",
      input: {
        order_id: "ORD-200",
        item_id: "ITEM-201",
        quantity: 1,
        amount_minor: 2980,
        reason_code: "damaged_on_arrival",
        certainty: 99,
      },
    },
    envelope(),
  );

  assert.equal(result.status, "hold");
  assert.equal(result.refund?.amountMinor, 1490);
  assert.ok(result.signals.some((s) => s.code === "amount_mismatch"));
});

test("a refund against someone else's order is refused as not found", () => {
  const result = execute(
    "refund",
    {
      id: "toolu-1",
      name: "propose_refund",
      input: {
        order_id: "ORD-204",
        item_id: "ITEM-401",
        quantity: 1,
        amount_minor: 12900,
        reason_code: "unspecified",
        certainty: 99,
      },
    },
    envelope(),
  );
  assert.equal(result.code, "not_found");
  assert.equal(result.refund, undefined);
});

test("a refund against an undelivered order is refused", () => {
  const result = execute(
    "refund",
    {
      id: "toolu-1",
      name: "propose_refund",
      input: {
        order_id: "ORD-100",
        item_id: "ITEM-101",
        quantity: 1,
        amount_minor: 6480,
        reason_code: "unspecified",
        certainty: 70,
      },
    },
    envelope(),
  );
  assert.equal(result.code, "not_yet_delivered");
});

test("the certainty the model states is carried but never acted on", () => {
  const record = execute(
    "refund",
    {
      id: "toolu-1",
      name: "propose_refund",
      input: {
        order_id: "ORD-200",
        item_id: "ITEM-201",
        quantity: 1,
        amount_minor: 1490,
        reason_code: "damaged_on_arrival",
        certainty: 3,
      },
    },
    envelope(),
  ).refund;

  /** Three percent confident and it is still held, at the same amount. */
  assert.equal(record?.modelCertainty, 3);
  assert.equal(record?.state, "held");
  assert.equal(record?.amountMinor, 1490);
});

test("a prior refund filed directly still counts against the line", () => {
  insertRefund(customerContext("CUST-001"), priorRefund());

  const result = execute(
    "refund",
    {
      id: "toolu-1",
      name: "propose_refund",
      input: {
        order_id: "ORD-200",
        item_id: "ITEM-201",
        quantity: 2,
        amount_minor: 2980,
        reason_code: "damaged_on_arrival",
        certainty: 90,
      },
    },
    envelope(),
  );
  assert.equal(result.code, "quantity_exceeds_line");
});

test("stage 2 refuses a tool call carrying an unknown session token", () => {
  const result = execute(
    "order",
    { id: "toolu-1", name: "get_order", input: { order_id: "ORD-200" } },
    envelope({ sessionToken: "TOK-never-issued" }),
  );

  assert.equal(result.status, "deny");
  assert.equal(result.code, "session_invalid");
  assert.equal(result.signals[0].code, "session_invalid");
  /** It stopped before the handler: no order was read. */
  assert.equal(result.disclosedAmountsMinor.length, 0);
});

test("a token issued to another customer is refused, not silently accepted", () => {
  const theirs = sessionToken("CUST-002", "SES-theirs").token;
  const result = execute(
    "order",
    { id: "toolu-1", name: "get_order", input: { order_id: "ORD-204" } },
    envelope({ sessionToken: theirs }),
  );

  assert.equal(result.code, "session_invalid");
  assert.equal(result.signals[0].payload?.reason, "customer_mismatch");
});

test("check_session reports the conversation without exposing the account", () => {
  const result = execute("refund", { id: "toolu-1", name: "check_session", input: {} }, envelope());
  const payload = result.result as Record<string, unknown>;

  assert.equal(result.status, "allow");
  assert.equal(payload.valid, true);
  assert.equal(payload.session_id, "SES-test");
  assert.equal(payload.last_order_id, null);
  assert.equal("customer_id" in payload, false);
});

test("check_session is not in the composer or triage grant", () => {
  for (const agent of ["composer", "triage"] as const) {
    const result = execute(agent, { id: "t", name: "check_session", input: {} }, envelope());
    assert.equal(result.code, "capability_violation", `${agent} should not hold check_session`);
  }
});
