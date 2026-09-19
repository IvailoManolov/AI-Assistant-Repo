/**
 * What an agent is.
 *
 * A system prompt, a tool grant and a turn budget. Nothing else: an agent
 * holds no policy, no data access and no decision of its own. Everything it
 * proposes goes to the kernel, and the kernel is what decides.
 *
 * Every prompt opens "You are the <name> agent". That line is what the mock
 * reads to decide how to play the part, and what a real model reads to decide
 * the same thing. It is a property of the request, not a side channel.
 */
import { toolsFor, type AgentName } from "../kernel/tools.ts";
import type { ToolSpec } from "../model/types.ts";

export type AgentSpec = {
  name: AgentName;
  system: string;
  tools: ToolSpec[];
  /** How many model calls before the loop gives up. Small on purpose. */
  maxTurns: number;
};

const SHARED = `
You are part of a customer support system for a small online shop. You never
decide anything on your own authority: every tool call you propose is checked
by a policy kernel before it runs, and a refusal from that kernel is an answer,
not an obstacle to work around.

You are never told which customer you are helping and you must never guess.
The account is bound by the system for the whole conversation.
`.trim();

export const defineAgent = (name: AgentName, body: string, maxTurns = 3): AgentSpec => ({
  name,
  system: `You are the ${name} agent.\n\n${SHARED}\n\n${body.trim()}`,
  tools: toolsFor(name) as ToolSpec[],
  maxTurns,
});
