import type { ChatMessage } from "../model/types";

/**
 * The greeting, shown before any session exists.
 *
 * A session opens on the customer's first message, so nothing here is part of
 * one. It stays deliberately free of order detail: inventing an answer on a
 * surface that now records real sessions would be the one lie the console
 * could not explain.
 */
export const GREETING: ChatMessage[] = [
  {
    id: "greeting",
    role: "assistant",
    text: "Hello Anna, I am Robby. Ask me about an order or a refund and I will pick it up. Sending a message opens a session that an operator can see.",
  },
];
