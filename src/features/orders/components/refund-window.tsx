"use client";

import { Tooltip } from "@/shared";

/**
 * The refund window, as seven days you can count.
 *
 * A rule the operator has to reason about every time they open a refund is
 * worth showing rather than stating. Seven marks, one per day of the window,
 * filling from the left as the days go. You can see at a glance that an order
 * has two days left without reading a number, and you can still read the
 * number when it matters.
 *
 * Discrete marks rather than a bar, because the rule is discrete: it counts
 * whole days, and a smooth bar would imply a precision the policy does not
 * have. The colour carries the urgency, so the shape does not have to.
 */
const TONE = {
  fresh: { fill: "bg-green-signal", text: "text-green" },
  closing: { fill: "bg-amber-signal", text: "text-amber" },
  gone: { fill: "bg-danger-signal", text: "text-danger" },
} as const;

function toneFor(daysLeft: number) {
  if (daysLeft <= 0) return TONE.gone;
  if (daysLeft <= 3) return TONE.closing;
  return TONE.fresh;
}

export function RefundWindow({
  daysLeft,
  daysSinceArrival,
  windowDays = 7,
  status,
}: {
  daysLeft: number | null;
  daysSinceArrival: number | null;
  windowDays?: number;
  status: string;
}) {
  /** Nothing has arrived, so no window has started. Say that, do not draw zero. */
  if (daysLeft === null || daysSinceArrival === null) {
    return (
      <Tooltip label={`The window opens on arrival. This order is ${status.replace(/_/g, " ")}.`}>
        <span className="text-[11.5px] text-muted">Not arrived</span>
      </Tooltip>
    );
  }

  const tone = toneFor(daysLeft);
  const used = Math.min(windowDays, Math.max(0, daysSinceArrival));
  const expired = daysLeft <= 0;

  const label = expired
    ? `Window closed. It arrived ${daysSinceArrival} days ago, and the window is ${windowDays} days.`
    : `${daysLeft} of ${windowDays} days left. It arrived ${daysSinceArrival} day${daysSinceArrival === 1 ? "" : "s"} ago.`;

  return (
    <Tooltip label={label}>
      <span className="flex items-center gap-2">
        <span className="flex items-end gap-[2px]" aria-hidden>
          {Array.from({ length: windowDays }, (_, day) => (
            <span
              key={day}
              className={`h-3.5 w-[3px] rounded-[1px] ${day < used ? tone.fill : "bg-sunk-line"}`}
            />
          ))}
        </span>
        <span className={`text-[11.5px] tabular-nums ${tone.text}`}>
          {expired ? "closed" : `${daysLeft}d left`}
        </span>
      </span>
    </Tooltip>
  );
}
