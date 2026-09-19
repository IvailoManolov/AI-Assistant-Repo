/**
 * Which agents exist.
 *
 * Four of them, each in its own folder next to this file:
 *
 *   triage/     reads the customer's message and says what kind it is.
 *               Holds no tools.
 *   order/      retrieves order records. Read-only tools.
 *   refund/     proposes a refund on a retrieved record. Read tools plus
 *               propose_refund. It still cannot pay one.
 *   composer/   writes the sentence the customer reads. Holds no tools.
 *
 * Each folder holds a `prompt.ts`, which is the agent itself, and a
 * `behaviour.ts`, which is how the stand-in model plays that part. They sit
 * together because they are two halves of one thing: change what an agent is
 * asked to do and you change what a model would do with it.
 *
 * The orchestrator is not an agent and is not in here. It runs them, in
 * `core/orchestrator/`, and it is the only thing that decides which of them
 * run and in what order.
 */
import type { AgentName } from "../kernel/tools.ts";
import type { AgentSpec } from "./definition.ts";
import { COMPOSER } from "./composer/prompt.ts";
import { ORDER } from "./order/prompt.ts";
import { REFUND } from "./refund/prompt.ts";
import { TRIAGE } from "./triage/prompt.ts";

export const AGENTS: Record<AgentName, AgentSpec> = {
  triage: TRIAGE,
  order: ORDER,
  refund: REFUND,
  composer: COMPOSER,
};
