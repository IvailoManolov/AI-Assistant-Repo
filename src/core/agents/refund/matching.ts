/**
 * Working out what on an order the customer means.
 *
 * All of it operates on the record that was retrieved, never on the customer's
 * claim. That is requirement I4 expressed as code rather than as a prompt
 * instruction: the only way to reach this file is through a pipeline that ran
 * the order agent first.
 */
import type { DisclosedOrder } from "../../../guard/disclosure.ts";

type Line = DisclosedOrder["items"][number];

const NUMBER_WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, both: 2, a: 1, an: 1,
};

const tokens = (value: string): string[] =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => (word.length > 3 && word.endsWith("s") ? word.slice(0, -1) : word));

/**
 * How strongly a line item's name is present in the message. Token overlap
 * rather than substring, so "wine glasses" matches "Wine Glass" and "glass
 * jar" does not match it any better than it should.
 */
export function nameScore(itemName: string, message: string): number {
  const words = new Set(tokens(message));
  const name = tokens(itemName);
  if (name.length === 0) return 0;
  return name.filter((word) => words.has(word)).length / name.length;
}

/** The line the message is most likely about, with how sure that is. */
export function bestLine(order: DisclosedOrder, message: string): { line: Line; score: number } {
  const scored = order.items
    .map((item) => ({ line: item, score: nameScore(item.name, message) }))
    .sort((a, b) => b.score - a.score);
  return scored[0];
}

/**
 * How many units the customer seems to mean. One unless they said otherwise,
 * which is right for "one of the wine glasses" and right for a message that
 * names no quantity at all.
 */
export function quantityFor(itemName: string, message: string, lineQuantity: number): number {
  const text = message.toLowerCase();
  const head = tokens(itemName)[0];

  if (/\ball (of )?(the |them|these|those)?\b/.test(text)) return lineQuantity;
  if (text.includes("both")) return Math.min(2, lineQuantity);

  if (head) {
    const near = new RegExp(`\\b(\\d+|${Object.keys(NUMBER_WORDS).join("|")})\\b[^.]{0,24}${head}`, "i");
    const match = text.match(near);
    if (match) {
      const raw = match[1].toLowerCase();
      const value = NUMBER_WORDS[raw] ?? Number(raw);
      if (Number.isFinite(value) && value >= 1) return Math.min(value, lineQuantity);
    }
  }

  return 1;
}

export type ReasonCode = "damaged_on_arrival" | "return_received" | "not_as_described" | "unspecified";

export function reasonFor(message: string, returnStatus?: string): ReasonCode {
  const text = message.toLowerCase();
  if (/(broken|damaged|cracked|smashed|shattered|faulty|defective)/.test(text)) {
    return "damaged_on_arrival";
  }
  if (returnStatus === "received" || /\breturn(ed)?\b/.test(text)) return "return_received";
  if (/(not as described|wrong item|different from)/.test(text)) return "not_as_described";
  return "unspecified";
}
