/**
 * How the orchestrator hands an agent its context, and how the mock reads it.
 *
 * Each agent's user message is a sentence a person could have written,
 * followed by a fenced JSON block holding the structured facts. That is how
 * context is passed to a real model in practice, and it gives the mock
 * something to parse that is genuinely part of the request rather than a
 * side channel invented for it.
 */
export function fence(intro: string, briefing: unknown): string {
  return `${intro}\n\n\`\`\`json\n${JSON.stringify(briefing, null, 2)}\n\`\`\``;
}

const BLOCK = /```json\s*([\s\S]*?)```/g;

/** The last JSON block in the text, or null if there is none to read. */
export function readBriefing<T>(text: string): T | null {
  let last: string | null = null;
  for (const match of text.matchAll(BLOCK)) last = match[1];
  if (last === null) return null;
  try {
    return JSON.parse(last) as T;
  } catch {
    return null;
  }
}
