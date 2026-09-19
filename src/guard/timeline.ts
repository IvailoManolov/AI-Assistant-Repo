/**
 * When each order happened.
 *
 * The supplied orders carry no dates at all, and the file cannot be edited, so
 * the four of them get their timeline from the table below. Orders written for
 * this project carry their own offsets in their JSON instead. Two mechanisms
 * for one thing is not a design choice, it is what immutability forces: the
 * alternative is either editing the brief's data or having no timeline, and
 * the refund window is a rule that cannot exist without one.
 *
 * Everything is expressed as days before now and resolved against the injected
 * clock, so a fixed clock gives a fixed timeline and a reviewer picking this up
 * in a month still finds ORD-200 inside its refund window rather than an
 * environment that quietly expired.
 */
import type { SeedOrder } from "../mock-env/seed.ts";
import { now } from "../core/runtime/clock.ts";

export type OrderTimeline = {
  placedAt: string;
  /** Null means the money never moved, which no refund can undo. */
  paidAt: string | null;
  /** Null until it arrives. The refund window is measured from this. */
  deliveredAt: string | null;
  cancelledAt: string | null;
};

type Offsets = {
  placed: number;
  paid: number | null;
  delivered: number | null;
  cancelled: number | null;
};

/**
 * The supplied four. Chosen so the brief's own examples still work: ORD-200
 * and ORD-300 are both inside the window, because the second and fourth
 * example requests are refunds against them.
 */
const SUPPLIED: Record<string, Offsets> = {
  "ORD-100": { placed: 2, paid: 2, delivered: null, cancelled: null },
  "ORD-200": { placed: 6, paid: 6, delivered: 2, cancelled: null },
  "ORD-204": { placed: 5, paid: 5, delivered: 1, cancelled: null },
  "ORD-300": { placed: 12, paid: 12, delivered: 5, cancelled: null },
};

const DAY_MS = 24 * 60 * 60 * 1000;

const daysAgo = (days: number): string => new Date(now().getTime() - days * DAY_MS).toISOString();

/** A last resort for an order nobody gave a timeline: placed today, unpaid. */
const UNKNOWN: Offsets = { placed: 0, paid: null, delivered: null, cancelled: null };

function offsetsFor(order: SeedOrder): Offsets {
  if (order.placed_days_ago !== undefined) {
    return {
      placed: order.placed_days_ago,
      paid: order.paid ? order.placed_days_ago : null,
      delivered: order.delivered_days_ago ?? null,
      cancelled: order.cancelled_days_ago ?? null,
    };
  }
  return SUPPLIED[order.order_id] ?? UNKNOWN;
}

export function timelineFor(order: SeedOrder): OrderTimeline {
  const offsets = offsetsFor(order);
  return {
    placedAt: daysAgo(offsets.placed),
    paidAt: offsets.paid === null ? null : daysAgo(offsets.paid),
    deliveredAt: offsets.delivered === null ? null : daysAgo(offsets.delivered),
    cancelledAt: offsets.cancelled === null ? null : daysAgo(offsets.cancelled),
  };
}

/** Whole days since an instant, or null if it never happened. */
export function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  return Math.floor((now().getTime() - Date.parse(iso)) / DAY_MS);
}
