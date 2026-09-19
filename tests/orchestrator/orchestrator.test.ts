/**
 * Routing, the pipeline invariant, and replay determinism.
 *
 * The replay tests run the supplied examples, which is a different thing from
 * branching on them: nothing in the product reads a scenario id, and these
 * assertions are about properties the system should hold for any message of
 * the same shape. The amounts are asserted because I1 is the one requirement
 * the supplied data states only by arithmetic: one broken wine glass out of a
 * line of two is 14.90, not the 29.80 line total and not the 54.80 order.
 */
import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";

import { clearRuntime } from "../../src/mock-env/runtime.ts";
import { loadScenarios } from "../../src/mock-env/seed.ts";
import { setClock, systemClock } from "../../src/core/runtime/clock.ts";
import { sequentialIds, setIdSource } from "../../src/core/runtime/ids.ts";
import { PIPELINES, assertWellFormed, route } from "../../src/core/orchestrator/router.ts";
import { runSupportRequest } from "../../src/core/orchestrator/run.ts";

const FIXED = new Date("2026-09-19T09:00:00.000Z");

const fresh = () => {
  clearRuntime();
  setClock({ now: () => FIXED });
  setIdSource(sequentialIds());
};

const scenario = (id: string) => {
  const found = loadScenarios().find((s) => s.scenario_id === id);
  if (!found) throw new Error(`No ${id} in the supplied seed.`);
  return found;
};

const ask = (id: string) => {
  const s = scenario(id);
  return runSupportRequest({
    customerId: s.authenticated_customer_id,
    customerName: "Anna Petrova",
    sessionId: `SES-${id}`,
    message: s.message,
  });
};

beforeEach(fresh);

/* ------------------------------------------------------------- routing */

test("the routing table is fixed and total", () => {
  assert.deepEqual(route("order_status"), ["order", "composer"]);
  assert.deepEqual(route("refund_request"), ["order", "refund", "composer"]);
  assert.deepEqual(route("refund_confirm"), ["order", "refund", "composer"]);
  assert.deepEqual(route("refund_ask"), ["order", "composer"]);
  assert.deepEqual(route("refund_pick"), ["order", "composer"]);
  assert.deepEqual(route("refund_cancel"), ["composer"]);
  assert.deepEqual(route("other"), ["composer"]);
});

test("no route reaches the refund agent without confirming or being told the order", () => {
  /**
   * The two routes that raise money are the two that had an order reference:
   * one the customer typed, one the customer confirmed. Inference alone never
   * reaches the refund agent.
   */
  const raising = Object.entries(PIPELINES)
    .filter(([, pipeline]) => pipeline.includes("refund"))
    .map(([intent]) => intent)
    .sort();
  assert.deepEqual(raising, ["refund_confirm", "refund_request"]);
});

test("the refund agent is never reachable without the order agent", () => {
  for (const pipeline of Object.values(PIPELINES)) {
    const refund = pipeline.indexOf("refund");
    if (refund === -1) continue;
    const order = pipeline.indexOf("order");
    assert.notEqual(order, -1);
    assert.ok(order < refund);
  }

  assert.throws(() => assertWellFormed(["refund", "composer"]));
  assert.throws(() => assertWellFormed(["composer", "refund", "order"]));
  assert.doesNotThrow(() => assertWellFormed(["order", "refund", "composer"]));
});

/* ---------------------------------------------------------- determinism */

test("the same request twice produces the same trace", async () => {
  const first = await ask("scenario-02");
  fresh();
  const second = await ask("scenario-02");

  assert.deepEqual(second.tree, first.tree);
  assert.equal(second.reply, first.reply);
  assert.equal(second.refunds[0].id, first.refunds[0].id);
  assert.equal(second.refunds[0].proposedAt, first.refunds[0].proposedAt);
});

test("every supplied example replays identically", async () => {
  for (const s of loadScenarios()) {
    fresh();
    const first = await ask(s.scenario_id);
    fresh();
    const second = await ask(s.scenario_id);
    assert.deepEqual(
      JSON.stringify(second.tree),
      JSON.stringify(first.tree),
      `${s.scenario_id} did not replay identically`,
    );
  }
});

/* ------------------------------------------------------------ behaviour */

test("a delivery question is answered from the record, with no refund raised", async () => {
  const result = await ask("scenario-01");
  assert.equal(result.route, "order_status");
  assert.equal(result.outcome, "ok");
  assert.equal(result.refunds.length, 0);
  assert.match(result.reply, /DHL-ORD100-TEST/);
});

test("one broken unit of a two-unit line refunds the unit price, not the line", async () => {
  const result = await ask("scenario-02");
  const refund = result.refunds[0];

  assert.equal(result.outcome, "hold");
  assert.equal(refund.state, "held");
  assert.equal(refund.quantity, 1);
  assert.equal(refund.amountMinor, 1490);
  assert.notEqual(refund.amountMinor, 2980);
  assert.notEqual(refund.amountMinor, 5480);
});

test("an order belonging to another customer is answered as not found", async () => {
  const result = await ask("scenario-03");
  assert.equal(result.outcome, "blocked");
  assert.equal(result.refunds.length, 0);
  assert.doesNotMatch(result.reply, /ORD-204/);
  assert.doesNotMatch(result.reply, /permission|not allowed|another customer/i);
});

test("a customer's stated amount is recorded, flagged, and not paid", async () => {
  const result = await ask("scenario-04");
  const refund = result.refunds[0];

  assert.equal(refund.amountMinor, 2990);
  assert.notEqual(refund.amountMinor, 3490);
  assert.ok(refund.signals.some((s) => s.code === "claim_exceeds_record"));
  assert.ok(refund.signals.some((s) => s.code === "amount_mismatch"));
  assert.doesNotMatch(result.reply, /34\.90/);
});

test("no refund reaches a paid state without a human", async () => {
  for (const s of loadScenarios()) {
    fresh();
    const result = await ask(s.scenario_id);
    for (const refund of result.refunds) {
      assert.equal(refund.state, "held");
      assert.equal(refund.decidedBy, null);
      assert.equal(refund.decidedAt, null);
    }
  }
});

test("a message naming no order still gets an answer, and touches no record", async () => {
  const result = await runSupportRequest({
    customerId: "CUST-001",
    customerName: "Anna Petrova",
    sessionId: "SES-adhoc",
    message: "Hello, is anyone there?",
  });

  assert.equal(result.route, "other");
  assert.equal(result.refunds.length, 0);
  assert.ok(result.reply.length > 0);
});

test("an unseen refund request is handled on its merits, not by example", async () => {
  /**
   * Not one of the supplied four, and phrased nothing like them. If the mock
   * were a lookup table keyed on the example strings this would fall through
   * to nothing.
   */
  const result = await runSupportRequest({
    customerId: "CUST-001",
    customerName: "Anna Petrova",
    sessionId: "SES-unseen",
    message: "the decanter that came with ORD-200 turned up cracked, please send my money back",
  });

  const refund = result.refunds[0];
  assert.equal(result.route, "refund_request");
  assert.equal(refund.itemId, "ITEM-202");
  assert.equal(refund.amountMinor, 2500);
  assert.equal(refund.reasonCode, "damaged_on_arrival");
  assert.equal(refund.state, "held");
});

test("the clock is restored for anything that runs after this file", () => {
  setClock(systemClock);
  assert.ok(Date.now() - systemClock.now().getTime() < 1000);
});
