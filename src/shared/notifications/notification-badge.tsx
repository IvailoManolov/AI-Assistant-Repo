"use client";

/**
 * One badge for anything waiting on a person.
 *
 * Used by the customer's chat dock for unread assistant replies and by the
 * operator's session rail for sessions that need attention, so the two
 * surfaces teach the same vocabulary: a breathing mark means something is
 * waiting, and its colour says how much that matters.
 */
export type NotificationTone = "info" | "attention" | "alert";

/**
 * Fills use the text weight of each colour rather than the signal weight,
 * because a numeral sits inside them and has to stay readable.
 */
const TONE: Record<NotificationTone, string> = {
  info: "bg-cobalt text-cream pulse-info",
  attention: "bg-amber text-cream pulse-attention",
  alert: "bg-danger text-cream pulse-alert",
};

export function NotificationBadge({
  count,
  tone = "info",
  label,
  live = false,
  className = "",
}: {
  /** Omit for a bare mark. A count of zero renders nothing at all. */
  count?: number;
  tone?: NotificationTone;
  /** What the badge means, for anyone not looking at the colour. */
  label: string;
  /** Announce changes. True where the badge appears without the person acting. */
  live?: boolean;
  className?: string;
}) {
  if (count !== undefined && count < 1) return null;

  const counted = count !== undefined;

  return (
    <span
      role={live ? "status" : undefined}
      aria-label={label}
      className={`breathe inline-flex shrink-0 items-center justify-center rounded-full font-mono text-[11px] leading-none font-semibold tabular-nums ${
        TONE[tone]
      } ${counted ? "min-w-5 px-1.5 py-1" : "size-2.5"} ${className}`}
    >
      {counted ? (count > 99 ? "99+" : count) : null}
    </span>
  );
}
