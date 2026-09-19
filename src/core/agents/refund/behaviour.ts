/**
 * How the stand-in model plays the refund agent.
 *
 * It checks the session, picks the line the message is about, works out a
 * quantity and a reason from the record, and proposes.
 */
import type { RefundBriefing } from "../../contracts.ts";
import { readBriefing } from "../../model/mock/briefing.ts";
import { newId } from "../../runtime/ids.ts";
import {
  lastUserText,
  toolResults,
  type MessageRequest,
  type TextBlock,
  type ToolUseBlock,
} from "../../model/types.ts";
import { certaintyFor } from "../certainty.ts";
import { GUARD_WORDING, guardRefundProposal, lookupSession } from "../common/guard.ts";
import { bestLine, quantityFor, reasonFor } from "./matching.ts";

const toolUse = (name: string, input: Record<string, unknown> = {}): ToolUseBlock => ({
  type: "tool_use",
  id: newId("toolu"),
  name,
  input,
});

const text = (value: string): TextBlock => ({ type: "text", text: value });

export function refundBehaviour(request: MessageRequest): (TextBlock | ToolUseBlock)[] {
  const prior = toolResults(request.messages);
  const briefing = readBriefing<RefundBriefing>(lastUserText(request.messages));

  /** Turn one: establish the session before touching anything. */
  if (prior.length === 0) return [toolUse("check_session")];

  /** A proposal has already come back, so say what happened to it and stop. */
  const raised = prior.find((r) => typeof r === "object" && r !== null && "refund_id" in r) as
    | { refund_id?: string }
    | undefined;
  const refusal = prior.find(
    (r) => typeof r === "object" && r !== null && "error" in r && !("valid" in r),
  );

  if (raised?.refund_id) return [text(`Refund ${raised.refund_id} is held for approval.`)];
  if (refusal) return [text("The refund could not be raised on the record as it stands.")];

  if (!briefing || briefing.orders.length === 0) {
    return [text("No order record was available, so there is nothing to raise a refund against.")];
  }

  const target =
    briefing.orders.find((o) => o.order_id === briefing.confirmed_order_id) ??
    briefing.orders.find((o) => briefing.order_ids.includes(o.order_id)) ??
    briefing.orders[0];

  const { line, score } = bestLine(target, briefing.message);
  const quantity = quantityFor(line.name, briefing.message, line.quantity);
  const computed = line.unit_price_minor * quantity;

  /**
   * The mock reproduces the failure mode a real model actually has here: it
   * anchors on the figure the customer named rather than the one the record
   * supports. That is not a contrivance to make a rule fire, it is the most
   * common way a helpful model gets a refund amount wrong, and rule R4 exists
   * precisely because the model's number must never be the authority.
   */
  const stated = briefing.stated_amounts_minor[0];
  const proposed = stated ?? computed;
  const reason = reasonFor(briefing.message, line.return_status);

  const proposal = {
    order_id: target.order_id,
    item_id: line.item_id,
    quantity,
    amount_minor: proposed,
    reason_code: reason,
    certainty: certaintyFor({
      reasoned: reason !== "unspecified",
      identified: score > 0,
      statedAmountAgrees: stated === undefined ? null : stated === computed,
    }),
  };

  /**
   * The last thing before money is proposed. The kernel will check all of this
   * again from its own side; declining here means the trace shows an agent
   * that knew better rather than one that tried.
   */
  const verdict = guardRefundProposal({
    session: lookupSession(prior),
    retrieved: briefing.orders,
    orderId: target.order_id,
    proposal,
  });

  if (!verdict.ok) {
    return [text(`${GUARD_WORDING[verdict.reason]} (${verdict.detail})`)];
  }

  return [
    text(`Raising a refund on ${target.order_id} for ${quantity} x ${line.name}.`),
    toolUse("propose_refund", proposal),
  ];
}
