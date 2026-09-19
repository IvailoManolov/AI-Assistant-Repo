/**
 * Money, in integer minor units.
 *
 * The supplied seed writes amounts as floating point majors (14.90). Anything
 * that arithmetic touches is converted to minor units at the boundary and
 * converted back only on the way to a human, because 14.90 * 3 in binary
 * floating point is 44.699999999999996 and a refund that is one cent short is
 * a support ticket of its own.
 */
export const CURRENCY = "EUR" as const;

/** Seed majors to minor units. Rounds, because 14.9 is not exactly 14.90. */
export const toMinor = (major: number): number => Math.round(major * 100);

export const fromMinor = (minor: number): number => minor / 100;

/** The only place an amount becomes text. */
export const formatMinor = (minor: number, currency: string = CURRENCY): string =>
  `${currency} ${(minor / 100).toFixed(2)}`;
