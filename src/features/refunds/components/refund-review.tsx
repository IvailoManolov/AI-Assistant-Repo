"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { eur } from "@/shared";

import { REASON_LABEL, SIGNAL_LABEL, type OperatorRefund } from "../model/types";

type Phase = "deciding" | "working" | "done" | "failed";

const PANEL =
  "transition-[opacity,translate,scale] duration-200 ease-[cubic-bezier(0.4,0,0.2,1)] motion-reduce:transition-none";

/**
 * The refund, and the decision.
 *
 * This is the one screen in the product where a person commits to something,
 * so it is built to be read before it is clicked: the amount first, then what
 * it is for, then everything the kernel noticed and deliberately did not act
 * on. The signals are the reason this surface exists at all. A system that
 * could decide them itself would not need an operator.
 *
 * It says plainly that approving moves no money. That is true here and it
 * would be a lie to imply otherwise, and an approval screen that overstates
 * what it does is the worst place in a system to be imprecise.
 */
export function RefundReview({
  refund,
  operatorId,
  open,
  onClose,
  onDecided,
}: {
  refund: OperatorRefund | null;
  operatorId: string;
  open: boolean;
  onClose: () => void;
  onDecided: () => void;
}) {
  const [phase, setPhase] = useState<Phase>("deciding");
  const [outcome, setOutcome] = useState<string | null>(null);
  const panel = useRef<HTMLDivElement>(null);

  /**
   * Closing is what resets the panel, not opening it.
   *
   * The same thing either way, and it happens in an event rather than in an
   * effect, so there is no render where the previous decision's outcome is
   * still on screen under a fresh refund.
   */
  const close = useCallback(() => {
    setPhase("deciding");
    setOutcome(null);
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    panel.current?.focus();

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  async function decide(decision: "approve" | "reject") {
    if (!refund) return;
    setPhase("working");
    try {
      const response = await fetch(`/api/refunds/${refund.id}/decision`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ decision, operatorId }),
      });
      const body = (await response.json()) as { error?: string; message?: string };

      if (!response.ok) {
        setOutcome(body.message ?? "That did not go through. Nothing was changed.");
        setPhase("failed");
        return;
      }

      setOutcome(
        decision === "approve"
          ? `Approved. ${eur(refund.amountMinor / 100)} is marked settled on ${refund.orderId}, and the session is closed.`
          : `Rejected. Nothing was paid, and the session is closed.`,
      );
      setPhase("done");
      onDecided();
    } catch {
      setOutcome("That did not go through. Nothing was changed.");
      setPhase("failed");
    }
  }

  const held = refund?.state === "held";

  return (
    <div
      className={`fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center ${
        open ? "" : "pointer-events-none"
      }`}
      aria-hidden={!open}
    >
      <button
        type="button"
        tabIndex={-1}
        aria-label="Close"
        onClick={close}
        className={`bg-ink/25 absolute inset-0 backdrop-blur-[1px] transition-opacity duration-200 motion-reduce:transition-none ${
          open ? "opacity-100" : "opacity-0"
        }`}
      />

      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={refund ? `Refund ${refund.id}` : "Refund"}
        tabIndex={-1}
        inert={!open}
        className={`bg-paper relative w-full max-w-lg rounded-2xl p-5 shadow-lift ring-1 ring-line outline-none sm:p-6 ${PANEL} ${
          open ? "translate-y-0 scale-100 opacity-100" : "translate-y-3 scale-95 opacity-0"
        }`}
      >
        {refund && (
          <>
            <p className="font-mono text-[11.5px] text-muted">{refund.id}</p>
            <p className="mt-1 font-display text-[28px] leading-none text-ink tabular-nums">
              {eur(refund.amountMinor / 100)}
            </p>
            <p className="mt-2 text-[13px] leading-relaxed text-ink-soft">
              {refund.quantity} x {refund.itemName} on order{" "}
              <span className="font-mono">{refund.orderId}</span>, for{" "}
              <span className="font-mono">{refund.customerId}</span>.{" "}
              {REASON_LABEL[refund.reasonCode] ?? refund.reasonCode}.
            </p>

            {refund.signals.length > 0 && (
              <ul className="mt-4 space-y-2 border-t border-line pt-4">
                {refund.signals.map((signal, index) => (
                  <li key={`${signal.code}-${index}`} className="flex gap-2.5 text-[12.5px]">
                    <span
                      className="bg-amber-signal mt-[6px] size-1.5 shrink-0 rounded-full"
                      aria-hidden
                    />
                    <span>
                      <span className="text-ink">
                        {SIGNAL_LABEL[signal.code] ?? signal.code.replace(/_/g, " ")}
                      </span>{" "}
                      <span className="text-muted">{signal.detail}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}

            <p className="mt-4 border-t border-line pt-4 text-[11.5px] leading-relaxed text-muted">
              Robby put his confidence at {refund.modelCertainty}%. That figure is
              advisory: no rule reads it, and it did not change what you are being shown.
              Approving marks the refund settled and records who did it. It moves no money,
              because settlement is out of scope here.
            </p>

            {outcome && (
              <p
                role="status"
                className={`mt-4 rounded-lg px-3 py-2.5 text-[12.5px] leading-snug ${
                  phase === "failed" ? "bg-danger-soft text-danger" : "bg-green-soft text-green"
                }`}
              >
                {outcome}
              </p>
            )}

            <div className="mt-5 flex flex-wrap items-center gap-2">
              {held && phase !== "done" ? (
                <>
                  <button
                    type="button"
                    disabled={phase === "working"}
                    onClick={() => void decide("approve")}
                    className="bg-green rounded-full px-4 py-2 text-[13px] font-semibold text-cream transition-opacity hover:opacity-90 disabled:opacity-50"
                  >
                    {phase === "working" ? "Working" : "Approve refund"}
                  </button>
                  <button
                    type="button"
                    disabled={phase === "working"}
                    onClick={() => void decide("reject")}
                    className="rounded-full px-4 py-2 text-[13px] font-medium text-danger transition-colors hover:bg-danger-soft disabled:opacity-50"
                  >
                    Reject
                  </button>
                  <button
                    type="button"
                    onClick={close}
                    className="ml-auto rounded-full px-3 py-2 text-[13px] font-medium text-muted transition-colors hover:text-ink"
                  >
                    Not now
                  </button>
                </>
              ) : (
                <>
                  {!held && !outcome && (
                    <p className="text-[12.5px] text-muted">
                      Already {refund.state}
                      {refund.decidedBy ? `, by ${refund.decidedBy}` : ""}.
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={close}
                    className="bg-cream-deep ml-auto rounded-full px-4 py-2 text-[13px] font-medium text-ink transition-opacity hover:opacity-80"
                  >
                    Close
                  </button>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
