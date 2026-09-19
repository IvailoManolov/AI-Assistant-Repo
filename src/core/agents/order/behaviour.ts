/**
 * How the stand-in model plays the order agent.
 *
 * Turn one checks the session and asks for the records the briefing points at.
 * Turn two reads the results back. Where the customer named nothing, it lists
 * the account instead, which is what gives the next agent an array of real
 * orders to choose from rather than a guess.
 */
import type { OrderBriefing } from "../../contracts.ts";
import { GUARD_WORDING, lookupSession, requireLiveSession } from "../common/guard.ts";
import { readBriefing } from "../../model/mock/briefing.ts";
import { newId } from "../../runtime/ids.ts";
import {
  lastUserText,
  toolResults,
  type MessageRequest,
  type TextBlock,
  type ToolUseBlock,
} from "../../model/types.ts";

const toolUse = (name: string, input: Record<string, unknown> = {}): ToolUseBlock => ({
  type: "tool_use",
  id: newId("toolu"),
  name,
  input,
});

const has = (result: unknown, key: string): boolean =>
  typeof result === "object" && result !== null && key in result;

export function orderBehaviour(request: MessageRequest): (TextBlock | ToolUseBlock)[] {
  const prior = toolResults(request.messages);
  const briefing = readBriefing<OrderBriefing>(lastUserText(request.messages));

  /** Nothing looked up yet: establish the session and ask for the records. */
  if (prior.length === 0) {
    const ids = briefing?.order_ids ?? [];
    return [
      toolUse("check_session"),
      ...(ids.length === 0
        ? [toolUse("get_orders")]
        : ids.slice(0, 4).map((id) => toolUse("get_order", { order_id: id }))),
    ];
  }

  /** The conversation has to be real before anything read inside it is reported. */
  const live = requireLiveSession(lookupSession(prior));
  if (!live.ok) return [{ type: "text", text: GUARD_WORDING[live.reason] }];

  const read = prior.filter((r) => has(r, "order") || has(r, "orders")).length;
  const refused = prior.filter((r) => has(r, "error")).length;

  return [
    {
      type: "text",
      text:
        `Retrieved ${read} order record(s)` +
        (refused ? `, and ${refused} reference(s) had nothing available on this account.` : "."),
    },
  ];
}
