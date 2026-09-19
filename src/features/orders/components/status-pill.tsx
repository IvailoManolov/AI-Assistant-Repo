"use client";

import { Tooltip } from "@/shared";

import { STATUS_LABEL, STATUS_STANDING, type OperatorOrder } from "../model/types";

/**
 * Where an order is in its lifecycle.
 *
 * A mark and a word, using the same colour vocabulary the session rail already
 * teaches, so an operator who has learned the rail does not learn this twice.
 *
 * Cancelled is grey rather than red. Red is for something that needs
 * attention, and a cancelled order needs none: it is over. Spending the alarm
 * colour on it leaves nothing to say "look at this", and beside a returned
 * order the two reds were genuinely hard to tell apart.
 */
const DOT: Record<OperatorOrder["status"], string> = {
  cancelled: "bg-muted",
  packaged: "bg-cobalt-signal",
  in_transit: "bg-amber-signal",
  delivered: "bg-green-signal",
  returned: "bg-coral",
  unknown: "ring-1 ring-sunk-line",
};

export function StatusPill({ status }: { status: OperatorOrder["status"] }) {
  return (
    <Tooltip label={STATUS_STANDING[status]}>
      <span className="inline-flex items-center gap-1.5 text-[12px] whitespace-nowrap">
        <span className={`size-2 shrink-0 rounded-full ${DOT[status]}`} aria-hidden />
        {STATUS_LABEL[status]}
      </span>
    </Tooltip>
  );
}
