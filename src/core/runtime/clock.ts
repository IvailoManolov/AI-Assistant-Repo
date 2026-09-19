/**
 * The clock, injected rather than reached for.
 *
 * Nothing below the adapter layer calls Date.now(). Replaying a session under
 * a fixed clock has to produce the same trace as the original run, and that is
 * only true if there is exactly one place time enters the system.
 */
export type Clock = { now: () => Date };

export const systemClock: Clock = { now: () => new Date() };

let active: Clock = systemClock;

export const setClock = (clock: Clock) => {
  active = clock;
};

export const now = () => active.now();
export const nowMs = () => active.now().getTime();
export const nowIso = () => active.now().toISOString();

/** Wall-clock time of day, the format the transcript and the log share. */
export const stamp = () =>
  active.now().toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: "UTC",
  });
