/**
 * "What is the status of ORD-200?"
 *
 * A question about an order and a question about where that order has got to
 * are different questions, and until this existed they got the same answer.
 * These tests hold the difference in place: the keyword is caught by the same
 * text layer that catches the reference, and the reply that comes back leads
 * with the state and the date the order reached it.
 *
 * Nothing here asserts a sentence. Every expectation is a fact of the record
 * appearing in the answer, so rewording the reply does not break the suite but
 * dropping the facts does.
 */
import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";

import { clearRuntime } from "../../src/mock-env/runtime.ts";
import { customerContext } from "../../src/guard/auth-context.ts";
import { getOrder } from "../../src/guard/scoped-store.ts";
import { asksOrderStatus, classify } from "../../src/core/agents/triage/language.ts";
import { runSupportRequest, type SupportResult } from "../../src/core/orchestrator/run.ts";
import { REFUND_WINDOW_DAYS } from "../../src/core/refunds/schema.ts";
import { setClock } from "../../src/core/runtime/clock.ts";
import { sequentialIds, setIdSource } from "../../src/core/runtime/ids.ts";

const FIXED = new Date("2026-09-19T09:00:00.000Z");

beforeEach(() => {
  clearRuntime();
  setClock({ now: () => FIXED });
  setIdSource(sequentialIds());
});

let session = 0;
const ask = (message: string): Promise<SupportResult> =>
  runSupportRequest({
    customerId: "CUST-001",
    customerName: "Anna Petrova",
    sessionId: `SES-status-${session++}`,
    message,
  });

/* ------------------------------------------------------ catching the word */

test("the keyword is caught on its own, with or without a sentence around it", () => {
  for (const message of [
    "status of ORD-200",
    "ORD-200 status?",
    "What is the status of my order?",
    "STATUS ord 200",
  ]) {
    assert.equal(asksOrderStatus(message), true, `${message} should read as a status question`);
  }
});

test("the same question asked without the word is still caught", () => {
  for (const message of [
    "where is ORD-200",
    "has ORD-200 arrived yet",
    "any update on ORD-100",
    "when was it delivered",
    "is it shipped",
    "tracking for ORD-100",
  ]) {
    assert.equal(asksOrderStatus(message), true, `${message} should read as a status question`);
  }
});

test("a message that merely mentions ordering is not a status question", () => {
  assert.equal(asksOrderStatus("I ordered 3 wine glasses last week"), false);
  assert.equal(asksOrderStatus("refund ORD-200 please"), false);
  assert.equal(asksOrderStatus("yes"), false);
});

test("a refund that describes a delivery stays a refund", () => {
  const message = "The decanter in ORD-200 arrived cracked, I want a refund";
  assert.equal(classify(message), "refund_request");
  /**
   * The words are there, which is exactly why the intent is checked first:
   * this customer wants their money back, not a delivery date.
   */
  assert.equal(asksOrderStatus(message), true);
});

/* --------------------------------------------------------- what comes back */

test("a status question is answered with the state and when it was reached", async () => {
  const result = await ask("What is the status of ORD-200?");

  assert.equal(result.outcome, "ok");
  assert.match(result.reply, /ORD-200/);
  assert.match(result.reply, /delivered/i);
  /** The arrival date, written out, and how long ago that was. */
  assert.match(result.reply, /17 September/);
  assert.match(result.reply, /2 days ago/);

  /** And the triage node records why the answer took that shape. */
  const triage = result.tree.find((node) => node.label === "Triage");
  assert.equal((triage?.payload as { asks_status?: boolean } | undefined)?.asks_status, true);
});

test("the days left to act are the days the rule would allow", async () => {
  const access = getOrder(customerContext("CUST-001"), "ORD-200");
  assert.ok(access.ok);

  const arrived = Math.floor(
    (FIXED.getTime() - Date.parse(access.value.deliveredAt ?? "")) / 86_400_000,
  );
  const left = REFUND_WINDOW_DAYS - arrived;

  const result = await ask("status of ORD-200");
  assert.match(result.reply, new RegExp(`${left} days left`));
});

test("an order still moving is not reported as arrived", async () => {
  const result = await ask("where is ORD-100?");
  assert.match(result.reply, /on its way/i);
  assert.match(result.reply, /not arrived/i);
  /** No refund window is quoted, because none has started. */
  assert.equal(/left to ask for a refund/.test(result.reply), false);
});

test("naming an order without asking anything still describes it, not its progress", async () => {
  const result = await ask("ORD-200");
  assert.match(result.reply, /ORD-200/);
  /** The plain description, so no arrival date is volunteered. */
  assert.equal(/17 September/.test(result.reply), false);
});

test("a status question about somebody else's order is refused, not answered", async () => {
  /** ORD-204 belongs to CUST-002. The keyword changes nothing about that. */
  const result = await ask("what is the status of ORD-204?");
  assert.equal(result.outcome, "blocked");
  assert.equal(/delivered/i.test(result.reply), false);
});
