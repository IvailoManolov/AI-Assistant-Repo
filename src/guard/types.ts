/**
 * Who is asking, and what an answer looks like when they may not have one.
 */

/**
 * A customer principal is scoped to exactly one customer id and can never be
 * widened. An operator principal may read refund records and act on them, and
 * reaches order data only to re-check a refund it is being asked to decide.
 *
 * There is no third shape, and in particular there is no principal the model
 * can mint. Identity enters the system from the request envelope only.
 */
export type Principal =
  | { kind: "customer"; customerId: string }
  | { kind: "operator"; operatorId: string };

export type AuthContext = {
  principal: Principal;
  /** When this context was minted. Useful in the audit line, never in a rule. */
  issuedAt: string;
};

/**
 * Reads return a result rather than throwing, because "you may not see this"
 * and "this does not exist" have to be the same answer to the customer and
 * two different lines in the log. An exception would carry a stack that says
 * which.
 */
export type Access<T> = { ok: true; value: T } | { ok: false; code: "not_found" };
