"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowUp, MessageSquare, X } from "lucide-react";

import { useAuth } from "@/features/auth";
import { NotificationBadge, RobbyAvatar, useUnread } from "@/shared";

import { GREETING } from "../data/opening-exchange";
import { ASK_ROBBY, type AskRobbyDetail } from "../model/events";
import type { ChatMessage } from "../model/types";

/** Stable identity function so the unread set survives every re-render. */
const idOf = (message: ChatMessage) => message.id;

/**
 * Opening and closing is the one motion the customer causes, so it gets a
 * real curve rather than a fade. The panel stays mounted and is made inert
 * when closed, which is what lets it animate out instead of vanishing.
 */
const PANEL_MOTION =
  "transition-[opacity,translate,scale] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] motion-reduce:transition-none";

export function ChatDock() {
  const { session } = useAuth();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(GREETING);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  /** Read from async code, which cannot see the current state value. */
  const openRef = useRef(open);

  const fromAssistant = useMemo(
    () => messages.filter((m) => m.role === "assistant"),
    [messages],
  );
  const { count: unread, markSeen, markAllSeen } = useUnread(fromAssistant, idOf);

  useEffect(() => {
    if (open) endRef.current?.scrollIntoView({ block: "end" });
  }, [messages, open]);

  /**
   * Another part of the shop wants to ask something. The panel opens with the
   * question already typed, and stops there: the customer presses send, so a
   * session in the console always corresponds to a message somebody meant.
   */
  useEffect(() => {
    function onAsk(event: Event) {
      const { text } = (event as CustomEvent<AskRobbyDetail>).detail;
      openRef.current = true;
      setOpen(true);
      setDraft(text);
      markAllSeen();
      requestAnimationFrame(() => inputRef.current?.focus());
    }

    window.addEventListener(ASK_ROBBY, onAsk);
    return () => window.removeEventListener(ASK_ROBBY, onAsk);
  }, [markAllSeen]);

  function toggle() {
    const next = !open;
    openRef.current = next;
    setOpen(next);
    if (next) {
      markAllSeen();
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }

  function append(message: ChatMessage) {
    setMessages((current) => [...current, message]);
    if (message.role === "assistant" && openRef.current) markSeen(message.id);
  }

  async function send(event: React.FormEvent) {
    event.preventDefault();
    const text = draft.trim();
    if (!text || sending) return;

    setDraft("");
    setSending(true);
    append({ id: `local-${Date.now()}`, role: "customer", text });

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          customerId: session?.customerId,
          customer: session?.displayName,
          message: text,
        }),
      });
      if (!response.ok) throw new Error(`Assistant returned ${response.status}`);

      const body = (await response.json()) as {
        sessionId: string;
        reply: { id: string; text: string };
      };
      setSessionId(body.sessionId);
      append({ id: body.reply.id, role: "assistant", text: body.reply.text });
    } catch {
      append({
        id: `failed-${Date.now()}`,
        role: "assistant",
        text: "That message did not reach Robby, so no session was opened. Send it again.",
      });
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="fixed right-4 bottom-4 z-40 flex items-center gap-2 rounded-full bg-ink px-4 py-3 text-sm font-semibold text-cream shadow-lift transition-colors hover:bg-coral-deep sm:right-6 sm:bottom-6 lg:right-auto lg:left-6"
      >
        {open ? (
          <X className="size-4" strokeWidth={2.4} />
        ) : (
          <MessageSquare className="size-4" strokeWidth={2.4} />
        )}
        {open ? "Close" : "Ask Robby"}

        {!open && (
          <NotificationBadge
            count={unread}
            tone="info"
            live
            label={`${unread} new message${unread === 1 ? "" : "s"} from Robby`}
            className="absolute -top-1.5 -right-1.5"
          />
        )}
      </button>

      <div
        inert={!open}
        aria-hidden={!open}
        className={`bg-paper fixed inset-x-3 bottom-20 z-40 flex max-h-[68dvh] origin-bottom flex-col overflow-hidden rounded-2xl shadow-lift ring-1 ring-line sm:inset-x-auto sm:right-6 sm:bottom-24 sm:w-[24rem] sm:origin-bottom-right lg:right-auto lg:left-6 lg:origin-bottom-left ${PANEL_MOTION} ${
          open
            ? "translate-y-0 scale-100 opacity-100"
            : "pointer-events-none translate-y-4 scale-95 opacity-0"
        }`}
      >
        <div className="flex items-center gap-2.5 border-b border-line px-4 py-3">
          <span
            className={`size-2 rounded-full ${sessionId ? "bg-green-signal" : "bg-muted"}`}
            aria-hidden
          />
          <span className="text-sm font-semibold">Robby</span>
          <span className="ml-auto font-mono text-[11px] text-muted">
            {sessionId ?? "no session yet"}
          </span>
        </div>

        <div className="grow space-y-3 overflow-y-auto px-4 py-4">
          {messages.map((m) =>
            m.role === "customer" ? (
              <div
                key={m.id}
                className="ml-auto max-w-[85%] rounded-xl bg-ink px-3.5 py-2.5 text-[13px] leading-relaxed text-cream"
              >
                {m.text}
              </div>
            ) : (
              /* Robby's face sits with what he said, so a long thread stays
                 attributable without a name on every bubble. */
              <div key={m.id} className="flex max-w-[92%] items-end gap-2">
                <RobbyAvatar size={26} className="mb-0.5" />
                <div className="bg-cream-deep rounded-xl rounded-bl-sm px-3.5 py-2.5 text-[13px] leading-relaxed text-ink">
                  {m.text}
                </div>
              </div>
            ),
          )}

          {sending && (
            <div className="flex items-end gap-2">
              <RobbyAvatar size={26} thinking className="mb-0.5" />
              <div className="bg-cream-deep flex w-fit items-center gap-1 rounded-xl rounded-bl-sm px-3.5 py-3">
                <span className="sr-only">Robby is working on a reply.</span>
                {[0, 0.2, 0.4].map((delay) => (
                  <span
                    key={delay}
                    aria-hidden
                    style={{ animationDelay: `${delay}s` }}
                    className="typing-dot size-1.5 rounded-full bg-muted"
                  />
                ))}
              </div>
            </div>
          )}

          <div ref={endRef} />
        </div>

        <form onSubmit={send} className="flex items-end gap-2 border-t border-line px-3 py-3">
          <label htmlFor="assistant-draft" className="sr-only">
            Message Robby
          </label>
          <input
            id="assistant-draft"
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Ask about an order, a refund, or the catalog"
            className="grow rounded-full bg-cream px-3.5 py-2 text-[13px] ring-1 ring-line placeholder:text-muted"
          />
          <button
            type="submit"
            aria-label="Send"
            disabled={sending}
            className="flex size-8 shrink-0 items-center justify-center rounded-full bg-coral text-white transition-colors hover:bg-coral-deep disabled:opacity-50"
          >
            <ArrowUp className="size-4" strokeWidth={2.6} />
          </button>
        </form>
      </div>
    </>
  );
}
