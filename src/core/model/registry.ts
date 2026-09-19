/**
 * Which model client is installed.
 *
 * Swapping the mock for the real thing is one call at the composition root:
 *
 *     setModelClient({
 *       createMessage: (req) => anthropic.messages.create(req),
 *     });
 *
 * Nothing above this module changes, because nothing above it knows which
 * client is installed.
 */
import { mockModelClient } from "./mock/client.ts";
import type { ModelClient } from "./types.ts";

let active: ModelClient = mockModelClient;

export const setModelClient = (client: ModelClient) => {
  active = client;
};

export const modelClient = (): ModelClient => active;
