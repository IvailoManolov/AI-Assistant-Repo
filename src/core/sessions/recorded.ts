/**
 * The hand-written sessions that ship with the product.
 *
 * They are immutable seed data: four captured-looking runs that give the
 * console something to show before anyone has talked to the assistant, and
 * that the landing page borrows from.
 *
 * Read through the mock environment's loader rather than imported as JSON, so
 * that this module obeys the same import rule as the rest of core: relative,
 * with the extension, and no path alias. That is what lets `node --test` load
 * anything that reaches the session store without a bundler in front of it.
 */
import { readImmutable } from "../../mock-env/seed.ts";

import type { AgentSession } from "./types.ts";

let cached: AgentSession[] | null = null;

export const RECORDED_SESSIONS = (): AgentSession[] =>
  (cached ??= readImmutable<AgentSession>("recorded-sessions.json") as AgentSession[]);

export const recordedSession = (id: string): AgentSession => {
  const found = RECORDED_SESSIONS().find((s) => s.id === id);
  if (!found) throw new Error(`No recorded session ${id} in the immutable seed.`);
  return found;
};
