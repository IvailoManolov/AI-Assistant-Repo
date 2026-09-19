"use client";

import { NotificationBadge, eur } from "@/shared";

import type { OperatorRefund } from "../model/types";

/**
 * The strip that says a person is needed.
 *
 * It sits above the transcript rather than beside it, because the thing it
 * interrupts is reading the conversation, and the decision it leads to should
 * be made having read it. The breathing mark is the same one the session rail
 * uses for the same meaning: something is drafted and waiting on you.
 */
export function RefundBanner({
  refund,
  onOpen,
}: {
  refund: OperatorRefund;
  onOpen: () => void;
}) {
  const held = refund.state === "held";

  return (
    <div
      className={`pane-in flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b px-4 py-2.5 sm:px-5 ${
        held ? "bg-amber-soft border-amber/25" : "bg-green-soft border-green/25"
      }`}
    >
      {held && <NotificationBadge tone="attention" label="A refund is waiting on you." />}

      <p className={`text-[12.5px] leading-snug ${held ? "text-amber" : "text-green"}`}>
        {held ? (
          <>
            <span className="font-semibold">{eur(refund.amountMinor / 100)}</span> held for{" "}
            {refund.quantity} x {refund.itemName} on{" "}
            <span className="font-mono">{refund.orderId}</span>.
          </>
        ) : (
          <>
            {eur(refund.amountMinor / 100)} {refund.state}
            {refund.decidedBy ? ` by ${refund.decidedBy}` : ""}.
          </>
        )}
      </p>

      <button
        type="button"
        onClick={onOpen}
        className={`ml-auto rounded-full px-3 py-1.5 text-[12.5px] font-semibold transition-opacity hover:opacity-90 ${
          held ? "bg-amber text-cream" : "bg-cream-deep text-ink"
        }`}
      >
        {held ? "Review refund" : "View decision"}
      </button>
    </div>
  );
}
