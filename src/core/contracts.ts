/**
 * The shapes passed between the orchestrator and the agents.
 *
 * They live at the root of core, depending on nothing but the guard's
 * disclosure type, because both sides need them: the orchestrator writes a
 * briefing into an agent's user message, and the model reads it back out.
 * One definition means the two cannot drift into disagreeing about what a
 * field is called.
 */
import type { DisclosedOrder } from "../guard/disclosure.ts";

/**
 * What the message itself says. Triage holds no tools, so this is everything
 * it is in a position to decide: `affirmation` means the customer said yes to
 * something, not that there was anything to say yes to.
 */
export type Intent =
  | "order_status"
  | "refund_request"
  | "affirmation"
  | "negation"
  | "other";

/**
 * What the pipeline should therefore do. Resolved by the orchestrator from
 * the intent plus what the conversation already established, which is the
 * only place those two facts sit together.
 */
export type RouteIntent =
  | "order_status"
  /** An order was named and a refund was asked for. Go. */
  | "refund_request"
  /** A refund was asked for about the order already under discussion. Check first. */
  | "refund_ask"
  /** A refund was asked for and no order is in play. Show them what there is. */
  | "refund_pick"
  /** They confirmed the order. Now do the work. */
  | "refund_confirm"
  /** They said it was the wrong one. */
  | "refund_cancel"
  | "other";

/** What triage returns. */
export type TriageOutput = {
  intent: Intent;
  order_ids: string[];
  /** Figures the customer named, in minor units. Untrusted input. Feeds R8. */
  stated_amounts_minor: number[];
  /** The message asked where an order has got to, not just about an order. */
  asks_status: boolean;
  certainty: number;
};

export type OrderBriefing = {
  message: string;
  order_ids: string[];
  /** Why this lookup is happening, so the agent knows what it is retrieving for. */
  purpose: RouteIntent;
};

/**
 * The refund agent is always preceded by the order agent, so `orders` is
 * never empty when a refund is genuinely possible. That ordering is the
 * structural answer to I4: refund reasoning sits on retrieved facts, not on
 * the customer's claim alone.
 */
export type RefundBriefing = {
  message: string;
  order_ids: string[];
  stated_amounts_minor: number[];
  orders: DisclosedOrder[];
  /** Set when this turn is acting on an order the customer just confirmed. */
  confirmed_order_id: string | null;
};

export type RefundSummary = {
  refund_id: string;
  order_id: string;
  item_name: string;
  quantity: number;
  amount: string;
  amount_minor: number;
  state: string;
};

/** A question the assistant is posing rather than an answer it is giving. */
export type Ask =
  | { kind: "confirm_refund_target"; order_id: string; order_summary: string }
  | { kind: "which_order" };

/**
 * Everything the composer is allowed to know. It has no tools and no record
 * access, so every figure it can legitimately write is in here. That is what
 * makes R10 checkable rather than aspirational.
 */
export type ComposerBriefing = {
  customer_name: string;
  intent: RouteIntent;
  status: "ok" | "hold" | "blocked" | "info";
  orders: DisclosedOrder[];
  refusal?: { code: string; message: string };
  refund?: RefundSummary;
  certainty?: number;
  ask?: Ask;
  /**
   * What the answer should lead with. Set only when the customer asked after
   * an order's progress, which is a different sentence from "here is your
   * order": it opens on the state, and on when the order reached it.
   */
  focus?: "status";
};
