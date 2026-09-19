/**
 * Turning what was said into what to do.
 *
 * Triage classifies the message, and it holds no tools, so it cannot know
 * whether there was a question outstanding for the customer to be answering.
 * "Yes" is an affirmation on its own; whether it is a yes to anything depends
 * on the conversation, and the conversation's state lives behind the guard.
 *
 * This is the one place those two facts sit together, which is why it is a
 * pure function of both and not a lookup inside either.
 */
import type { Intent, RouteIntent } from "../contracts.ts";
import type { PendingConfirmation } from "../../guard/sessions.ts";

export type Situation = {
  intent: Intent;
  /** Order references the customer named in this message. */
  namedOrderIds: readonly string[];
  /** The order this conversation has been about, if any. */
  lastOrderId: string | null;
  /** The question the assistant is waiting on an answer to, if any. */
  pending: PendingConfirmation | null;
};

export type Resolution = {
  route: RouteIntent;
  /** Which order the pipeline should retrieve. Empty means list the account. */
  targetOrderIds: string[];
  /** Set only when the customer has just confirmed the order in this turn. */
  confirmedOrderId: string | null;
  /** Why this route was taken, for the trace. */
  because: string;
};

export function resolve(situation: Situation): Resolution {
  const { intent, namedOrderIds, lastOrderId, pending } = situation;

  /** An answer only counts as one when something was asked. */
  if (pending && intent === "affirmation") {
    return {
      route: "refund_confirm",
      targetOrderIds: [pending.orderId],
      confirmedOrderId: pending.orderId,
      because: `Customer confirmed ${pending.orderId}.`,
    };
  }

  if (pending && intent === "negation") {
    return {
      route: "refund_cancel",
      targetOrderIds: [],
      confirmedOrderId: null,
      because: `Customer rejected ${pending.orderId}. Nothing raised.`,
    };
  }

  if (intent === "refund_request") {
    if (namedOrderIds.length > 0) {
      return {
        route: "refund_request",
        targetOrderIds: [...namedOrderIds],
        confirmedOrderId: null,
        because: `Refund asked for on ${namedOrderIds.join(", ")}, named in the message.`,
      };
    }
    if (lastOrderId) {
      return {
        route: "refund_ask",
        targetOrderIds: [lastOrderId],
        confirmedOrderId: null,
        because: `Refund asked for with no reference. ${lastOrderId} is under discussion, so it is checked first.`,
      };
    }
    return {
      route: "refund_pick",
      targetOrderIds: [],
      confirmedOrderId: null,
      because: "Refund asked for with no order in play. Listing the account to choose from.",
    };
  }

  if (intent === "order_status") {
    const targets = namedOrderIds.length > 0 ? [...namedOrderIds] : lastOrderId ? [lastOrderId] : [];
    return {
      route: "order_status",
      targetOrderIds: targets,
      confirmedOrderId: null,
      because: targets.length
        ? `Status asked about ${targets.join(", ")}.`
        : "Status asked about no particular order. Listing the account.",
    };
  }

  /**
   * A bare yes or no with nothing outstanding is not an answer to anything.
   * Treating it as one is how a system ends up raising a refund because
   * somebody typed "ok".
   */
  return {
    route: "other",
    targetOrderIds: [],
    confirmedOrderId: null,
    because:
      intent === "affirmation" || intent === "negation"
        ? "Answer given with no question outstanding. Treated as a new message."
        : "Nothing in the message names an order or asks for an action.",
  };
}
