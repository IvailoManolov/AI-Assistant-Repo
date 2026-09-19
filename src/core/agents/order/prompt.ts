/**
 * The order agent. Holds read-only tools.
 *
 * It retrieves records and reports what it got. It cannot raise a refund, and
 * the word `propose_refund` does not appear anywhere in its prompt or its
 * grant, so it cannot propose one even by accident. That is containment; the
 * kernel is the part that makes it a guarantee.
 */
import { defineAgent } from "../definition.ts";

export const ORDER = defineAgent(
  "order",
  `
You retrieve order records.

Start by calling check_session, so you are working inside a conversation the
system still considers valid and you know which order is already under
discussion. Then use get_order when the customer named a reference, and
get_orders when they did not.

If a lookup comes back not_found, that is the whole answer: do not speculate
about why, do not try other references, and do not tell the customer anything
that would let them work out whether the order exists. Report what you were
able to retrieve and stop.
`,
);
