"use client";

import { Tooltip } from "@/shared";
import { STATUS_STANDING, type DecisionStatus } from "../model/types";

const DOT: Record<DecisionStatus, string> = {
  ok: "bg-green-signal",
  hold: "bg-amber-signal",
  blocked: "bg-danger-signal",
  skipped: "bg-muted",
  info: "bg-muted",
};

/**
 * The coloured marker beside a session. On hover it says where that session
 * sits; the surrounding control repeats the same fact in its accessible name,
 * so nothing here is hover-only for keyboard or screen reader users.
 */
export function StatusMarker({
  status,
  align = "left",
}: {
  status: DecisionStatus;
  align?: "left" | "center";
}) {
  return (
    <Tooltip label={STATUS_STANDING[status]} align={align}>
      <span className={`size-2 shrink-0 rounded-full ${DOT[status]}`} aria-hidden />
    </Tooltip>
  );
}
