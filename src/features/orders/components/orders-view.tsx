"use client";

import { Fragment, useEffect, useState } from "react";

import { eur } from "@/shared";

import { RefundWindow } from "./refund-window";
import { StatusPill } from "./status-pill";
import type { OperatorOrder } from "../model/types";

const day = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        timeZone: "UTC",
      })
    : "-";

const POLL_MS = 5000;

const ORIGIN_NOTE: Record<OperatorOrder["origin"], string> = {
  seed: "Supplied with the exercise",
  authored: "Written for this project",
  runtime: "Created while the app was running",
};

function Lines({ order }: { order: OperatorOrder }) {
  return (
    <tr className="bg-sunk/60">
      <td colSpan={7} className="px-4 py-3 sm:px-5">
        <div className="pane-in flex flex-wrap gap-x-12 gap-y-4">
          <ul className="min-w-0 space-y-1.5">
            {order.lines.map((line) => (
              <li
                key={line.itemId}
                className="flex flex-wrap items-baseline gap-x-3 text-[12.5px]"
              >
                <span className="font-mono text-[11.5px] text-muted">{line.itemId}</span>
                <span className="text-ink">
                  {line.quantity} x {line.name}
                </span>
                <span className="text-muted tabular-nums">
                  {eur(line.unitPriceMinor / 100)} each
                </span>
                {line.returnStatus && (
                  <span className="text-coral">return {line.returnStatus}</span>
                )}
              </li>
            ))}
          </ul>

          <dl className="grid shrink-0 grid-cols-[auto_1fr] gap-x-4 gap-y-1 self-start text-[11.5px]">
            <dt className="text-muted">Placed</dt>
            <dd className="tabular-nums">{day(order.placedAt)}</dd>
            <dt className="text-muted">Paid</dt>
            <dd className={order.paidAt ? "tabular-nums" : "text-danger"}>
              {order.paidAt ? day(order.paidAt) : "never"}
            </dd>
            <dt className="text-muted">Arrived</dt>
            <dd className="tabular-nums">{day(order.deliveredAt)}</dd>
            {order.shipping && (
              <>
                <dt className="text-muted">Carrier</dt>
                <dd className="font-mono text-[11px]">
                  {order.shipping.carrier} {order.shipping.trackingNumber}
                </dd>
              </>
            )}
            <dt className="text-muted">Source</dt>
            <dd>{ORIGIN_NOTE[order.origin]}</dd>
          </dl>
        </div>
      </td>
    </tr>
  );
}

/**
 * Every order, and whether anything can still be done about it.
 *
 * Deliberately not the session view with different data in it. There is no
 * decision tree and no log here, because an order is not a conversation: the
 * questions it answers are what state it is in, whether it was paid for, and
 * how much of its refund window is left. Rows open to show their line items,
 * which is the one thing that needs more room than a cell.
 */
export function OrdersView({ operatorId }: { operatorId: string }) {
  const [orders, setOrders] = useState<OperatorOrder[] | null>(null);
  const [windowDays, setWindowDays] = useState(7);
  const [open, setOpen] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;

    async function load() {
      try {
        const response = await fetch(`/api/orders?operatorId=${encodeURIComponent(operatorId)}`, {
          cache: "no-store",
        });
        if (!response.ok) throw new Error(`orders returned ${response.status}`);
        const body = (await response.json()) as { orders: OperatorOrder[]; windowDays: number };
        if (!live) return;
        setOrders(body.orders);
        setWindowDays(body.windowDays);
        setFailed(false);
      } catch {
        if (live) setFailed(true);
      }
    }

    void load();
    const timer = setInterval(() => void load(), POLL_MS);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [operatorId]);

  const refundable = orders?.filter((o) => (o.windowDaysLeft ?? -1) > 0).length ?? 0;

  return (
    <div className="flex min-h-0 grow flex-col overflow-hidden px-4 pb-4 sm:px-6">
      <div className="flex shrink-0 flex-wrap items-baseline gap-x-3 gap-y-1 py-3">
        <h2 className="text-[13px] font-semibold">Orders</h2>
        <p className="text-[11.5px] text-muted">
          {orders
            ? `${orders.length} in all, ${refundable} still inside the ${windowDays} day refund window`
            : "Loading"}
        </p>
      </div>

      {failed && (
        <p role="status" className="pb-3 text-[12px] text-danger">
          The order list did not load. It will try again in a moment.
        </p>
      )}

      <div className="thin-scroll bg-sunk pane-in min-h-0 grow overflow-auto rounded-md ring-1 ring-sunk-line">
        <table className="w-full min-w-[46rem] border-collapse text-left">
          <thead className="bg-cream-deep sticky top-0 z-10">
            <tr className="text-[11px] text-muted">
              <th scope="col" className="px-4 py-2 font-medium sm:px-5">
                Reference
              </th>
              <th scope="col" className="px-4 py-2 font-medium">
                Account
              </th>
              <th scope="col" className="px-4 py-2 font-medium">
                Status
              </th>
              <th scope="col" className="px-4 py-2 font-medium">
                Placed
              </th>
              <th scope="col" className="px-4 py-2 font-medium">
                Refund window
              </th>
              <th scope="col" className="px-4 py-2 text-right font-medium">
                Total
              </th>
              <th scope="col" className="px-4 py-2 text-right font-medium sm:px-5">
                Refunds
              </th>
            </tr>
          </thead>

          <tbody>
            {orders?.map((order) => {
              const expanded = open === order.orderId;
              return (
                <Fragment key={order.orderId}>
                  <tr
                    className={`border-t border-sunk-line/70 transition-colors ${
                      expanded ? "bg-paper" : "hover:bg-paper/70"
                    }`}
                  >
                    <th scope="row" className="px-4 py-2.5 font-normal sm:px-5">
                      <button
                        type="button"
                        onClick={() => setOpen(expanded ? null : order.orderId)}
                        aria-expanded={expanded}
                        className="flex items-center gap-2 font-mono text-[12.5px] transition-colors hover:text-coral"
                      >
                        <span
                          className={`text-[10px] text-muted transition-transform duration-200 ${
                            expanded ? "rotate-90" : ""
                          }`}
                          aria-hidden
                        >
                          &gt;
                        </span>
                        {order.orderId}
                      </button>
                    </th>
                    <td className="px-4 py-2.5 font-mono text-[11.5px] text-muted">
                      {order.customerId}
                    </td>
                    <td className="px-4 py-2.5">
                      <StatusPill status={order.status} />
                    </td>
                    <td className="px-4 py-2.5 text-[12px] text-muted tabular-nums">
                      {day(order.placedAt)}
                    </td>
                    <td className="px-4 py-2.5">
                      <RefundWindow
                        daysLeft={order.windowDaysLeft}
                        daysSinceArrival={order.daysSinceArrival}
                        windowDays={windowDays}
                        status={order.status}
                      />
                    </td>
                    <td className="px-4 py-2.5 text-right text-[12.5px] tabular-nums">
                      {eur(order.totalMinor / 100)}
                    </td>
                    <td className="px-4 py-2.5 text-right text-[12.5px] tabular-nums sm:px-5">
                      {order.refundCount || <span className="text-muted">-</span>}
                    </td>
                  </tr>
                  {expanded && <Lines order={order} />}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
