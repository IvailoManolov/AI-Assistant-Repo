/**
 * The guard an agent runs before it proposes anything consequential.
 *
 * Shared, because more than one agent needs it and because a check that is
 * copied is a check that will eventually disagree with itself. The order agent
 * uses it to confirm it is inside a live conversation; the refund agent uses it
 * before proposing to move money.
 *
 * WHAT THIS IS NOT
 *
 * It is not an authority. Nothing here grants anything, and the kernel
 * re-checks every one of these properties from its own side whatever this
 * returns. An agent refusing to propose is an agent being well behaved; the
 * kernel refusing to execute is the system being safe. If the two ever
 * disagree, the kernel is right by construction, because it is the only one
 * holding the authenticated identity.
 *
 * What it buys is that a bad proposal never gets made, so the trace shows an
 * agent that declined rather than an agent that tried and was stopped. That is
 * a real difference when a person is reading the tree to work out whether the
 * system understood the request.
 *
 * THE DATABASE CALL
 *
 * `lookupSession` reads the result of the `check_session` tool, which the
 * kernel served by asking the guard, which read the token out of the mock
 * environment's store. That chain is the contrived database call: an agent
 * asks "is this conversation real and whose is it", and something outside the
 * agent answers. The agent never reads the store, never sees a token, and
 * cannot mint one.
 */
import type { DisclosedOrder } from "../../../guard/disclosure.ts";

/**
 * What comes back from the lookup.
 *
 * Note what is absent: there is no customer id. The agent is never told which
 * account it is working on, because it has no legitimate use for that and
 * every illegitimate one. The identity lives in the request envelope, which is
 * on the other side of the kernel.
 */
export type AgentSessionView = {
  valid: boolean;
  sessionId: string | null;
  lastOrderId: string | null;
  awaitingConfirmation: { orderId: string; orderSummary: string } | null;
};

export type GuardRefusal =
  | "no_session_lookup"
  | "session_not_live"
  | "order_not_retrieved"
  | "identity_named_by_agent";

export type GuardVerdict = { ok: true } | { ok: false; reason: GuardRefusal; detail: string };

const allow = (): GuardVerdict => ({ ok: true });
const refuse = (reason: GuardRefusal, detail: string): GuardVerdict => ({ ok: false, reason, detail });

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

/**
 * The contrived database call, as the agent sees it: find the `check_session`
 * result among the tool results this conversation has accumulated.
 *
 * Returns null when the lookup has not happened yet, which is different from a
 * lookup that came back invalid, and the two lead to different refusals.
 */
export function lookupSession(results: readonly unknown[]): AgentSessionView | null {
  for (const result of results) {
    if (!isRecord(result) || !("valid" in result) || !("session_id" in result)) continue;
    const pending = isRecord(result.awaiting_confirmation) ? result.awaiting_confirmation : null;
    return {
      valid: result.valid === true,
      sessionId: typeof result.session_id === "string" ? result.session_id : null,
      lastOrderId: typeof result.last_order_id === "string" ? result.last_order_id : null,
      awaitingConfirmation: pending
        ? {
            orderId: String(pending.orderId ?? ""),
            orderSummary: String(pending.orderSummary ?? ""),
          }
        : null,
    };
  }
  return null;
}

/** The conversation has to be real before anything is done inside it. */
export function requireLiveSession(session: AgentSessionView | null): GuardVerdict {
  if (!session) return refuse("no_session_lookup", "check_session has not been called in this turn.");
  if (!session.valid) {
    return refuse("session_not_live", `The session lookup came back invalid for ${session.sessionId ?? "this conversation"}.`);
  }
  return allow();
}

/**
 * The order must be one a scoped read actually returned.
 *
 * This is the check that stops one customer acting on another's order at the
 * agent layer. Every order in `retrieved` came back through the guard, which
 * only returns what the authenticated account owns, so an order that is not in
 * that list is either somebody else's, nonexistent, or invented by the model.
 * All three are the same refusal, and the agent cannot tell them apart, which
 * is the disclosure rule holding even inside the pipeline.
 */
export function requireRetrievedOrder(
  retrieved: readonly DisclosedOrder[],
  orderId: string,
): GuardVerdict {
  if (retrieved.some((order) => order.order_id === orderId)) return allow();
  return refuse(
    "order_not_retrieved",
    `${orderId} was not returned by a scoped read in this conversation, so there is nothing to act on.`,
  );
}

const IDENTITY_FIELDS = ["customer_id", "customerId", "account_id", "wallet_owner", "owner_id"];

/**
 * An agent may not name whose money it is.
 *
 * The tools declare no customer field, so filling one in is already out of
 * schema. This refuses before the call is even made, and it covers the wallet
 * as well as the account: an action that names a wallet owner is an action
 * trying to choose one, and the only wallet any action may touch is the one
 * belonging to the session the kernel bound.
 */
export function requireNoNamedIdentity(input: Record<string, unknown>): GuardVerdict {
  const named = IDENTITY_FIELDS.find((field) => input[field] !== undefined);
  if (!named) return allow();
  return refuse(
    "identity_named_by_agent",
    `The proposal named ${named}. Identity comes from the request envelope, never from an agent.`,
  );
}

/**
 * Everything the refund agent must be able to say yes to before it proposes.
 *
 * Composed rather than one function, so each half is testable on its own and a
 * refusal says which of them failed.
 */
export function guardRefundProposal(input: {
  session: AgentSessionView | null;
  retrieved: readonly DisclosedOrder[];
  orderId: string;
  proposal: Record<string, unknown>;
}): GuardVerdict {
  const live = requireLiveSession(input.session);
  if (!live.ok) return live;

  const retrieved = requireRetrievedOrder(input.retrieved, input.orderId);
  if (!retrieved.ok) return retrieved;

  return requireNoNamedIdentity(input.proposal);
}

/** What the customer is told when an agent declines. It names no reason code. */
export const GUARD_WORDING: Record<GuardRefusal, string> = {
  no_session_lookup: "I could not confirm this conversation, so I have not acted on it.",
  session_not_live: "This conversation has expired. Please start a new one.",
  order_not_retrieved: "No order with that reference is available on this account.",
  identity_named_by_agent: "I could not complete that here.",
};
