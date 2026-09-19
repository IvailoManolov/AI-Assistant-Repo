/**
 * Pulling money and order references out of free text.
 *
 * One implementation, used from both ends and for opposite reasons: triage
 * reads the customer's message to find what they claimed, and R10 reads the
 * composer's draft to find what it asserted. Two copies of these patterns
 * would eventually disagree, and the rule that catches an invented figure
 * would stop matching the rule that recorded the claimed one.
 */
const CURRENCY_MARKED =
  /(?:€|EUR)\s*(\d+(?:[.,]\d{1,2})?)|(\d+(?:[.,]\d{1,2})?)\s*(?:€|EUR\b)/gi;
const BARE_DECIMAL = /(?<![\w.,-])(\d+[.,]\d{2})(?![\w.,])/g;

const toMinorUnits = (raw: string): number => Math.round(Number(raw.replace(",", ".")) * 100);

/** Every figure a reader would take for money, in minor units, deduplicated. */
export function monetaryFigures(text: string): number[] {
  const found = new Set<number>();

  for (const match of text.matchAll(CURRENCY_MARKED)) {
    const raw = match[1] ?? match[2];
    if (raw) found.add(toMinorUnits(raw));
  }
  for (const match of text.matchAll(BARE_DECIMAL)) {
    found.add(toMinorUnits(match[1]));
  }

  return [...found];
}

/**
 * How a customer actually writes an order reference.
 *
 * The supplied data spells them ORD-200, and nobody typing into a chat box
 * reliably will. "order 200", "ORDER-1002", "#300" and "ord 100" all name an
 * order, so all of them are picked up and normalised to the one spelling the
 * records use.
 *
 * `ordered 3 wine glasses` does not match, because `ordered` is not `order`
 * followed by a number.
 */
const REFERENCE = /\b(?:ord|order)\s*[-#:–]?\s*(\d{1,6})\b|#\s?(\d{2,6})\b/gi;

/** The canonical form: what the records are keyed on. */
export const canonicalOrderId = (digits: string): string => `ORD-${digits}`;

/**
 * Order references named in the text, in the one spelling the records use.
 *
 * Only the canonical form is returned. An earlier version also emitted the
 * customer's own spelling as a second candidate, in case a runtime order had
 * been created under a different prefix. That was worse than useless: typing
 * "order-200" then produced both ORD-200 and ORDER-200, the second was looked
 * up, refused, and the refusal buried the record that had just been found.
 * One reference in, one reference out.
 */
export function orderReferences(text: string): string[] {
  const found: string[] = [];

  for (const match of text.matchAll(REFERENCE)) {
    const digits = match[1] ?? match[2];
    if (!digits) continue;
    const id = canonicalOrderId(digits);
    if (!found.includes(id)) found.push(id);
  }

  return found;
}
