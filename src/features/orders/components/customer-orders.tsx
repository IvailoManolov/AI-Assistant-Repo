"use client";

import { useEffect, useState } from "react";
import { ChevronRight, MessageSquare } from "lucide-react";

import { askRobby } from "@/features/assistant";
import { eur } from "@/shared";

import { StatusPill } from "./status-pill";
import type { CustomerOrder } from "../model/types";

const day = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      })
    : null;

/** What the refund window means to the person who owns the order. */
function windowNote(order: CustomerOrder, windowDays: number): string {
  if (order.status === "cancelled") return "Cancelled, so there is nothing to refund.";
  if (order.deliveredAt === null) return "Not arrived yet, so the refund window has not started.";
  const left = order.windowDaysLeft;
  if (left === null) return `Refundable for ${windowDays} days after it arrives.`;
  if (left < 0) return "The refund window has closed on this one.";
  if (left === 0) return "Today is the last day to ask for a refund.";
  return `${left} day${left === 1 ? "" : "s"} left to ask for a refund.`;
}

/**
 * Anna's own orders, in the shop rather than in the console.
 *
 * The same records the assistant reads, fetched through the same guard with
 * the same customer context, which is the point: if a row is here, Robby can
 * be asked about it, and if it is not, he will say he cannot find it. Rows
 * open rather than link, because an order has one more level of detail and
 * not a page's worth.
 */
export function CustomerOrders({ customerId }: { customerId: string }) {
  const [orders, setOrders] = useState<CustomerOrder[] | null>(null);
  const [windowDays, setWindowDays] = useState(7);
  const [open, setOpen] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;

    async function load() {
      try {
        const response = await fetch(`/api/orders?customerId=${encodeURIComponent(customerId)}`, {
          cache: "no-store",
        });
        if (!response.ok) throw new Error(`orders returned ${response.status}`);
        const body = (await response.json()) as { orders: CustomerOrder[]; windowDays: number };
        if (!live) return;
        setOrders(body.orders);
        setWindowDays(body.windowDays);
        setFailed(false);
      } catch {
        if (live) setFailed(true);
      }
    }

    void load();
    return () => {
      live = false;
    };
  }, [customerId]);

  if (failed) {
    return (
      <p role="status" className="text-[14px] text-danger">
        Your orders did not load. Reload the page and they will come back.
      </p>
    );
  }

  if (orders === null) {
    return <p className="text-[14px] text-muted">Looking up your orders…</p>;
  }

  if (orders.length === 0) {
    return (
      <div className="bg-paper rounded-2xl px-6 py-10 text-center ring-1 ring-line">
        <p className="font-display text-lg font-bold">No orders yet</p>
        <p className="mx-auto mt-1.5 max-w-[38ch] text-[14px] leading-relaxed text-muted">
          Buy something from the catalog and it appears here straight away, with a reference you
          can ask Robby about.
        </p>
      </div>
    );
  }

  return (
    <ul className="grid gap-2.5">
      {orders.map((order) => {
        const expanded = open === order.orderId;
        const arrived = day(order.deliveredAt);

        return (
          <li
            key={order.orderId}
            className={`bg-paper overflow-hidden rounded-2xl transition-shadow ${
              expanded ? "shadow-lift ring-1 ring-coral/40" : "shadow-soft ring-1 ring-line"
            }`}
          >
            <button
              type="button"
              onClick={() => setOpen(expanded ? null : order.orderId)}
              aria-expanded={expanded}
              className="flex w-full items-center gap-3 px-4 py-3.5 text-left sm:px-5"
            >
              <ChevronRight
                aria-hidden
                className={`size-4 shrink-0 text-muted transition-transform duration-200 motion-reduce:transition-none ${
                  expanded ? "rotate-90" : ""
                }`}
                strokeWidth={2.4}
              />

              <span className="min-w-0 grow">
                <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="font-mono text-[13px] font-medium">{order.orderId}</span>
                  <StatusPill status={order.status} />
                </span>
                <span className="mt-1 block text-[12.5px] text-muted">
                  Placed {day(order.placedAt)}
                  {arrived ? `, arrived ${arrived}` : ""}
                </span>
              </span>

              <span className="shrink-0 text-right">
                <span className="font-display block text-[17px] font-bold tabular-nums">
                  {eur(order.totalMinor / 100)}
                </span>
                <span className="text-[12px] text-muted">
                  {order.lines.reduce((n, l) => n + l.quantity, 0)} item
                  {order.lines.reduce((n, l) => n + l.quantity, 0) === 1 ? "" : "s"}
                </span>
              </span>
            </button>

            {expanded && (
              <div className="pane-in border-t border-line px-4 pt-3.5 pb-4 sm:px-5">
                <ul className="grid gap-2">
                  {order.lines.map((line) => (
                    <li
                      key={line.itemId}
                      className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 text-[13.5px]"
                    >
                      <span>
                        {line.quantity} x {line.name}
                        <span className="ml-2 font-mono text-[11.5px] text-muted">
                          {line.itemId}
                        </span>
                      </span>
                      <span className="tabular-nums text-ink-soft">
                        {eur((line.unitPriceMinor * line.quantity) / 100)}
                        {line.quantity > 1 && (
                          <span className="ml-1.5 text-[12px] text-muted">
                            ({eur(line.unitPriceMinor / 100)} each)
                          </span>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>

                <div className="mt-3.5 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3.5">
                  <p className="text-[12.5px] text-muted">{windowNote(order, windowDays)}</p>
                  <button
                    type="button"
                    onClick={() => askRobby(`What is the status of ${order.orderId}?`)}
                    className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px] font-medium text-ink-soft ring-1 ring-line transition-colors hover:bg-cream-deep hover:text-coral-deep"
                  >
                    <MessageSquare className="size-3.5" strokeWidth={2.2} />
                    Ask Robby about it
                  </button>
                </div>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
