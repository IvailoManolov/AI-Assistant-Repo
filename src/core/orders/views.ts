/**
 * The two projections of an order list, one per principal.
 *
 * In core rather than in the route handler for the same reason `placeOrder` is:
 * what each role may see is domain policy, and it needs somewhere to be tested
 * from. The route reads the request, calls one of these, and returns it.
 *
 * Both resolve the refund window with the kernel's own function, so a screen
 * never works out for itself whether something is still refundable. Two
 * implementations of one rule eventually disagree, and the one on screen is
 * the one the customer would quote back.
 */
import { customerContext, operatorContext } from "../../guard/auth-context.ts";
import type { OrderLine, OrderStatus } from "../../guard/records.ts";
import { listOrders, listRefunds } from "../../guard/scoped-store.ts";
import { daysSince } from "../../guard/timeline.ts";
import { refundWindowRemaining } from "../kernel/rules.ts";
import { REFUND_WINDOW_DAYS } from "../refunds/schema.ts";

type Shipping = { carrier: string; trackingNumber: string } | null;

/** What both roles see. Nothing in here identifies an account. */
type OrderFacts = {
  orderId: string;
  /** "unknown" is possible: the seed may carry a state this system does not model. */
  status: OrderStatus | "unknown";
  currency: string;
  totalMinor: number;
  lines: OrderLine[];
  shipping: Shipping;
  placedAt: string;
  paidAt: string | null;
  deliveredAt: string | null;
  daysSinceArrival: number | null;
  windowDaysLeft: number | null;
};

export type CustomerOrderView = OrderFacts;

export type OperatorOrderView = OrderFacts & {
  customerId: string;
  cancelledAt: string | null;
  origin: "seed" | "authored" | "runtime";
  refundCount: number;
};

export const ORDER_WINDOW_DAYS = REFUND_WINDOW_DAYS;

const newestFirst = <T extends { placedAt: string }>(rows: T[]): T[] =>
  rows.sort((a, b) => Date.parse(b.placedAt) - Date.parse(a.placedAt));

/**
 * A customer's own orders.
 *
 * Scoped by `customerContext`, which is the same context the assistant reads
 * through on their behalf. That equivalence is the point: if a row appears in
 * the shop's Orders tab then Robby can be asked about it, and if it does not,
 * he will say he cannot find it.
 */
export function customerOrders(customerId: string): CustomerOrderView[] {
  return newestFirst(
    listOrders(customerContext(customerId)).map((order) => ({
      orderId: order.orderId,
      status: order.status,
      currency: order.currency,
      totalMinor: order.totalMinor,
      lines: order.lines,
      shipping: order.shipping ?? null,
      placedAt: order.placedAt,
      paidAt: order.paidAt,
      deliveredAt: order.deliveredAt,
      daysSinceArrival: daysSince(order.deliveredAt),
      windowDaysLeft: refundWindowRemaining(order),
    })),
  );
}

/** Every order, across accounts, with what has already been raised on each. */
export function operatorOrders(operatorId: string): OperatorOrderView[] {
  const ctx = operatorContext(operatorId);
  const refunds = listRefunds(ctx);

  return newestFirst(
    listOrders(ctx).map((order) => ({
      orderId: order.orderId,
      customerId: order.customerId,
      status: order.status,
      currency: order.currency,
      totalMinor: order.totalMinor,
      lines: order.lines,
      shipping: order.shipping ?? null,
      origin: order.origin,
      placedAt: order.placedAt,
      paidAt: order.paidAt,
      deliveredAt: order.deliveredAt,
      cancelledAt: order.cancelledAt,
      daysSinceArrival: daysSince(order.deliveredAt),
      windowDaysLeft: refundWindowRemaining(order),
      refundCount: refunds.filter((r) => r.orderId === order.orderId).length,
    })),
  );
}
