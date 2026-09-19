/**
 * The guard the agents run before they propose anything.
 *
 * It is not an authority, and the last two tests are the ones that say so: the
 * kernel refuses the same things from its own side whatever this returns. What
 * the agent guard buys is that the bad proposal is never made, so a trace
 * shows an agent that declined rather than one that tried.
 */
import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";

import { clearRuntime } from "../../src/mock-env/runtime.ts";
import type { DisclosedOrder } from "../../src/guard/disclosure.ts";
import { discloseOrder } from "../../src/guard/disclosure.ts";
import { customerContext, operatorContext } from "../../src/guard/auth-context.ts";
import { getOrder } from "../../src/guard/scoped-store.ts";
import { sessionToken } from "../../src/guard/sessions.ts";
import {
  guardRefundProposal,
  lookupSession,
  requireLiveSession,
  requireNoNamedIdentity,
  requireRetrievedOrder,
} from "../../src/core/agents/common/guard.ts";
import { execute, type Envelope } from "../../src/core/kernel/kernel.ts";
import { GRANTS } from "../../src/core/kernel/tools.ts";
import { setClock } from "../../src/core/runtime/clock.ts";
import { sequentialIds, setIdSource } from "../../src/core/runtime/ids.ts";

const NOW = new Date("2026-09-19T09:00:00.000Z");

beforeEach(() => {
  clearRuntime();
  setClock({ now: () => NOW });
  setIdSource(sequentialIds());
});

/** What the kernel actually returns for check_session, not a hand-written copy. */
const sessionResult = (customerId: string, sessionId: string) =>
  execute(
    "refund",
    { id: "t", name: "check_session", input: {} },
    {
      customerId,
      sessionId,
      sessionToken: sessionToken(customerId, sessionId).token,
      message: "",
      statedAmountsMinor: [],
    },
  ).result;

const disclosed = (ctx: ReturnType<typeof customerContext>, orderId: string): DisclosedOrder => {
  const access = getOrder(ctx, orderId);
  if (!access.ok) throw new Error(`${orderId} not readable`);
  return discloseOrder(access.value);
};

/* --------------------------------------------------------- the db lookup */

test("the lookup reads the session out of the tool results", () => {
  const session = lookupSession([sessionResult("CUST-001", "SES-a")]);
  assert.equal(session?.valid, true);
  assert.equal(session?.sessionId, "SES-a");
});

test("no lookup and a failed lookup are different refusals", () => {
  const missing = requireLiveSession(null);
  assert.equal(missing.ok, false);
  assert.equal(missing.ok === false && missing.reason, "no_session_lookup");

  const dead = { valid: false, sessionId: "SES-a", lastOrderId: null, awaitingConfirmation: null };
  const stale = requireLiveSession(dead);
  assert.equal(stale.ok === false && stale.reason, "session_not_live");
});

test("the lookup never tells the agent whose account it is", () => {
  const result = sessionResult("CUST-001", "SES-a") as Record<string, unknown>;
  assert.equal("customer_id" in result, false);
  assert.equal("customerId" in result, false);

  const session = lookupSession([result]);
  assert.equal(Object.keys(session ?? {}).includes("customerId"), false);
});

/* ------------------------------------------------------------- ownership */

test("an order that no scoped read returned cannot be acted on", () => {
  const anna = customerContext("CUST-001");
  const hers = [disclosed(anna, "ORD-200")];

  assert.equal(requireRetrievedOrder(hers, "ORD-200").ok, true);

  /**
   * ORD-204 is real and belongs to CUST-002. Anna's reads never return it, so
   * the agent has nothing to act on and cannot tell that from an order that
   * does not exist.
   */
  const refused = requireRetrievedOrder(hers, "ORD-204");
  assert.equal(refused.ok, false);
  assert.equal(refused.ok === false && refused.reason, "order_not_retrieved");

  const invented = requireRetrievedOrder(hers, "ORD-999");
  assert.equal(invented.ok === false && invented.reason, "order_not_retrieved");
});

test("one customer's retrieved orders are never another's", () => {
  const annas = [disclosed(customerContext("CUST-001"), "ORD-200")];
  const martins = [disclosed(customerContext("CUST-002"), "ORD-204")];

  assert.equal(requireRetrievedOrder(annas, "ORD-204").ok, false);
  assert.equal(requireRetrievedOrder(martins, "ORD-200").ok, false);
});

test("an agent may not name whose money it is", () => {
  assert.equal(requireNoNamedIdentity({ order_id: "ORD-200", quantity: 1 }).ok, true);

  for (const field of ["customer_id", "customerId", "wallet_owner", "account_id", "owner_id"]) {
    const verdict = requireNoNamedIdentity({ order_id: "ORD-200", [field]: "CUST-002" });
    assert.equal(verdict.ok, false, `${field} should be refused`);
    assert.equal(verdict.ok === false && verdict.reason, "identity_named_by_agent");
  }
});

/* ------------------------------------------------------------- composed */

test("the composed guard passes a proposal that has nothing wrong with it", () => {
  const anna = customerContext("CUST-001");
  const verdict = guardRefundProposal({
    session: lookupSession([sessionResult("CUST-001", "SES-a")]),
    retrieved: [disclosed(anna, "ORD-200")],
    orderId: "ORD-200",
    proposal: { order_id: "ORD-200", item_id: "ITEM-201", quantity: 1 },
  });
  assert.equal(verdict.ok, true);
});

test("the composed guard reports which half failed", () => {
  const anna = customerContext("CUST-001");
  const retrieved = [disclosed(anna, "ORD-200")];

  const noSession = guardRefundProposal({
    session: null,
    retrieved,
    orderId: "ORD-200",
    proposal: {},
  });
  assert.equal(noSession.ok === false && noSession.reason, "no_session_lookup");

  const wrongOrder = guardRefundProposal({
    session: lookupSession([sessionResult("CUST-001", "SES-a")]),
    retrieved,
    orderId: "ORD-204",
    proposal: {},
  });
  assert.equal(wrongOrder.ok === false && wrongOrder.reason, "order_not_retrieved");

  const namedOwner = guardRefundProposal({
    session: lookupSession([sessionResult("CUST-001", "SES-a")]),
    retrieved,
    orderId: "ORD-200",
    proposal: { customer_id: "CUST-002" },
  });
  assert.equal(namedOwner.ok === false && namedOwner.reason, "identity_named_by_agent");
});

/* -------------------------------------- the kernel does not rely on it */

test("the kernel refuses the same things on its own, whatever the agent guard said", () => {
  const envelope: Envelope = {
    customerId: "CUST-001",
    sessionId: "SES-a",
    sessionToken: sessionToken("CUST-001", "SES-a").token,
    message: "",
    statedAmountsMinor: [],
  };

  /** Straight past the agent guard, proposing on somebody else's order. */
  const other = execute(
    "refund",
    {
      id: "t",
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
    envelope,
  );
  assert.equal(other.code, "not_found");
  assert.equal(other.refund, undefined);

  /** And naming an owner is overwritten rather than obeyed. */
  const named = execute(
    "refund",
    {
      id: "t",
      name: "propose_refund",
      input: {
        order_id: "ORD-200",
        item_id: "ITEM-201",
        quantity: 1,
        amount_minor: 1490,
        reason_code: "damaged_on_arrival",
        certainty: 90,
        customer_id: "CUST-002",
      },
    },
    envelope,
  );
  assert.equal(named.refund?.customerId, "CUST-001");
  assert.ok(named.signals.some((s) => s.code === "identity_override_attempt"));
});

test("only the agents that can act hold the session lookup", () => {
  assert.ok(GRANTS.order.includes("check_session"));
  assert.ok(GRANTS.refund.includes("check_session"));
  assert.equal(GRANTS.triage.length, 0);
  assert.equal(GRANTS.composer.length, 0);
});

test("an operator reads across accounts, which is why the guard is per principal", () => {
  assert.equal(getOrder(operatorContext("op-1"), "ORD-204").ok, true);
  assert.equal(getOrder(customerContext("CUST-001"), "ORD-204").ok, false);
});
