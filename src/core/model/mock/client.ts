/**
 * The mock model client.
 *
 * It implements ModelClient and nothing else. Which behaviour runs is read off
 * the system prompt, because that is genuinely part of the request: an agent
 * whose prompt opens "You are the refund agent" is the refund agent, and the
 * same line is what a real model would be reading to decide how to act. No
 * side channel, no agent field bolted onto the API shape.
 *
 * The behaviours themselves live with the agents they play, in
 * `core/agents/<name>/behaviour.ts`.
 *
 * Deterministic by construction. The only identifiers it mints come from the
 * injected id source, so a replay under a fixed source produces byte identical
 * tool_use ids.
 */
import { composerBehaviour } from "../../agents/composer/behaviour.ts";
import { orderBehaviour } from "../../agents/order/behaviour.ts";
import { refundBehaviour } from "../../agents/refund/behaviour.ts";
import { triageBehaviour } from "../../agents/triage/behaviour.ts";
import { newId } from "../../runtime/ids.ts";
import type {
  MessageRequest,
  MessageResponse,
  ModelClient,
  TextBlock,
  ToolUseBlock,
} from "../types.ts";

export const MOCK_MODEL = "mock-claude-support-1";

type Behaviour = (request: MessageRequest) => (TextBlock | ToolUseBlock)[];

const ROLES: Record<string, Behaviour> = {
  triage: triageBehaviour,
  order: orderBehaviour,
  refund: refundBehaviour,
  composer: composerBehaviour,
};

const roleOf = (system: string): string => {
  const match = system.match(/you are the (\w+) agent/i);
  return match ? match[1].toLowerCase() : "composer";
};

/** Rough, stable, and never read by anything that makes a decision. */
const countTokens = (value: string): number => Math.ceil(value.length / 4);

export const mockModelClient: ModelClient = {
  async createMessage(request: MessageRequest): Promise<MessageResponse> {
    const behaviour = ROLES[roleOf(request.system)];
    if (!behaviour) {
      throw new Error(`No mock behaviour for the system prompt: ${request.system.slice(0, 60)}`);
    }

    const content = behaviour(request);
    const input = request.system + JSON.stringify(request.messages);

    return {
      id: newId("msg"),
      role: "assistant",
      model: MOCK_MODEL,
      content,
      stop_reason: content.some((block) => block.type === "tool_use") ? "tool_use" : "end_turn",
      usage: {
        input_tokens: countTokens(input),
        output_tokens: countTokens(JSON.stringify(content)),
      },
    };
  },
};
