import type { ChatMessage } from "../model/types";

/**
 * STATIC FIXTURE. The opening exchange stands in for a real run so the chat
 * can be judged before the runtime exists. Replace this export, not the
 * component, when the assistant is wired up.
 */
export const OPENING_EXCHANGE: ChatMessage[] = [
  {
    id: "m1",
    role: "assistant",
    text: "Hello Anna. I can look up your orders, sort out refunds, or buy things from your wallet. You have €50.00 to spend.",
  },
  { id: "m2", role: "customer", text: "Where is order ORD-100?" },
  {
    id: "m3",
    role: "assistant",
    text: "ORD-100 is in transit with DHL under DHL-ORD100-TEST. It cleared the Leipzig hub this morning and is due Thursday. That is the Ceramic Dinner Set, €64.80.",
  },
];

/**
 * Anything typed is echoed and answered with this rather than a fabricated
 * model reply, so the view never pretends to be connected.
 */
export const PLACEHOLDER_REPLY =
  "The assistant runtime is not connected yet, so I cannot answer that. This session is still recorded, and the operator console shows how the reply would be built.";
