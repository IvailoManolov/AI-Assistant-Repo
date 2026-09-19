/**
 * What may be said back.
 *
 * Disclosure shaping lives in the guard rather than in the composer prompt,
 * because a rule that depends on the model obeying it is not a rule. By the
 * time text is being written, the facts have already been narrowed to the
 * ones this principal was allowed to learn.
 */
import { formatMinor } from "../core/money.ts";
import type { Order } from "./records.ts";
import { daysSince } from "./timeline.ts";

/**
 * The customer-facing projection of an order. `customerId` is dropped: the
 * customer already knows who they are, and echoing an owner id back is how a
 * system starts confirming ownership of records it has refused to show.
 */
export type DisclosedOrder = {
  order_id: string;
  status: string;
  currency: string;
  total: string;
  /** Where the order is in time. The customer may know all of this. */
  placed_at: string;
  paid: boolean;
  delivered_at: string | null;
  days_since_arrival: number | null;
  items: {
    item_id: string;
    name: string;
    quantity: number;
    unit_price: string;
    unit_price_minor: number;
    return_status?: string;
  }[];
  shipping?: { carrier: string; tracking_number: string };
};

export function discloseOrder(order: Order): DisclosedOrder {
  return {
    order_id: order.orderId,
    status: order.status,
    currency: order.currency,
    total: formatMinor(order.totalMinor, order.currency),
    placed_at: order.placedAt,
    paid: order.paidAt !== null,
    delivered_at: order.deliveredAt,
    days_since_arrival: daysSince(order.deliveredAt),
    items: order.lines.map((l) => ({
      item_id: l.itemId,
      name: l.name,
      quantity: l.quantity,
      unit_price: formatMinor(l.unitPriceMinor, order.currency),
      /**
       * The minor figure travels alongside the formatted one so the refund
       * agent can do arithmetic on an integer rather than parsing its own
       * currency string back into a number.
       */
      unit_price_minor: l.unitPriceMinor,
      ...(l.returnStatus === undefined ? {} : { return_status: l.returnStatus }),
    })),
    ...(order.shipping === undefined
      ? {}
      : {
          shipping: {
            carrier: order.shipping.carrier,
            tracking_number: order.shipping.trackingNumber,
          },
        }),
  };
}

/**
 * The single answer to both "no such order" and "not yours". Anything that
 * distinguishes them at this boundary is a leak.
 */
export const notFoundResult = (orderId: string) => ({
  error: "not_found" as const,
  order_id: orderId,
  message: "No order with that reference is available on this account.",
});
