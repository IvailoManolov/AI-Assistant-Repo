/**
 * The human half of the refund.
 *
 * Approval is a kernel action carrying an operator principal, not a write to
 * the store, so the rules run again at the moment of the click. These tests
 * are about that second evaluation and about what happens when two operators
 * reach for the same refund.
 */
import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";

import { clearRuntime, putRecord } from "../../src/mock-env/runtime.ts";
import { customerContext, operatorContext } from "../../src/guard/auth-context.ts";
import { getRefund, listRefunds, resetRefunds } from "../../src/guard/scoped-store.ts";
import { sessionToken } from "../../src/guard/sessions.ts";
import { decideRefund } from "../../src/core/kernel/approval.ts";
import { execute, type Envelope } from "../../src/core/kernel/kernel.ts";
import { setClock } from "../../src/core/runtime/clock.ts";
import { sequentialIds, setIdSource } from "../../src/core/runtime/ids.ts";
import { decide } from "../../src/core/refunds/lifecycle.ts";
import { settleRefund } from "../../src/core/refunds/settle.ts";
import { getSession, receiveMessage, resetSessions } from "../../src/core/sessions/store.ts";

const envelope = (): Envelope => ({
  customerId: "CUST-001",
  sessionId: "SES-test",
  sessionToken: sessionToken("CUST-001", "SES-test").token,
  message: "",
  statedAmountsMinor: [],
});

const propose = (over: Record<string, unknown> = {}) =>
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
        ...over,
      },
    },
    envelope(),
  );

beforeEach(() => {
  clearRuntime();
  setClock({ now: () => new Date("2026-09-19T09:00:00.000Z") });
  setIdSource(sequentialIds());
});

test("a held refund settles when an operator approves it", () => {
  const held = propose().refund;
  assert.ok(held);

  const result = decideRefund({ refundId: held.id, decision: "approve", operatorId: "op-1" });
  assert.ok(result.ok);
  assert.equal(result.record.state, "settled");
  assert.equal(result.record.decidedBy, "op-1");
  assert.equal(result.record.decidedAt, "2026-09-19T09:00:00.000Z");
  assert.equal(result.record.amountMinor, held.amountMinor);
});

test("a rejected refund pays nothing and frees the line again", () => {
  const held = propose().refund;
  assert.ok(held);

  const rejected = decideRefund({ refundId: held.id, decision: "reject", operatorId: "op-1" });
  assert.ok(rejected.ok);
  assert.equal(rejected.record.state, "rejected");

  /** A corrected claim must still be possible after a rejection. */
  const again = propose();
  assert.equal(again.status, "hold");
});

test("the second operator to click is told, not silently overwritten", () => {
  const held = propose().refund;
  assert.ok(held);

  const first = decideRefund({ refundId: held.id, decision: "approve", operatorId: "op-1" });
  assert.ok(first.ok);

  const second = decideRefund({ refundId: held.id, decision: "reject", operatorId: "op-2" });
  assert.equal(second.ok, false);
  assert.equal(second.ok === false && second.code, "already_decided");

  const stored = getRefund(operatorContext("op-2"), held.id);
  assert.ok(stored.ok);
  assert.equal(stored.value.state, "settled");
  assert.equal(stored.value.decidedBy, "op-1");
});

test("an order that became ineligible between proposal and click is caught at the click", () => {
  const held = propose().refund;
  assert.ok(held);

  /**
   * The order goes back on the road after the proposal was raised. Nothing in
   * the refund record changed, so only a re-evaluation can catch this.
   */
  putRecord("orders", "ORD-200", {
    orderId: "ORD-200",
    customerId: "CUST-001",
    status: "in_transit",
    currency: "EUR",
    totalMinor: 5480,
    lines: [{ itemId: "ITEM-201", name: "Wine Glass", quantity: 2, unitPriceMinor: 1490 }],
    origin: "runtime",
  });

  const result = decideRefund({ refundId: held.id, decision: "approve", operatorId: "op-1" });
  assert.equal(result.ok, false);
  assert.equal(result.ok === false && result.code, "not_yet_delivered");

  const stored = getRefund(operatorContext("op-1"), held.id);
  assert.equal(stored.ok && stored.value.state, "held");
});

test("rejecting does not re-check, because refusing to pay cannot become unsafe", () => {
  const held = propose().refund;
  assert.ok(held);

  putRecord("orders", "ORD-200", {
    orderId: "ORD-200",
    customerId: "CUST-001",
    status: "in_transit",
    currency: "EUR",
    totalMinor: 5480,
    lines: [{ itemId: "ITEM-201", name: "Wine Glass", quantity: 2, unitPriceMinor: 1490 }],
    origin: "runtime",
  });

  const result = decideRefund({ refundId: held.id, decision: "reject", operatorId: "op-1" });
  assert.ok(result.ok);
  assert.equal(result.record.state, "rejected");
});

test("a customer cannot decide their own refund", () => {
  const held = propose().refund;
  assert.ok(held);

  /**
   * There is no API to try this through: decideRefund mints an operator
   * principal from its own argument, and the customer-facing tool grant holds
   * no approval tool at all. The closest reachable thing is a customer
   * proposing again, which the duplicate rule stops.
   */
  assert.equal(propose().code, "duplicate_refund");
  assert.equal(getRefund(customerContext("CUST-001"), held.id).ok, true);
});

test("an unknown refund is not found rather than fabricated", () => {
  const result = decideRefund({ refundId: "REF-nope", decision: "approve", operatorId: "op-1" });
  assert.equal(result.ok, false);
  assert.equal(result.ok === false && result.code, "not_found");
});

test("the lifecycle itself allows exactly one transition out of held", () => {
  const held = propose().refund;
  assert.ok(held);

  const settled = decide(held, "approve", "op-1", "2026-09-19T10:00:00.000Z");
  assert.ok(settled.ok);
  assert.equal(settled.record.state, "settled");

  const again = decide(settled.record, "reject", "op-2", "2026-09-19T11:00:00.000Z");
  assert.equal(again.ok, false);
});

/* ------------------------------------ the session that raised it goes green */

test("deciding a refund closes the session that raised it, either way", async () => {
  for (const decision of ["approve", "reject"] as const) {
    clearRuntime();
    resetSessions();
    setIdSource(sequentialIds());

    const session = receiveMessage({
      customerId: "CUST-001",
      customer: "Anna Petrova",
      message: "the decanter in ORD-200 arrived cracked, refund please",
    });

    const held = execute(
      "refund",
      {
        id: "toolu-1",
        name: "propose_refund",
        input: {
          order_id: "ORD-200",
          item_id: "ITEM-202",
          quantity: 1,
          amount_minor: 2500,
          reason_code: "damaged_on_arrival",
          certainty: 90,
        },
      },
      {
        customerId: "CUST-001",
        sessionId: session.id,
        sessionToken: sessionToken("CUST-001", session.id).token,
        message: "",
        statedAmountsMinor: [],
      },
    ).refund;
    assert.ok(held, "a refund should have been raised");

    /** Waiting on a person until somebody decides. */
    assert.equal(getSession(session.id)?.outcome, "info");

    const settled = settleRefund({ refundId: held.id, decision, operatorId: "op-1" });
    assert.ok(settled.ok);
    assert.equal(settled.sessionCompleted, true);

    const after = getSession(session.id);
    assert.equal(after?.outcome, "ok", `${decision} should leave the session green`);
    assert.equal(after?.lifecycle, "closed");
    assert.equal(after?.tree.at(-1)?.label, "Operator decision");
    assert.ok(after?.logs.at(-1)?.message.includes("op-1"));
  }

  resetSessions();
});

test("settling records that no money moved, rather than implying it did", () => {
  clearRuntime();
  setIdSource(sequentialIds());
  const held = propose().refund;
  assert.ok(held);

  const settled = settleRefund({ refundId: held.id, decision: "approve", operatorId: "op-1" });
  assert.ok(settled.ok);
  assert.equal(settled.record.state, "settled");

  const handler = settled.entries.at(-1);
  assert.equal(handler?.status, "ok");
});

test("a refund that cannot be decided leaves its session alone", () => {
  clearRuntime();
  const nothing = settleRefund({ refundId: "REF-nope", decision: "approve", operatorId: "op-1" });
  assert.equal(nothing.ok, false);
  assert.equal(nothing.sessionCompleted, false);
});

/* ------------------------------------------------------------- the reset */

test("a reset takes the raised refunds with it", () => {
  const held = propose();
  assert.equal(held.status, "hold");
  assert.equal(listRefunds(operatorContext("op-1")).length, 1);

  const cleared = resetRefunds();
  assert.equal(cleared.removed, 1);
  assert.equal(listRefunds(operatorContext("op-1")).length, 0);

  /**
   * And the same refund can be raised again. Before this, a reset left the
   * refund behind and the next run was refused as already open, against a
   * session that no longer existed.
   */
  assert.equal(propose().status, "hold");
});
