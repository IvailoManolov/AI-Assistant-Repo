/**
 * The only way into customer data.
 *
 * Two invariants hold here and nowhere else:
 *
 *   1. No unscoped read exists. There is no `getOrder(id)` to reach for by
 *      mistake, only `getOrder(ctx, id)`. An unscoped query cannot be written
 *      because there is no API to write it through.
 *   2. Identity is never model supplied. Every function here takes an
 *      AuthContext, and an AuthContext is minted by an adapter from the
 *      request envelope, which the model cannot reach.
 *
 * Ownership failure and nonexistence return the same value. That is not
 * politeness, it is requirement I3: answering "you may not see ORD-204"
 * confirms ORD-204 exists.
 */
import {
  deleteRecord,
  getRecord,
  listRecords,
  putRecord,
  type RuntimeRecord,
} from "../mock-env/runtime.ts";
import { readMutable, writeMutable } from "../mock-env/mutable.ts";
import { loadAuthoredOrders, loadCustomers, loadOrders } from "../mock-env/seed.ts";
import type { RefundRecord } from "../core/refunds/types.ts";
import { fromSeedOrder, type Customer, type Order } from "./records.ts";
import type { Access, AuthContext } from "./types.ts";

const ORDERS = "orders";
const REFUNDS = "refunds";
const ORDERS_FILE = "orders.json";

const notFound = <T>(): Access<T> => ({ ok: false, code: "not_found" });
const found = <T>(value: T): Access<T> => ({ ok: true, value });

/**
 * An operator sees records so it can decide a refund it has been handed. A
 * customer sees exactly its own. There is no third answer.
 */
function visibleTo(ctx: AuthContext, ownerId: string): boolean {
  return ctx.principal.kind === "operator" || ctx.principal.customerId === ownerId;
}

const runtimeOrders = (): Order[] => listRecords(ORDERS) as unknown as Order[];

/**
 * Orders created while the app is running are written through to the mutable
 * half of the seed, the same way sessions are. Something bought in the shop
 * has to survive a restart, or the assistant is asked about an order that the
 * customer can see in their own history and the system cannot.
 *
 * Loaded eagerly, at module load, and exactly once.
 *
 * Eagerly on purpose: the in-memory collection is the home and the file is a
 * write-through copy of it, so `clearRuntime()` has to be able to empty both
 * in one go. If this loaded lazily on first read, a test that cleared the
 * runtime in its setup would find the file reloaded underneath it by the first
 * lookup, and the suite would quietly depend on whatever somebody last bought.
 */
function loadPurchasedOrders() {
  for (const order of readMutable<Order>(ORDERS_FILE)) {
    putRecord(ORDERS, order.orderId, order as unknown as RuntimeRecord);
  }
}

loadPurchasedOrders();

const persistOrders = () => writeMutable(ORDERS_FILE, runtimeOrders());

/**
 * The next reference to hand out.
 *
 * Numeric, and deliberately so: the chat recognises an order by the digits in
 * it, so a reference the customer cannot type is a reference the assistant can
 * never be asked about. Starts at 500, clear of everything in the seed.
 */
export function nextOrderId(): string {
  const highest = everyOrder()
    .map((order) => Number(order.orderId.replace(/\D/g, "")))
    .filter((n) => Number.isFinite(n))
    .reduce((max, n) => Math.max(max, n), 499);
  return `ORD-${highest + 1}`;
}

/**
 * The orders this system can see: the seed, with the runtime laid over it.
 *
 * An overlay rather than a concatenation, and the direction matters. The seed
 * files are immutable, so without an overlay no supplied order could ever
 * change state and the approval-time re-check would have nothing to catch. A
 * runtime record under the same id shadows the seed one; the file on disk is
 * still untouched, and clearing the runtime restores the supplied state
 * exactly.
 */
function everyOrder(): Order[] {
  const byId = new Map<string, Order>();
  for (const order of loadOrders()) byId.set(order.order_id, fromSeedOrder(order, "seed"));
  for (const order of loadAuthoredOrders()) byId.set(order.order_id, fromSeedOrder(order, "authored"));
  for (const order of runtimeOrders()) byId.set(order.orderId, order);
  return [...byId.values()];
}

export function getOrder(ctx: AuthContext, orderId: string): Access<Order> {
  const order = everyOrder().find((o) => o.orderId === orderId);
  if (!order) return notFound();
  if (!visibleTo(ctx, order.customerId)) return notFound();
  return found(order);
}

/** Every order this principal may see. For an operator, all of them. */
export function listOrders(ctx: AuthContext): Order[] {
  return everyOrder().filter((o) => visibleTo(ctx, o.customerId));
}

export function getCustomer(ctx: AuthContext, customerId: string): Access<Customer> {
  if (!visibleTo(ctx, customerId)) return notFound();
  const seed = loadCustomers().find((c) => c.customer_id === customerId);
  if (!seed) return notFound();
  return found({ customerId: seed.customer_id, name: seed.name, email: seed.email });
}

/**
 * A shop purchase becomes a real order for the buyer, so that something
 * bought in this environment is immediately eligible for the support path.
 * The context is the buyer's own: an order cannot be created against someone
 * else's name.
 */
export function createRuntimeOrder(ctx: AuthContext, order: Omit<Order, "origin">): Access<Order> {
  if (!visibleTo(ctx, order.customerId)) return notFound();
  /** Creating is not overwriting. Shadowing a supplied order is not a purchase. */
  if (everyOrder().some((o) => o.orderId === order.orderId)) return notFound();
  const stored: Order = { ...order, origin: "runtime" };
  putRecord(ORDERS, stored.orderId, stored as unknown as RuntimeRecord);
  persistOrders();
  return found(stored);
}

/**
 * Drops every order created while the app was running, in memory and on disk
 * together, for the same reason the session reset does both: clearing the file
 * alone leaves the process holding them, and the next write puts them back.
 *
 * The supplied and authored orders are source data and are untouched.
 */
export function resetPurchasedOrders(): { removed: number } {
  const purchased = runtimeOrders();
  for (const order of purchased) deleteRecord(ORDERS, order.orderId);
  persistOrders();
  return { removed: purchased.length };
}

const everyRefund = (): RefundRecord[] => listRecords(REFUNDS) as unknown as RefundRecord[];

/**
 * Drops every refund raised while the app was running.
 *
 * Part of a reset, and it was missing: sessions and purchased orders were
 * cleared and the refunds they had raised were not, so the environment came
 * back with a held refund attached to a session that no longer existed. The
 * next time the same demo was run, R5 correctly refused it as already open,
 * against nothing anyone could see.
 *
 * In memory only, because that is where refunds live. Nothing is persisted.
 */
export function resetRefunds(): { removed: number } {
  const raised = everyRefund();
  for (const refund of raised) deleteRecord(REFUNDS, refund.id);
  return { removed: raised.length };
}

export function insertRefund(ctx: AuthContext, record: RefundRecord): Access<RefundRecord> {
  if (!visibleTo(ctx, record.customerId)) return notFound();
  if (getRecord(REFUNDS, record.id)) return notFound();
  putRecord(REFUNDS, record.id, record as unknown as RuntimeRecord);
  return found(record);
}

/** Replaces a record wholesale. State transitions are decided in core/refunds. */
export function replaceRefund(ctx: AuthContext, record: RefundRecord): Access<RefundRecord> {
  if (!visibleTo(ctx, record.customerId)) return notFound();
  if (!getRecord(REFUNDS, record.id)) return notFound();
  putRecord(REFUNDS, record.id, record as unknown as RuntimeRecord);
  return found(record);
}

export function getRefund(ctx: AuthContext, refundId: string): Access<RefundRecord> {
  const record = everyRefund().find((r) => r.id === refundId);
  if (!record) return notFound();
  if (!visibleTo(ctx, record.customerId)) return notFound();
  return found(record);
}

export function listRefunds(ctx: AuthContext): RefundRecord[] {
  return everyRefund().filter((r) => visibleTo(ctx, r.customerId));
}

export function listRefundsForOrder(ctx: AuthContext, orderId: string): RefundRecord[] {
  return listRefunds(ctx).filter((r) => r.orderId === orderId);
}

/**
 * Why a read came back not_found. For the log and the decision trace only.
 *
 * The customer-facing answer is identical either way, which is requirement
 * I3, and the operator still needs to know which of the two happened. Keeping
 * that distinction inside the guard means exactly one function can tell them
 * apart, it returns a code rather than a record, and it can be read in one
 * place to check nothing routes it outward.
 */
export function explainNotFound(
  ctx: AuthContext,
  orderId: string,
): "absent" | "ownership_denied" {
  const order = everyOrder().find((o) => o.orderId === orderId);
  if (!order) return "absent";
  return visibleTo(ctx, order.customerId) ? "absent" : "ownership_denied";
}
