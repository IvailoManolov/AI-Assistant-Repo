/**
 * How the stand-in model plays triage.
 *
 * It reads the briefing out of the user message, classifies it, and pulls out
 * every order reference and money figure it can see. Deterministic: no
 * randomness, no clock, no lookup of the supplied examples.
 */
import type { TriageOutput } from "../../contracts.ts";
import { readBriefing } from "../../model/mock/briefing.ts";
import { lastUserText, type MessageRequest, type TextBlock } from "../../model/types.ts";
import { monetaryFigures, orderReferences } from "../../text/figures.ts";
import { certaintyFor } from "../certainty.ts";
import { asksOrderStatus, classify } from "./language.ts";

export function triageBehaviour(request: MessageRequest): TextBlock[] {
  const briefing = readBriefing<{ message: string }>(lastUserText(request.messages));
  const message = briefing?.message ?? lastUserText(request.messages);

  const orderIds = orderReferences(message);
  const stated = monetaryFigures(message);

  const intent = classify(message);

  const output: TriageOutput = {
    intent,
    order_ids: orderIds,
    stated_amounts_minor: stated,
    /** Only a question about an order can be a question about its progress. */
    asks_status: intent === "order_status" && asksOrderStatus(message),
    certainty: certaintyFor({
      reasoned: true,
      identified: orderIds.length > 0,
      statedAmountAgrees: null,
    }),
  };

  return [{ type: "text", text: JSON.stringify(output) }];
}
