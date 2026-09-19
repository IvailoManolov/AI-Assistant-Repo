/**
 * Seed loading for the mock commerce environment.
 *
 * Scaffolding only. This module knows the shape of the supplied data and
 * nothing about what any of it means. It defines no refund structure, no
 * lifecycle, no authorization rule, and no expectation about how any customer
 * request should be handled. Those belong to the solution, not here.
 *
 * data/seed is split in two. The immutable half is source data: supplied by
 * the brief, or authored once, and never written. The mutable half is
 * generated during use and is the only thing a reset touches. This module
 * owns the immutable half; see mutable.ts for the other.
 *
 * Immutable files are read once and deep frozen. Nothing in the process can
 * write them, so restarting restores their state by construction.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

export type SeedCustomer = {
  customer_id: string;
  name: string;
  email: string;
};

export type SeedOrderItem = {
  item_id: string;
  name: string;
  quantity: number;
  unit_price: number;
  /** Present on some lines in the supplied data. Its meaning is not defined here. */
  return_status?: string;
};

export type SeedOrder = {
  order_id: string;
  customer_id: string;
  status: string;
  currency: string;
  total: number;
  items: SeedOrderItem[];
  shipping?: { carrier: string; tracking_number: string };
  /**
   * Present on authored orders only. The supplied file carries no dates and no
   * payment flag, and it cannot be edited, so the four orders in it get their
   * timeline from a table instead. See guard/timeline.ts.
   */
  paid?: boolean;
  placed_days_ago?: number;
  delivered_days_ago?: number;
  cancelled_days_ago?: number;
};

/** Local product master. Not part of the supplied data. See data/seed/README.md. */
export type SeedProduct = {
  item_id: string;
  name: string;
  unit_price_minor: number;
  currency: string;
  category: string;
  material: string;
  blurb: string;
  listed: boolean;
};

export type SeedScenario = {
  scenario_id: string;
  authenticated_customer_id: string;
  message: string;
};

export const SEED_DIR = join(process.cwd(), "data", "seed", "immutable");

export const SEED_FILES = [
  "customers.json",
  "orders.json",
  "orders-local.json",
  "items.json",
  "scenarios.json",
  "recorded-sessions.json",
] as const;

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const key of Object.keys(value as object)) {
      deepFreeze((value as Record<string, unknown>)[key]);
    }
  }
  return value;
}

/** Reads any immutable seed file. Callers that have a type for it cast. */
export function readImmutable<T>(file: string): readonly T[] {
  const raw = readFileSync(join(SEED_DIR, file), "utf8");
  const parsed = JSON.parse(raw) as T[];
  if (!Array.isArray(parsed)) throw new Error(`Seed file ${file} is not an array.`);
  return deepFreeze(parsed);
}

const read = readImmutable;

let customers: readonly SeedCustomer[] | null = null;
let orders: readonly SeedOrder[] | null = null;
let authoredOrders: readonly SeedOrder[] | null = null;
let products: readonly SeedProduct[] | null = null;
let scenarios: readonly SeedScenario[] | null = null;

export const loadCustomers = (): readonly SeedCustomer[] =>
  (customers ??= read<SeedCustomer>("customers.json"));

/** The four supplied by the brief, verbatim. */
export const loadOrders = (): readonly SeedOrder[] =>
  (orders ??= read<SeedOrder>("orders.json"));

/**
 * Orders written for this project, kept in their own file so the supplied one
 * stays byte-identical. They exist to cover the order states the brief's four
 * do not: packaged, cancelled, and a delivery old enough to be outside the
 * refund window.
 */
export const loadAuthoredOrders = (): readonly SeedOrder[] =>
  (authoredOrders ??= read<SeedOrder>("orders-local.json"));

export const loadProducts = (): readonly SeedProduct[] =>
  (products ??= read<SeedProduct>("items.json"));

export const loadScenarios = (): readonly SeedScenario[] =>
  (scenarios ??= read<SeedScenario>("scenarios.json"));
