"use client";

import { useEffect, useRef, useState } from "react";

import { RobbyAvatar } from "@/shared";

import { EXAMPLE_MESSAGE, STAGES } from "../data/pipeline";

/**
 * One message, walked through the system as you scroll.
 *
 * The page's only sustained motion, and it is doing a job: the left panel
 * holds still and shows what is known so far, while the stages pass on the
 * right and the spine fills behind them. Reading downwards is the order the
 * work actually happens in, so the scroll position is the explanation.
 *
 * A stage becomes current when it crosses the middle of the window. Nothing
 * animates out again, and the last stage stays current at the bottom, so the
 * panel never blanks.
 */
export function PipelineScroll() {
  const [active, setActive] = useState(0);
  const items = useRef<(HTMLLIElement | null)[]>([]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const at = items.current.findIndex((node) => node === entry.target);
          if (at >= 0) setActive(at);
        }
      },
      /** A band across the middle of the window, one stage deep. */
      { rootMargin: "-45% 0px -45% 0px", threshold: 0 },
    );

    for (const node of items.current) if (node) observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const stage = STAGES[active];
  const filled = ((active + 1) / STAGES.length) * 100;

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1fr)] lg:gap-16">
      {/* What is known so far. Holds still while the stages go past. */}
      <div className="lg:sticky lg:top-24 lg:self-start">
        <p className="text-[13px] font-semibold text-coral-deep">The message</p>

        <div className="bg-paper mt-3 rounded-2xl p-5 shadow-soft ring-1 ring-line">
          <div className="flex items-start gap-3">
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-cream-deep font-display text-[12px] font-bold text-ink-soft">
              AP
            </span>
            <p className="text-[14px] leading-relaxed">{EXAMPLE_MESSAGE}</p>
          </div>

          <div className="mt-5 border-t border-line pt-4">
            <div className="flex items-center gap-2">
              <RobbyAvatar size={22} />
              <p className="text-[12px] font-medium text-muted">
                After step {active + 1}, {stage.title.toLowerCase()}
              </p>
            </div>

            <dl key={stage.key} className="pane-in mt-3 grid gap-1.5">
              {stage.readout.map((line) => (
                <div
                  key={line.label}
                  className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 border-b border-line/70 pb-1.5 last:border-0"
                >
                  <dt className="font-mono text-[11.5px] text-muted">{line.label}</dt>
                  <dd className="text-[13px]">{line.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>

        <p className="mt-4 max-w-[38ch] text-[13px] leading-relaxed text-muted">
          Read top to bottom, this is a real run. The operator console shows the same five steps
          for any conversation that has happened.
        </p>
      </div>

      {/* The stages, with the spine filling behind them. */}
      <ol className="relative pl-9">
        <div aria-hidden className="absolute top-2 bottom-2 left-[11px] w-px bg-line">
          <div className="spine-fill w-px bg-coral" style={{ height: `${filled}%` }} />
        </div>

        {STAGES.map((item, at) => (
          <li
            key={item.key}
            ref={(node) => {
              items.current[at] = node;
            }}
            className={`stage relative pb-12 last:pb-0 ${at <= active ? "is-active" : ""}`}
          >
            <span
              aria-hidden
              className={`absolute top-1.5 -left-9 grid size-[23px] place-items-center rounded-full font-mono text-[10px] transition-colors duration-300 ${
                at <= active ? "bg-coral text-white" : "bg-cream-deep text-muted ring-1 ring-line"
              }`}
            >
              {at + 1}
            </span>

            <h3 className="font-display text-[19px] leading-tight font-bold">{item.title}</h3>
            <p className="mt-1 font-mono text-[11.5px] text-coral-deep">{item.holds}</p>
            <p className="mt-2.5 max-w-[52ch] text-[14.5px] leading-relaxed text-ink-soft">
              {item.body}
            </p>
            <p className="mt-2 max-w-[52ch] text-[13.5px] leading-relaxed text-muted">
              {item.cannot}
            </p>
          </li>
        ))}
      </ol>
    </div>
  );
}
