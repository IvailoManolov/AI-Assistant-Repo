"use client";

import { useMemo, useState } from "react";

import type { LogLine } from "../model/types";

const LEVEL_STYLE: Record<LogLine["level"], string> = {
  debug: "text-muted",
  info: "text-ink-soft",
  warn: "text-amber",
  error: "text-danger",
};

const LEVELS: LogLine["level"][] = ["debug", "info", "warn", "error"];

/** "warn and error", "debug, info, warn and error". */
function phrase(items: string[]) {
  if (items.length === 1) return items[0];
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

export function LogView({ logs, sessionId }: { logs: LogLine[]; sessionId: string }) {
  const [min, setMin] = useState<LogLine["level"]>("debug");

  const included = useMemo(() => LEVELS.slice(LEVELS.indexOf(min)), [min]);
  const shown = useMemo(
    () => logs.filter((l) => included.includes(l.level)),
    [logs, included],
  );

  return (
    <div className="flex h-full min-h-0 flex-col px-4 py-4 sm:px-5">
      {/* The filter is a floor, not a single level: picking warn also shows
          error. Every included level is lit so that reads without explaining
          itself, and the sentence underneath says it in words as well. */}
      <div className="shrink-0">
        <div className="flex flex-wrap items-center gap-1.5">
          {LEVELS.map((level) => {
            const isFloor = level === min;
            const isIncluded = included.includes(level);
            return (
              <button
                key={level}
                type="button"
                onClick={() => setMin(level)}
                aria-pressed={isFloor}
                className={`rounded-md px-2.5 py-1 font-mono text-[11px] transition-colors ${
                  isFloor
                    ? "bg-cream-deep text-ink ring-1 ring-coral/45"
                    : isIncluded
                      ? "bg-cream-deep/70 text-ink-soft"
                      : "text-muted hover:text-ink"
                }`}
              >
                {level}
              </button>
            );
          })}
        </div>

        <p className="mt-2 mb-3 text-[11.5px] text-muted">
          Showing {phrase(included)}. {shown.length} of {logs.length} lines in{" "}
          <span className="font-mono">{sessionId}</span>.
        </p>
      </div>

      {/* Log lines are machine output, so they stay flush, unrounded and
          monospaced. This is the only thing on this pane that scrolls. */}
      <div
        key={sessionId}
        className="thin-scroll bg-sunk pane-in min-h-0 grow overflow-auto rounded-md ring-1 ring-sunk-line"
      >
        <table className="w-full min-w-[42rem] border-collapse font-mono text-[11.5px]">
          <tbody>
            {shown.map((l, i) => (
              <tr key={`${l.at}-${i}`} className="border-b border-sunk-line/70 last:border-0">
                <td className="w-28 py-1.5 pl-3 align-top whitespace-nowrap text-muted tabular-nums">
                  {l.at}
                </td>
                <td className={`w-16 py-1.5 align-top whitespace-nowrap ${LEVEL_STYLE[l.level]}`}>
                  {l.level}
                </td>
                <td className="w-20 py-1.5 align-top whitespace-nowrap text-coral-deep">{l.scope}</td>
                <td className="py-1.5 pr-3 pl-2 align-top text-ink">{l.message}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {shown.length === 0 && (
          <p className="px-3 py-3 text-[12px] text-muted">
            Nothing at {min} or above in this session.
          </p>
        )}
      </div>
    </div>
  );
}
