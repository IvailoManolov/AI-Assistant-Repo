/**
 * The order as the solution sees it.
 *
 * The supplied seed writes majors as floating point and uses snake_case. This
 * module is the one place that shape is translated, so nothing above it ever
 * multiplies a float by a quantity or has to remember which convention it is
 * looking at.
 *
 * `origin` is kept because a runtime order created by a shop purchase and a
 * supplied seed order are the same kind of thing to every rule, and a
 * different kind of thing to a reviewer reading the trace.
 */
import type { SeedOrder, SeedOrderItem } from "../mock-env/seed.ts";
import { toMinor } from "../core/money.ts";
import { timelineFor, type OrderTimeline } from "./timeline.ts";

/**
 * The lifecycle an order moves through.
 *
 *   packaged -> in_transit -> delivered -> returned
 *        \_________ cancelled _________/
 *
 * `returned` is in the supplied data and is not in the brief's own list of
 * states, so it stays: the fourth example request is a refund against an order
 * in exactly that state. `cancelled` and `packaged` were added for this
 * project, because an order that was never paid for and an order that has not
 * left the building are different refusals and were previously the same one.
 */
export const ORDER_STATUSES = [
  "cancelled",
  "packaged",
  "in_transit",
  "delivered",
  "returned",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const isOrderStatus = (value: string): value is OrderStatus =>
  (ORDER_STATUSES as readonly string[]).includes(value);

/** Anything the seed calls something else is treated as unknown, never as ok. */
export const asOrderStatus = (value: string): OrderStatus | "unknown" =>
  isOrderStatus(value) ? value : "unknown";

export type OrderLine = {
  itemId: string;
  name: string;
  quantity: number;
  unitPriceMinor: number;
  /** Present on some supplied lines. `received` is what makes R3 pass. */
  returnStatus?: string;
};

export type Order = {
  orderId: string;
  customerId: string;
  status: OrderStatus | "unknown";
  currency: string;
  totalMinor: number;
  lines: OrderLine[];
  shipping?: { carrier: string; trackingNumber: string };
  origin: "seed" | "authored" | "runtime";
} & OrderTimeline;

export type Customer = {
  customerId: string;
  name: string;
  email: string;
};

const line = (item: SeedOrderItem): OrderLine => ({
  itemId: item.item_id,
  name: item.name,
  quantity: item.quantity,
  unitPriceMinor: toMinor(item.unit_price),
  ...(item.return_status === undefined ? {} : { returnStatus: item.return_status }),
});

export const fromSeedOrder = (order: SeedOrder, origin: "seed" | "authored" = "seed"): Order => ({
  orderId: order.order_id,
  customerId: order.customer_id,
  status: asOrderStatus(order.status),
  currency: order.currency,
  totalMinor: toMinor(order.total),
  lines: order.items.map(line),
  ...(order.shipping === undefined
    ? {}
    : {
        shipping: {
          carrier: order.shipping.carrier,
          trackingNumber: order.shipping.tracking_number,
        },
      }),
  ...timelineFor(order),
  origin,
});

/** Finds a line by item id. Orders here are small enough that this is honest. */
export const findLine = (order: Order, itemId: string): OrderLine | undefined =>
  order.lines.find((l) => l.itemId === itemId);

/** The instant the refund window is measured from, or null if it has not arrived. */
export const arrivedAt = (order: Order): string | null => order.deliveredAt;
