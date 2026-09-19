"use client";

import type { AgentSession } from "../model/types";

export function Transcript({ session }: { session: AgentSession }) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 px-4 pt-4 pb-3 sm:px-5">
        <h2 className="text-[13px] font-semibold">Transcript</h2>
        <p className="mt-0.5 text-[11px] text-muted">
          {session.customer}, signed in as <span className="font-mono">{session.customerId}</span>
        </p>
      </div>
      <ol className="thin-scroll pane-in min-h-0 grow space-y-3 overflow-y-auto px-4 pb-4 sm:px-5">
        {session.turns.map((turn) => {
          if (turn.role === "system") {
            return (
              <li
                key={turn.id}
                className="rounded-md border border-dashed border-sunk-line px-3 py-2 font-mono text-[11.5px] leading-relaxed text-muted"
              >
                {turn.text}
              </li>
            );
          }
          const isCustomer = turn.role === "customer";
          return (
            <li
              key={turn.id}
              className={`max-w-[92%] rounded-xl px-3.5 py-2.5 text-[13px] leading-relaxed ${
                isCustomer
                  ? "ml-auto bg-cream-deep text-ink"
                  : "bg-paper border-l-2 border-coral text-ink ring-1 ring-line"
              }`}
            >
              <span className="mb-1 flex items-baseline gap-2">
                <span className="text-[11px] font-semibold text-muted">
                  {isCustomer ? session.customer : "Robby"}
                </span>
                <span className="font-mono text-[10.5px] text-muted tabular-nums">{turn.at}</span>
              </span>
              {turn.text}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
