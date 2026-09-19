/**
 * Buying something, and then being able to ask about it.
 *
 * The point of these is the join. A purchase that only existed in the buyer's
 * tab looked like it worked and nothing outside that tab had ever heard of it:
 * the assistant could not find the order, and the operator could not see it.
 * So most of what is asserted here is that one thing is visible from three
 * places at once.
 *
 * These tests write to `data/seed/mutable/orders.json`, which is what the
 * running app writes to, and clear up after themselves.
 */
import assert from "node:assert/strict";
import { after, beforeEach, test } from "node:test";

import { clearRuntime } from "../../src/mock-env/runtime.ts";
import { readMutable } from "../../src/mock-env/mutable.ts";
import { loadProducts } from "../../src/mock-env/seed.ts";
import { customerContext, operatorContext } from "../../src/guard/auth-context.ts";
import {
  getOrder,
  listOrders,
  resetPurchasedOrders,
} from "../../src/guard/scoped-store.ts";
import { sessionToken } from "../../src/guard/sessions.ts";
import { placeOrder } from "../../src/core/orders/place.ts";
import { customerOrders, operatorOrders } from "../../src/core/orders/views.ts";
import { execute } from "../../src/core/kernel/kernel.ts";
import { runSupportRequest } from "../../src/core/orchestrator/run.ts";
import { setClock } from "../../src/core/runtime/clock.ts";
import { sequentialIds, setIdSource } from "../../src/core/runtime/ids.ts";

const NOW = new Date("2026-09-19T09:00:00.000Z");
const anna = () => customerContext("CUST-001");

beforeEach(() => {
  clearRuntime();
  resetPurchasedOrders();
  setClock({ now: () => NOW });
  setIdSource(sequentialIds());
});

/** Leave the environment as it was found. */
after(() => {
  clearRuntime();
  resetPurchasedOrders();
});

const tumbler = () => {
  const product = loadProducts().find((p) => p.item_id === "ITEM-203");
  if (!product) throw new Error("ITEM-203 missing from the product master");
  return product;
};

/* --------------------------------------------------------------- pricing */

test("the server prices the basket, the client does not", () => {
  const result = placeOrder("CUST-001", [{ itemId: "ITEM-203", quantity: 2 }]);
  assert.ok(result.ok);
  assert.equal(result.order.totalMinor, tumbler().unit_price_minor * 2);
  assert.equal(result.order.lines[0].unitPriceMinor, tumbler().unit_price_minor);
});

test("a product that does not exist cannot be bought", () => {
  const result = placeOrder("CUST-001", [{ itemId: "ITEM-999", quantity: 1 }]);
  assert.equal(result.ok, false);
});

test("a quantity that is not a whole number of things is refused", () => {
  for (const quantity of [0, -1, 1.5]) {
    const result = placeOrder("CUST-001", [{ itemId: "ITEM-203", quantity }]);
    assert.equal(result.ok, false, `quantity ${quantity} should be refused`);
  }
});

test("an empty basket buys nothing", () => {
  assert.equal(placeOrder("CUST-001", []).ok, false);
  assert.equal(placeOrder("", [{ itemId: "ITEM-203", quantity: 1 }]).ok, false);
});

/* ------------------------------------------------------------ references */

test("a purchased reference is one the customer could type into the chat", () => {
  const result = placeOrder("CUST-001", [{ itemId: "ITEM-203", quantity: 1 }]);
  assert.ok(result.ok);

  /**
   * Digits, because that is what the chat recognises. A reference nobody can
   * type is a reference the assistant can never be asked about, which was the
   * flaw in the version that invented one in the browser.
   */
  assert.match(result.order.orderId, /^ORD-\d+$/);
  assert.ok(Number(result.order.orderId.replace(/\D/g, "")) >= 500);
});

test("references do not collide with the seed, or with each other", () => {
  const first = placeOrder("CUST-001", [{ itemId: "ITEM-203", quantity: 1 }]);
  const second = placeOrder("CUST-001", [{ itemId: "ITEM-104", quantity: 1 }]);
  assert.ok(first.ok && second.ok);
  assert.notEqual(first.order.orderId, second.order.orderId);

  const seeded = ["ORD-100", "ORD-200", "ORD-204", "ORD-300", "ORD-401", "ORD-405"];
  assert.equal(seeded.includes(first.order.orderId), false);
  assert.equal(seeded.includes(second.order.orderId), false);
});

/* ------------------------------------------------------------ visibility */

test("what was bought is visible to the buyer, the operator, and on disk", () => {
  const result = placeOrder("CUST-001", [{ itemId: "ITEM-203", quantity: 2 }]);
  assert.ok(result.ok);
  const id = result.order.orderId;

  /** The buyer, through the guard. */
  assert.equal(getOrder(anna(), id).ok, true);

  /** The operator, in the orders view. */
  assert.ok(listOrders(operatorContext("op-1")).some((o) => o.orderId === id));

  /** And the mutable half of the seed, so it survives a restart. */
  const onDisk = readMutable<{ orderId: string }>("orders.json");
  assert.ok(onDisk.some((o) => o.orderId === id));
});

test("a purchase cannot be placed on somebody else's account", () => {
  const result = placeOrder("CUST-001", [{ itemId: "ITEM-203", quantity: 1 }]);
  assert.ok(result.ok);

  /** CUST-002 never sees it, which is the same rule the seed orders follow. */
  const theirs = listOrders(customerContext("CUST-002")).map((o) => o.orderId);
  assert.equal(theirs.includes(result.order.orderId), false);
  assert.equal(getOrder(customerContext("CUST-002"), result.order.orderId).ok, false);
});

test("a reset clears purchases and leaves the supplied data alone", () => {
  placeOrder("CUST-001", [{ itemId: "ITEM-203", quantity: 1 }]);
  assert.equal(resetPurchasedOrders().removed, 1);

  assert.equal(readMutable("orders.json").length, 0);
  /** The seed is still there afterwards. */
  assert.equal(getOrder(anna(), "ORD-200").ok, true);
});

/* ------------------------------------------------ the assistant can act */

test("the assistant can answer about an order that was just bought", async () => {
  const bought = placeOrder("CUST-001", [{ itemId: "ITEM-203", quantity: 2 }]);
  assert.ok(bought.ok);

  const result = await runSupportRequest({
    customerId: "CUST-001",
    customerName: "Anna Petrova",
    sessionId: "SES-bought",
    message: `where is order ${bought.order.orderId}`,
  });

  assert.equal(result.outcome, "ok");
  assert.ok(result.reply.includes(bought.order.orderId));
  assert.ok(result.reply.includes("Tumbler"));
});

test("a purchase is refundable straight away, at the price it was sold for", () => {
  const bought = placeOrder("CUST-001", [{ itemId: "ITEM-203", quantity: 2 }]);
  assert.ok(bought.ok);

  const held = execute(
    "refund",
    {
      id: "toolu-1",
      name: "propose_refund",
      input: {
        order_id: bought.order.orderId,
        item_id: "ITEM-203",
        quantity: 1,
        amount_minor: tumbler().unit_price_minor,
        reason_code: "damaged_on_arrival",
        certainty: 85,
      },
    },
    {
      customerId: "CUST-001",
      sessionId: "SES-bought",
      sessionToken: sessionToken("CUST-001", "SES-bought").token,
      message: "",
      statedAmountsMinor: [],
    },
  );

  assert.equal(held.status, "hold");
  assert.equal(held.refund?.amountMinor, tumbler().unit_price_minor);
  assert.equal(held.refund?.state, "held");
});

test("another customer cannot refund what this one bought", () => {
  const bought = placeOrder("CUST-001", [{ itemId: "ITEM-203", quantity: 2 }]);
  assert.ok(bought.ok);

  const result = execute(
    "refund",
    {
      id: "toolu-1",
      name: "propose_refund",
      input: {
        order_id: bought.order.orderId,
        item_id: "ITEM-203",
        quantity: 1,
        amount_minor: tumbler().unit_price_minor,
        reason_code: "damaged_on_arrival",
        certainty: 99,
      },
    },
    {
      customerId: "CUST-002",
      sessionId: "SES-theirs",
      sessionToken: sessionToken("CUST-002", "SES-theirs").token,
      message: "",
      statedAmountsMinor: [],
    },
  );

  assert.equal(result.code, "not_found");
  assert.equal(result.refund, undefined);
});

/* ----------------------------------------------- what each role is shown */

test("a customer's own list holds their orders and nobody else's", () => {
  const bought = placeOrder("CUST-001", [{ itemId: "ITEM-203", quantity: 1 }]);
  assert.ok(bought.ok);

  const hers = customerOrders("CUST-001").map((o) => o.orderId);
  assert.ok(hers.includes(bought.order.orderId));
  assert.ok(hers.includes("ORD-200"));

  /** ORD-204 is CUST-002's. The shop's Orders tab reads through the same guard
   *  the assistant does, so it cannot show a row the chat would refuse. */
  assert.equal(hers.includes("ORD-204"), false);
  const theirs = customerOrders("CUST-002").map((o) => o.orderId);
  assert.equal(theirs.includes(bought.order.orderId), false);
});

test("nothing in a customer's own list names the account it belongs to", () => {
  const [first] = customerOrders("CUST-001");
  assert.ok(first);
  assert.equal("customerId" in first, false);
});

test("the operator sees every account, and what has been raised on each", () => {
  const all = operatorOrders("op-1").map((o) => o.orderId);
  assert.ok(all.includes("ORD-200"));
  assert.ok(all.includes("ORD-204"));
  assert.ok(operatorOrders("op-1").every((o) => typeof o.refundCount === "number"));
});

test("both views resolve the refund window from the same rule", () => {
  const mine = customerOrders("CUST-001").find((o) => o.orderId === "ORD-200");
  const theirs = operatorOrders("op-1").find((o) => o.orderId === "ORD-200");
  assert.equal(mine?.windowDaysLeft, theirs?.windowDaysLeft);
});
