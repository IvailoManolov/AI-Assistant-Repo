/**
 * R10. No monetary figure in customer-facing text that no decision carried.
 *
 * This is the last thing standing between a customer saying "I expected
 * EUR 34.90" and the assistant replying with EUR 34.90 as though the system
 * had agreed to it. The composer has no tools and no record access, so every
 * number it can legitimately write came from the decision object it was
 * handed. Anything else is invention.
 *
 * On a violation the text is replaced with a template rather than
 * regenerated. A retry against a deterministic model returns an identical
 * violation, so a retry loop would not terminate.
 */
import { monetaryFigures } from "../text/figures.ts";

export { monetaryFigures };

export type FidelityCheck = { ok: boolean; offending: number[] };

export function checkOutputFidelity(text: string, allowedMinor: readonly number[]): FidelityCheck {
  const allowed = new Set(allowedMinor);
  const offending = monetaryFigures(text).filter((minor) => !allowed.has(minor));
  return { ok: offending.length === 0, offending };
}

/**
 * What the customer gets instead. It says less rather than something else:
 * the one failure mode worth avoiding here is replacing an invented number
 * with a different invented number.
 */
export const FIDELITY_FALLBACK =
  "I have looked at your order and passed this to a colleague to finish. " +
  "They will confirm the exact figures with you shortly.";
