"use client";

import { useMemo, useState } from "react";
import type { LogLine } from "@/lib/sessions";

const LEVEL_STYLE: Record<LogLine["level"], string> = {
  debug: "text-console-muted",
  info: "text-console-text",
  warn: "text-amber",
  error: "text-danger",
};

const LEVELS: LogLine["level"][] = ["debug", "info", "warn", "error"];

export function LogView({ logs }: { logs: LogLine[] }) {
  const [min, setMin] = useState<LogLine["level"]>("debug");

  const shown = useMemo(() => {
    const floor = LEVELS.indexOf(min);
    return logs.filter((l) => LEVELS.indexOf(l.level) >= floor);
  }, [logs, min]);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        {LEVELS.map((l) => (
          <button
            key={l}
            type="button"
            onClick={() => setMin(l)}
            aria-pressed={min === l}
            className={`rounded-md px-2.5 py-1 font-mono text-[11px] transition-colors ${
              min === l
                ? "bg-console-raised text-console-text ring-1 ring-console-line"
                : "text-console-muted hover:text-console-text"
            }`}
          >
            {l}
          </button>
        ))}
        <span className="ml-auto font-mono text-[11px] text-console-muted tabular-nums">
          {shown.length}/{logs.length} lines
        </span>
      </div>

      {/* Log lines are machine output, so they stay flush, unrounded and
          monospaced. Horizontal scroll rather than wrapping keeps columns. */}
      <div className="console-scroll overflow-x-auto rounded-md ring-1 ring-console-line">
        <table className="w-full min-w-[42rem] border-collapse font-mono text-[11.5px]">
          <tbody>
            {shown.map((l, i) => (
              <tr key={`${l.at}-${i}`} className="border-b border-console-line/60 last:border-0">
                <td className="w-28 py-1.5 pl-3 align-top whitespace-nowrap text-console-muted tabular-nums">
                  {l.at}
                </td>
                <td className={`w-16 py-1.5 align-top whitespace-nowrap ${LEVEL_STYLE[l.level]}`}>
                  {l.level}
                </td>
                <td className="w-20 py-1.5 align-top whitespace-nowrap text-coral">{l.scope}</td>
                <td className="py-1.5 pr-3 pl-2 align-top text-console-text">{l.message}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {shown.length === 0 && (
        <p className="mt-3 text-[13px] text-console-muted">
          Nothing at {min} or above in this session.
        </p>
      )}
    </div>
  );
}
