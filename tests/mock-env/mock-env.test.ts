/**
 * Smoke test for the mock commerce environment.
 *
 * Verifies infrastructure properties only, as the brief requires:
 *   - the seed data can be loaded;
 *   - temporary runtime data can be stored and read;
 *   - temporary runtime state can be cleared;
 *   - the original seed files remain unchanged.
 *
 * It asserts nothing about business behaviour: no refund rule, no
 * authorization, no expected outcome for any customer request. The brief
 * forbids that here, and the folder name is what keeps the constraint visible:
 * a test that needs to know what an order status means belongs in
 * tests/kernel/ or tests/orchestrator/, not in this one.
 */
import { createHash } from "node:crypto";
import { readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import assert from "node:assert/strict";
import { after, before, test } from "node:test";

import {
  MUTABLE_DIR,
  SEED_DIR,
  SEED_FILES,
  clearMutable,
  clearRuntime,
  getRecord,
  listCollections,
  listRecords,
  loadCustomers,
  loadOrders,
  loadProducts,
  loadScenarios,
  putRecord,
  readMutable,
  writeMutable,
} from "../../src/mock-env/index.ts";

const digest = (file: string) =>
  createHash("sha256").update(readFileSync(join(SEED_DIR, file))).digest("hex");

const fingerprint = () => Object.fromEntries(SEED_FILES.map((f) => [f, digest(f)]));

let before_: Record<string, string>;

before(() => {
  before_ = fingerprint();
});

test("the seed data can be loaded", () => {
  const customers = loadCustomers();
  const orders = loadOrders();
  const products = loadProducts();
  const scenarios = loadScenarios();

  for (const [label, rows] of Object.entries({ customers, orders, products, scenarios })) {
    assert.ok(Array.isArray(rows), `${label} should load as an array`);
    assert.ok(rows.length > 0, `${label} should not be empty`);
  }

  assert.ok(customers.every((c) => typeof c.customer_id === "string"));
  assert.ok(orders.every((o) => typeof o.order_id === "string" && Array.isArray(o.items)));
  assert.ok(products.every((p) => Number.isInteger(p.unit_price_minor)));
  assert.ok(scenarios.every((s) => typeof s.message === "string"));
});

test("loaded seed data cannot be mutated in place", () => {
  const [order] = loadOrders();
  assert.throws(() => {
    (order as { status: string }).status = "mutated";
  }, TypeError);
  assert.notEqual(loadOrders()[0].status, "mutated");
});

test("temporary runtime data can be stored and read", () => {
  putRecord("probe", "probe-1", { note: "written by the smoke test", n: 1 });
  putRecord("probe", "probe-2", { note: "second", n: 2 });

  assert.deepEqual(getRecord("probe", "probe-1"), {
    note: "written by the smoke test",
    n: 1,
  });
  assert.equal(listRecords("probe").length, 2);
  assert.ok(listCollections().includes("probe"));
});

test("temporary runtime state can be cleared", () => {
  putRecord("probe", "probe-3", { n: 3 });
  assert.ok(listRecords("probe").length > 0);

  clearRuntime();

  assert.equal(listRecords("probe").length, 0);
  assert.equal(getRecord("probe", "probe-3"), undefined);
  assert.deepEqual(listCollections(), []);
});

test("the mutable half of the seed stores and reads generated data", () => {
  writeMutable("probe.json", [{ id: "probe-1", note: "written by the smoke test" }]);
  assert.deepEqual(readMutable("probe.json"), [
    { id: "probe-1", note: "written by the smoke test" },
  ]);
});

test("clearing the mutable half empties it without touching the immutable half", () => {
  writeMutable("probe.json", [{ id: "probe-2" }]);
  clearMutable();
  assert.deepEqual(readMutable("probe.json"), []);
});

test("a cleared runtime still loads the same seed data", () => {
  clearRuntime();
  assert.equal(loadOrders().length, JSON.parse(readFileSync(join(SEED_DIR, "orders.json"), "utf8")).length);
});

after(() => {
  // The probe file is this test's own litter, not runtime state.
  rmSync(join(MUTABLE_DIR, "probe.json"), { force: true });

  assert.deepEqual(
    fingerprint(),
    before_,
    "seed files were modified while the mock environment ran",
  );
});
