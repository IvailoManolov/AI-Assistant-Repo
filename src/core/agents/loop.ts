/**
 * The agent loop.
 *
 * Call the model, hand every tool_use it returns to the kernel, feed the
 * kernel's answers back as tool results, repeat until the model stops asking
 * for tools or the turn budget runs out.
 *
 * The important line in this file is the one that calls the kernel. The agent
 * never touches a handler, never sees the guard, and cannot tell the
 * difference between a tool that ran and a tool that was refused: both come
 * back as ordinary tool results. That is what "agents propose, only the
 * kernel executes" means in code.
 */
import { CUSTOMER_WORDING, type DenyCode } from "../kernel/codes.ts";
import { execute, type Envelope, type ToolCall, type TraceEntry } from "../kernel/kernel.ts";
import { modelClient } from "../model/registry.ts";
import { isText, isToolUse, type Message, type MessageResponse } from "../model/types.ts";
import type { RefundRecord, Signal } from "../refunds/types.ts";
import type { AgentSpec } from "./definition.ts";

const MAX_TOKENS = 1024;

export type AgentRun = {
  agent: AgentSpec["name"];
  /** Everything the model said in text, joined. */
  text: string;
  entries: TraceEntry[];
  signals: Signal[];
  /** Parsed tool results, in the order the kernel produced them. */
  results: unknown[];
  refunds: RefundRecord[];
  /** Every refusal the kernel returned, so the composer can explain one. */
  denials: { code: DenyCode; message: string }[];
  /** Figures this run authorises the composer to state. Feeds R10. */
  disclosedAmountsMinor: number[];
  error?: "model_protocol_error";
};

/** A response is usable only if every block is one of the two shapes we know. */
function wellFormed(response: MessageResponse): boolean {
  if (!Array.isArray(response.content)) return false;
  return response.content.every(
    (block) =>
      (block.type === "text" && typeof block.text === "string") ||
      (block.type === "tool_use" && typeof block.name === "string" && block.input !== null),
  );
}

export async function runAgent(
  spec: AgentSpec,
  envelope: Envelope,
  briefing: string,
): Promise<AgentRun> {
  const messages: Message[] = [{ role: "user", content: [{ type: "text", text: briefing }] }];

  const run: AgentRun = {
    agent: spec.name,
    text: "",
    entries: [],
    signals: [],
    results: [],
    refunds: [],
    denials: [],
    disclosedAmountsMinor: [],
  };

  const said: string[] = [];

  for (let turn = 0; turn < spec.maxTurns; turn += 1) {
    const response = await modelClient().createMessage({
      model: "mock-claude-support-1",
      system: spec.system,
      messages,
      ...(spec.tools.length ? { tools: spec.tools } : {}),
      max_tokens: MAX_TOKENS,
    });

    if (!wellFormed(response)) {
      run.error = "model_protocol_error";
      run.entries.push({
        label: `${spec.name} agent`,
        status: "blocked",
        detail: "The model returned blocks this system cannot read. The pipeline stopped here.",
        payload: { stop_reason: response.stop_reason },
      });
      break;
    }

    said.push(...response.content.filter(isText).map((b) => b.text));
    messages.push({ role: "assistant", content: response.content });

    const calls = response.content.filter(isToolUse);
    if (calls.length === 0) break;

    const resultBlocks: Message["content"] = [];

    for (const call of calls) {
      const proposal: ToolCall = { id: call.id, name: call.name, input: call.input };
      const outcome = execute(spec.name, proposal, envelope);

      run.entries.push(...outcome.entries);
      run.signals.push(...outcome.signals);
      run.results.push(outcome.result);
      run.disclosedAmountsMinor.push(...outcome.disclosedAmountsMinor);
      if (outcome.refund) run.refunds.push(outcome.refund);
      if (outcome.status === "deny" && outcome.code) {
        run.denials.push({ code: outcome.code, message: CUSTOMER_WORDING[outcome.code] });
      }

      resultBlocks.push({
        type: "tool_result",
        tool_use_id: call.id,
        content: JSON.stringify(outcome.result),
        ...(outcome.status === "deny" ? { is_error: true } : {}),
      });
    }

    messages.push({ role: "user", content: resultBlocks });

    /**
     * The last permitted turn has just spent its budget on tool calls, so the
     * model never gets to say anything about the results. Better to record
     * that than to quietly return an empty answer.
     */
    if (turn === spec.maxTurns - 1) {
      run.entries.push({
        label: `${spec.name} agent`,
        status: "info",
        detail: `Turn budget of ${spec.maxTurns} reached with tool results outstanding.`,
      });
    }
  }

  run.text = said.join("\n").trim();
  return run;
}
