/**
 * Guard tests.
 *
 * These are the tests that would catch the failure the supplied data is
 * clearly probing for: ORD-204 belongs to CUST-002, and the third example
 * message authenticates as CUST-001 and asks about it.
 */
import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";

import { clearRuntime, putRecord } from "../../src/mock-env/runtime.ts";
import { customerContext, operatorContext } from "../../src/guard/auth-context.ts";
import { discloseOrder } from "../../src/guard/disclosure.ts";
import {
  createRuntimeOrder,
  explainNotFound,
  getOrder,
  insertRefund,
  listOrders,
  listRefunds,
} from "../../src/guard/scoped-store.ts";
import type { RefundRecord } from "../../src/core/refunds/types.ts";

/** Any timeline will do for the tests that are about scoping, not about time. */
const TIMELINE = {
  placedAt: "2026-09-13T09:00:00.000Z",
  paidAt: "2026-09-13T09:00:00.000Z",
  deliveredAt: "2026-09-17T09:00:00.000Z",
  cancelledAt: null,
};

const anna = () => customerContext("CUST-001");
const martin = () => customerContext("CUST-002");

beforeEach(() => clearRuntime());

test("a customer reads their own order", () => {
  const access = getOrder(anna(), "ORD-200");
  assert.equal(access.ok, true);
  assert.equal(access.ok && access.value.customerId, "CUST-001");
});

test("a customer cannot read someone else's order", () => {
  const access = getOrder(anna(), "ORD-204");
  assert.equal(access.ok, false);
});

test("an unowned order and a nonexistent one are indistinguishable", () => {
  const unowned = getOrder(anna(), "ORD-204");
  const absent = getOrder(anna(), "ORD-999");
  assert.deepEqual(unowned, absent);
});

test("the internal reason for a refusal is still recoverable, inside the guard", () => {
  assert.equal(explainNotFound(anna(), "ORD-204"), "ownership_denied");
  assert.equal(explainNotFound(anna(), "ORD-999"), "absent");
  assert.equal(explainNotFound(martin(), "ORD-204"), "absent");
});

test("listing is scoped to the principal", () => {
  const hers = listOrders(anna()).map((o) => o.orderId);
  assert.equal(hers.includes("ORD-204"), false);
  assert.equal(hers.includes("ORD-200"), true);

  /**
   * Asserted as a property rather than a literal list: adding an order to the
   * seed should not break a test about scoping.
   */
  const his = listOrders(martin());
  assert.ok(his.length > 0);
  assert.ok(his.every((o) => o.customerId === "CUST-002"));
  assert.ok(his.some((o) => o.orderId === "ORD-204"));
  assert.equal(
    his.some((o) => hers.includes(o.orderId)),
    false,
    "no order may appear in both accounts",
  );
});

test("an operator reads across accounts, a customer never does", () => {
  assert.equal(getOrder(operatorContext("op-1"), "ORD-204").ok, true);
  assert.equal(getOrder(anna(), "ORD-204").ok, false);
});

test("a disclosed order carries no owner id", () => {
  const access = getOrder(anna(), "ORD-200");
  assert.ok(access.ok);
  const disclosed = discloseOrder(access.value) as unknown as Record<string, unknown>;
  assert.equal("customer_id" in disclosed, false);
  assert.equal("customerId" in disclosed, false);
});

test("seed majors become exact minor units", () => {
  const access = getOrder(anna(), "ORD-200");
  assert.ok(access.ok);
  assert.equal(access.value.lines[0].unitPriceMinor, 1490);
  assert.equal(access.value.totalMinor, 5480);
});

test("a runtime order shadows a seed order, and clearing restores the seed", () => {
  const before = getOrder(anna(), "ORD-200");
  assert.equal(before.ok && before.value.status, "delivered");
  assert.equal(before.ok && before.value.origin, "seed");

  putRecord("orders", "ORD-200", {
    ...(before.ok ? before.value : {}),
    status: "in_transit",
    origin: "runtime",
  });

  const during = getOrder(anna(), "ORD-200");
  assert.equal(during.ok && during.value.status, "in_transit");
  /** One entry, not two. The overlay replaces, it does not duplicate. */
  assert.equal(listOrders(anna()).filter((o) => o.orderId === "ORD-200").length, 1);

  clearRuntime();
  const after = getOrder(anna(), "ORD-200");
  assert.equal(after.ok && after.value.status, "delivered");
});

test("a purchase cannot shadow a supplied order", () => {
  const refused = createRuntimeOrder(anna(), {
    orderId: "ORD-200",
    customerId: "CUST-001",
    status: "delivered",
    currency: "EUR",
    totalMinor: 1,
    lines: [{ itemId: "ITEM-201", name: "Wine Glass", quantity: 1, unitPriceMinor: 1 }],
    ...TIMELINE,
  });
  assert.equal(refused.ok, false);

  const still = getOrder(anna(), "ORD-200");
  assert.equal(still.ok && still.value.totalMinor, 5480);
});

test("an order cannot be created against another customer", () => {
  const refused = createRuntimeOrder(anna(), {
    orderId: "ORD-900",
    customerId: "CUST-002",
    status: "delivered",
    currency: "EUR",
    totalMinor: 100,
    lines: [{ itemId: "ITEM-999", name: "Thing", quantity: 1, unitPriceMinor: 100 }],
    ...TIMELINE,
  });
  assert.equal(refused.ok, false);
  assert.equal(getOrder(operatorContext("op-1"), "ORD-900").ok, false);
});

const refund = (customerId: string): RefundRecord => ({
  id: `REF-${customerId}`,
  sessionId: "SES-test",
  customerId,
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
});

test("refund records are scoped the same way orders are", () => {
  insertRefund(anna(), refund("CUST-001"));
  insertRefund(martin(), refund("CUST-002"));

  assert.deepEqual(
    listRefunds(anna()).map((r) => r.customerId),
    ["CUST-001"],
  );
  assert.equal(listRefunds(operatorContext("op-1")).length, 2);
});

test("a refund cannot be filed against another customer", () => {
  assert.equal(insertRefund(anna(), refund("CUST-002")).ok, false);
  assert.equal(listRefunds(operatorContext("op-1")).length, 0);
});
