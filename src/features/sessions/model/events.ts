/**
 * A nudge, not a state channel.
 *
 * The console polls for sessions on a timer, which is fine for sessions that
 * arrive on their own but too slow to feel right after the operator has just
 * pressed something. Anything that changes sessions announces it, and the
 * console polls immediately rather than waiting out the interval.
 */
export const SESSIONS_CHANGED = "robby:sessions-changed";

export const announceSessionsChanged = () => {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(SESSIONS_CHANGED));
};
