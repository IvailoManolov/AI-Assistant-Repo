/**
 * The console's view of an order.
 *
 * Mirrors what `/api/orders` sends rather than importing the guard's `Order`,
 * because the two are allowed to differ: the operator sees a resolved refund
 * window and a refund count, which are not properties of an order record.
 */
import type { OrderLine, OrderStatus } from "@/guard/records";

export type { OrderStatus };

export type OperatorOrder = {
  orderId: string;
  customerId: string;
  status: OrderStatus | "unknown";
  currency: string;
  totalMinor: number;
  lines: OrderLine[];
  shipping: { carrier: string; trackingNumber: string } | null;
  origin: "seed" | "authored" | "runtime";
  placedAt: string;
  paidAt: string | null;
  deliveredAt: string | null;
  cancelledAt: string | null;
  daysSinceArrival: number | null;
  /** Days left to raise a refund. Negative once the window has gone. */
  windowDaysLeft: number | null;
  refundCount: number;
};

/**
 * What each state means to the person reading the row, in their words rather
 * than the record's. These are the tooltips.
 */
export const STATUS_STANDING: Record<OperatorOrder["status"], string> = {
  cancelled: "Cancelled. Nothing shipped, and nothing to refund.",
  packaged: "Packed and waiting for a carrier. It has not left yet.",
  in_transit: "With the carrier. Not arrived, so not refundable yet.",
  delivered: "Arrived. Refundable while the window lasts.",
  returned: "Sent back. Refundable once the return has been received.",
  unknown: "The seed gives this order a status this system does not model.",
};

export const STATUS_LABEL: Record<OperatorOrder["status"], string> = {
  cancelled: "Cancelled",
  packaged: "Packaged",
  in_transit: "In transit",
  delivered: "Delivered",
  returned: "Returned",
  unknown: "Unknown",
};

/**
 * The customer's view of their own order.
 *
 * Narrower than the operator's on purpose: no account id, because they are the
 * account, and no refund count, because a held refund is between the operator
 * and the decision, not a fact about the order.
 */
export type CustomerOrder = {
  orderId: string;
  status: OrderStatus | "unknown";
  currency: string;
  totalMinor: number;
  lines: OrderLine[];
  shipping: { carrier: string; trackingNumber: string } | null;
  placedAt: string;
  paidAt: string | null;
  deliveredAt: string | null;
  daysSinceArrival: number | null;
  windowDaysLeft: number | null;
};
