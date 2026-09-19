/**
 * The confidence number the model states, by decision D6.
 *
 * Deterministic, so a replay matches, and advisory only: no rule reads it. It
 * rises when the record corroborates the customer and falls when the customer
 * named a figure the record does not support, which is the shape an operator
 * would expect a real one to have. Shared by the agents that state one.
 */
export type CertaintyInput = {
  /** Whether a concrete reason was identifiable from the message. */
  reasoned: boolean;
  /** Whether the thing being acted on was named, not inferred. */
  identified: boolean;
  /** true agrees with the record, false contradicts it, null means unstated. */
  statedAmountAgrees: boolean | null;
};

export function certaintyFor(input: CertaintyInput): number {
  let score = 60;
  if (input.reasoned) score += 15;
  if (input.identified) score += 15;
  if (input.statedAmountAgrees === true) score += 10;
  if (input.statedAmountAgrees === false) score -= 25;
  return Math.max(5, Math.min(95, score));
}
