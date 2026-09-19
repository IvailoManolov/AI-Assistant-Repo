/**
 * Identifier generation, injected for the same reason as the clock: a replay
 * that invents different ids is not a replay.
 */
export type IdSource = { next: (prefix: string) => string };

const randomHex = () =>
  Math.floor(Math.random() * 0xffff)
    .toString(16)
    .padStart(4, "0");

export const randomIds: IdSource = { next: (prefix) => `${prefix}-${randomHex()}` };

/** Counts from zero per prefix. For tests and for replaying a recorded run. */
export function sequentialIds(): IdSource {
  const counts = new Map<string, number>();
  return {
    next: (prefix) => {
      const n = (counts.get(prefix) ?? 0) + 1;
      counts.set(prefix, n);
      return `${prefix}-${n.toString(16).padStart(4, "0")}`;
    },
  };
}

let active: IdSource = randomIds;

export const setIdSource = (source: IdSource) => {
  active = source;
};

export const newId = (prefix: string) => active.next(prefix);
