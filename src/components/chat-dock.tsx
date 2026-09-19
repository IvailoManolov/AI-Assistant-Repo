"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUp, MessageSquare, X } from "lucide-react";

type Message = { id: string; role: "customer" | "assistant"; text: string };

/**
 * STATIC. The opening exchange is a fixture so the chat can be judged before
 * the runtime exists. Anything typed is echoed and answered with a fixed
 * placeholder rather than a fake model reply, so the view never pretends to
 * be wired up.
 */
const OPENING: Message[] = [
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

const PLACEHOLDER_REPLY =
  "The assistant runtime is not connected yet, so I cannot answer that. This session is still recorded, and the operator console shows how the reply would be built.";

export function ChatDock() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>(OPENING);
  const [draft, setDraft] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) endRef.current?.scrollIntoView({ block: "end" });
  }, [messages, open]);

  function send(e: React.FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    const stamp = Date.now();
    setMessages((m) => [
      ...m,
      { id: `c${stamp}`, role: "customer", text },
      { id: `a${stamp}`, role: "assistant", text: PLACEHOLDER_REPLY },
    ]);
    setDraft("");
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="fixed right-4 bottom-4 z-40 flex items-center gap-2 rounded-full bg-ink px-4 py-3 text-sm font-semibold text-cream shadow-lift transition-colors hover:bg-coral-deep sm:right-6 sm:bottom-6 lg:right-auto lg:left-6"
      >
        {open ? <X className="size-4" strokeWidth={2.4} /> : <MessageSquare className="size-4" strokeWidth={2.4} />}
        {open ? "Close" : "Ask the assistant"}
      </button>

      {open && (
        <div className="bg-paper fixed inset-x-3 bottom-20 z-40 flex max-h-[68dvh] flex-col overflow-hidden rounded-2xl shadow-lift ring-1 ring-line sm:inset-x-auto sm:right-6 sm:bottom-24 sm:w-[24rem] lg:right-auto lg:left-6">
          <div className="flex items-center gap-2.5 border-b border-line px-4 py-3">
            <span className="size-2 rounded-full bg-green" aria-hidden />
            <span className="text-sm font-semibold">Kiln assistant</span>
            <span className="ml-auto font-mono text-[11px] text-muted">SES-4f2a</span>
          </div>

          <div className="grow space-y-3 overflow-y-auto px-4 py-4">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`max-w-[85%] rounded-xl px-3.5 py-2.5 text-[13px] leading-relaxed ${
                  m.role === "customer"
                    ? "ml-auto bg-ink text-cream"
                    : "bg-cream-deep text-ink"
                }`}
              >
                {m.text}
              </div>
            ))}
            <div ref={endRef} />
          </div>

          <form onSubmit={send} className="flex items-end gap-2 border-t border-line px-3 py-3">
            <label htmlFor="assistant-draft" className="sr-only">
              Message the assistant
            </label>
            <input
              id="assistant-draft"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Ask about an order, a refund, or the catalog"
              className="grow rounded-full bg-cream px-3.5 py-2 text-[13px] ring-1 ring-line outline-none placeholder:text-muted focus:ring-2 focus:ring-coral"
            />
            <button
              type="submit"
              aria-label="Send"
              className="flex size-8 shrink-0 items-center justify-center rounded-full bg-coral text-white transition-colors hover:bg-coral-deep"
            >
              <ArrowUp className="size-4" strokeWidth={2.6} />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
