/**
 * Routing.
 *
 * Deterministic, and not the model's choice. A route intent maps to a fixed
 * pipeline through a plain lookup, so the same situation always runs the same
 * agents in the same order.
 *
 * Resolving the customer's message into a route intent happens in `resolve.ts`
 * rather than here, because that needs the conversation's state as well as the
 * message, and keeping the two apart is what lets this table be exhaustive and
 * testable on its own.
 *
 * The refund agent is always preceded by the order agent. That is not a
 * convention to remember: `assertWellFormed` refuses a pipeline that breaks
 * it, and `route` calls it on the way past. Refund reasoning therefore always
 * sits on retrieved facts rather than on the customer's claim alone, which is
 * the structural answer to requirement I4.
 */
import type { RouteIntent } from "../contracts.ts";
import type { AgentName } from "../kernel/tools.ts";

export const PIPELINES: Record<RouteIntent, readonly AgentName[]> = {
  order_status: ["order", "composer"],
  refund_request: ["order", "refund", "composer"],
  /** Retrieve the order so the question names something real, then ask it. */
  refund_ask: ["order", "composer"],
  /** List what there is, so the customer picks from records rather than memory. */
  refund_pick: ["order", "composer"],
  refund_confirm: ["order", "refund", "composer"],
  refund_cancel: ["composer"],
  other: ["composer"],
};

export function assertWellFormed(pipeline: readonly AgentName[]): void {
  const refund = pipeline.indexOf("refund");
  if (refund === -1) return;
  const order = pipeline.indexOf("order");
  if (order === -1 || order > refund) {
    throw new Error("A pipeline that runs the refund agent must run the order agent first.");
  }
}

export function route(intent: RouteIntent): readonly AgentName[] {
  const pipeline = PIPELINES[intent] ?? PIPELINES.other;
  assertWellFormed(pipeline);
  return pipeline;
}
