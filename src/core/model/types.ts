/**
 * The model boundary, shaped like the Anthropic Messages API.
 *
 * This is the real protocol rather than a simplification of it, because the
 * kernel's entire job happens between a tool_use block arriving and a handler
 * running. A boundary that flattened tool calls into return values would hide
 * the one seam this system is about.
 *
 * Swapping the mock for `new Anthropic().messages.create` is a change of one
 * binding at the composition root. Nothing above this file knows which is in
 * use.
 */
export type TextBlock = { type: "text"; text: string };

export type ToolUseBlock = {
  type: "tool_use";
  id: string;
  name: string;
  input: Record<string, unknown>;
};

export type ToolResultBlock = {
  type: "tool_result";
  tool_use_id: string;
  content: string;
  is_error?: boolean;
};

export type ContentBlock = TextBlock | ToolUseBlock | ToolResultBlock;

export type Message = {
  role: "user" | "assistant";
  content: ContentBlock[];
};

export type ToolSpec = {
  name: string;
  description: string;
  input_schema: {
    type: "object";
    properties: Record<string, unknown>;
    required: string[];
  };
};

export type MessageRequest = {
  model: string;
  system: string;
  messages: Message[];
  tools?: ToolSpec[];
  max_tokens: number;
};

export type StopReason = "end_turn" | "tool_use" | "max_tokens";

export type MessageResponse = {
  id: string;
  role: "assistant";
  model: string;
  content: (TextBlock | ToolUseBlock)[];
  stop_reason: StopReason;
  usage: { input_tokens: number; output_tokens: number };
};

export interface ModelClient {
  createMessage(request: MessageRequest): Promise<MessageResponse>;
}

export const isToolUse = (block: ContentBlock): block is ToolUseBlock => block.type === "tool_use";
export const isText = (block: ContentBlock): block is TextBlock => block.type === "text";

/** The last thing the user said, with tool results ignored. */
export function lastUserText(messages: readonly Message[]): string {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    if (message.role !== "user") continue;
    const text = message.content.filter(isText).map((b) => b.text).join("\n");
    if (text.trim()) return text;
  }
  return "";
}

/** Every tool result in the conversation so far, parsed. */
export function toolResults(messages: readonly Message[]): unknown[] {
  const results: unknown[] = [];
  for (const message of messages) {
    for (const block of message.content) {
      if (block.type !== "tool_result") continue;
      try {
        results.push(JSON.parse(block.content));
      } catch {
        results.push({ unparsed: block.content });
      }
    }
  }
  return results;
}
