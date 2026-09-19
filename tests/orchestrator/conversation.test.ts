/**
 * The conversation, across turns.
 *
 * A session is not a request, and these are the properties that only show up
 * once there is more than one message in it: what "that order" refers to, what
 * "yes" is a yes to, and what happens when it is a yes to nothing.
 *
 * Nothing here asserts a hardcoded pipeline outcome. Every expectation is
 * about what the kernel and the conversation state make true together, and the
 * kernel is still the only thing deciding.
 */
import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";

import { clearRuntime } from "../../src/mock-env/runtime.ts";
import { customerContext } from "../../src/guard/auth-context.ts";
import { readSessionContext, validateSessionToken, sessionToken } from "../../src/guard/sessions.ts";
import { setClock } from "../../src/core/runtime/clock.ts";
import { sequentialIds, setIdSource } from "../../src/core/runtime/ids.ts";
import { classify, isAffirmation, isNegation } from "../../src/core/agents/triage/language.ts";
import { orderReferences } from "../../src/core/text/figures.ts";
import { runSupportRequest, type SupportResult } from "../../src/core/orchestrator/run.ts";

const FIXED = new Date("2026-09-19T09:00:00.000Z");

beforeEach(() => {
  clearRuntime();
  setClock({ now: () => FIXED });
  setIdSource(sequentialIds());
});

/** One customer, one conversation, many turns. */
const chat = (sessionId = "SES-live") => {
  return (message: string): Promise<SupportResult> =>
    runSupportRequest({
      customerId: "CUST-001",
      customerName: "Anna Petrova",
      sessionId,
      message,
    });
};

const contextOf = (sessionId = "SES-live") => {
  const access = readSessionContext(customerContext("CUST-001"), sessionId, "CUST-001");
  return access.ok ? access.value : null;
};

/* ------------------------------------------------------- what triage sees */

test("an order reference is caught however the customer spells it", () => {
  assert.deepEqual(orderReferences("Where is order ORD-100?"), ["ORD-100"]);
  assert.deepEqual(orderReferences("order-1002 please"), ["ORD-1002"]);
  assert.deepEqual(orderReferences("ORDER-1002"), ["ORD-1002"]);
  assert.deepEqual(orderReferences("what about order 200"), ["ORD-200"]);
  assert.deepEqual(orderReferences("check #300 for me"), ["ORD-300"]);
  assert.deepEqual(orderReferences("ord 100 and ORD-200"), ["ORD-100", "ORD-200"]);
});

test("a past tense verb is not an order reference", () => {
  assert.deepEqual(orderReferences("I ordered 3 wine glasses last week"), []);
});

test("a bare reference is a lookup, and a refund word beats a status word", () => {
  assert.equal(classify("ORD-200"), "order_status");
  assert.equal(classify("where is my stuff"), "order_status");
  assert.equal(classify("refund"), "refund_request");
  assert.equal(classify("it was delivered broken, refund please"), "refund_request");
  assert.equal(classify("hello"), "other");
});

test("only a bare yes or no counts as an answer", () => {
  for (const yes of ["yes", "Yes.", "yep", "ok", "go ahead", "that's the one"]) {
    assert.equal(isAffirmation(yes), true, yes);
  }
  for (const no of ["no", "nope", "wrong", "that's not it", "cancel"]) {
    assert.equal(isNegation(no), true, no);
  }
  /** A qualified answer is a new request, which is the safer reading. */
  assert.equal(isAffirmation("yes but I meant the other order"), false);
  assert.equal(classify("yes but refund the decanter instead"), "refund_request");
});

/* --------------------------------------------------- the three turn flow */

test("name an order, ask for a refund, confirm: the refund is held", async () => {
  const say = chat();

  const lookup = await say("order-200");
  assert.equal(lookup.route, "order_status");
  assert.equal(lookup.outcome, "ok");
  assert.match(lookup.reply, /ORD-200/);
  assert.equal(contextOf()?.lastOrderId, "ORD-200");

  const asked = await say("refund");
  assert.equal(asked.route, "refund_ask");
  assert.equal(asked.refunds.length, 0, "nothing may be raised before confirmation");
  assert.match(asked.reply, /confirm/i);
  assert.equal(contextOf()?.pending?.orderId, "ORD-200");

  const confirmed = await say("yes");
  assert.equal(confirmed.route, "refund_confirm");
  assert.equal(confirmed.outcome, "hold");

  const refund = confirmed.refunds[0];
  assert.equal(refund.orderId, "ORD-200");
  assert.equal(refund.state, "held");
  assert.equal(refund.decidedBy, null);

  /** The question is spent. A second yes is not a second refund. */
  assert.equal(contextOf()?.pending, null);
});

test("saying no raises nothing and clears the question", async () => {
  const say = chat();
  await say("ORD-200");
  await say("I want a refund");
  assert.equal(contextOf()?.pending?.orderId, "ORD-200");

  const cancelled = await say("no");
  assert.equal(cancelled.route, "refund_cancel");
  assert.equal(cancelled.refunds.length, 0);
  assert.equal(contextOf()?.pending, null);
});

test("yes with nothing outstanding raises nothing", async () => {
  const say = chat();
  const result = await say("yes");

  assert.equal(result.route, "other");
  assert.equal(result.refunds.length, 0);
  assert.equal(contextOf()?.pending ?? null, null);
});

test("the same yes cannot be spent twice", async () => {
  const say = chat();
  await say("ORD-200");
  await say("refund");
  const first = await say("yes");
  const second = await say("yes");

  assert.equal(first.refunds.length, 1);
  assert.equal(second.refunds.length, 0);
  assert.equal(second.route, "other");
});

test("asking for a refund with no order in play offers the account to choose from", async () => {
  const say = chat();
  const result = await say("I want a refund");

  assert.equal(result.route, "refund_pick");
  assert.equal(result.refunds.length, 0);
  /** The choice offered is the record, not a guess: every order is the customer's own. */
  assert.ok(result.reply.includes("ORD-100"));
  assert.ok(result.reply.includes("ORD-200"));
  assert.equal(result.reply.includes("ORD-204"), false);
});

test("naming the order and the fault in one message needs no confirmation", async () => {
  const say = chat();
  const result = await say("the decanter in ORD-200 arrived cracked, refund it");

  assert.equal(result.route, "refund_request");
  assert.equal(result.refunds[0]?.itemId, "ITEM-202");
  assert.equal(contextOf()?.pending ?? null, null);
});

test("a confirmed order still has to pass every rule", async () => {
  const say = chat();
  /** ORD-100 is in transit, so confirming it cannot make it refundable. */
  await say("ORD-100");
  await say("refund");
  const result = await say("yes");

  assert.equal(result.route, "refund_confirm");
  assert.equal(result.refunds.length, 0);
  assert.equal(result.outcome, "blocked");
  assert.match(result.reply, /not been delivered/i);
});

test("confirming an order that is not the customer's is still not found", async () => {
  const say = chat();
  const lookup = await say("ORD-204");

  assert.equal(lookup.outcome, "blocked");
  assert.equal(contextOf()?.lastOrderId ?? null, null, "a refused order does not become context");

  const refund = await say("refund");
  assert.equal(refund.route, "refund_pick", "nothing was established, so nothing is assumed");
  assert.equal(refund.reply.includes("ORD-204"), false);
});

/* ------------------------------------------------------- sessions, tokens */

test("each conversation gets its own token, and it is stable across turns", async () => {
  const first = sessionToken("CUST-001", "SES-a");
  const second = sessionToken("CUST-001", "SES-a");
  const other = sessionToken("CUST-001", "SES-b");

  assert.equal(first.token, second.token);
  assert.notEqual(first.token, other.token);
  assert.equal(validateSessionToken(first.token, "CUST-001").valid, true);
  assert.equal(validateSessionToken(first.token, "CUST-002").valid, false);
  assert.equal(validateSessionToken("TOK-made-up", "CUST-001").valid, false);
});

test("what one conversation establishes does not leak into another", async () => {
  await chat("SES-one")("ORD-200");
  await chat("SES-two")("hello");

  assert.equal(contextOf("SES-one")?.lastOrderId, "ORD-200");
  assert.equal(contextOf("SES-two")?.lastOrderId ?? null, null);

  /** So "refund" in the second conversation has nothing to act on. */
  const result = await chat("SES-two")("refund");
  assert.equal(result.route, "refund_pick");
  assert.equal(result.refunds.length, 0);
});

test("another customer cannot read this conversation's context", async () => {
  await chat("SES-one")("ORD-200");

  const theirs = readSessionContext(customerContext("CUST-002"), "SES-one", "CUST-001");
  assert.equal(theirs.ok, false);
});

/* -------------------------------------------------------------- the log */

test("every line the pipeline logs is info and carries its session id", async () => {
  const say = chat();
  await say("ORD-200");
  const result = await say("refund");

  assert.ok(result.logs.length > 0);
  for (const line of result.logs) {
    assert.equal(line.level, "info", line.message);
    assert.equal(line.sessionId, "SES-live");
    assert.ok(line.scope.length > 0);
  }
});

test("the session check appears in the trace of every tool call", async () => {
  const result = await chat()("ORD-200");

  const labels = result.tree
    .flatMap((node) => node.children ?? [])
    .map((node) => node.label);

  assert.ok(labels.includes("Session check"));
  assert.ok(labels.includes("check_session"));
  assert.ok(labels.includes("Auth binding"));
});
