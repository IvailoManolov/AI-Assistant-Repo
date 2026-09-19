"use client";

import { useState } from "react";
import {
  Ban,
  Brain,
  ChevronRight,
  CircleCheck,
  CircleSlash,
  Flag,
  PauseCircle,
  Shield,
  Target,
  Wrench,
} from "lucide-react";
import type { DecisionNode, DecisionStatus, NodeKind } from "@/lib/sessions";
import { STATUS_LABEL } from "@/lib/sessions";

/** Colour is reserved for status. Kind is carried by the icon alone. */
const STATUS_STYLE: Record<DecisionStatus, { dot: string; text: string; ring: string }> = {
  ok: { dot: "bg-green", text: "text-green", ring: "ring-green/30" },
  hold: { dot: "bg-amber", text: "text-amber", ring: "ring-amber/35" },
  blocked: { dot: "bg-danger", text: "text-danger", ring: "ring-danger/35" },
  skipped: { dot: "bg-console-muted", text: "text-console-muted", ring: "ring-console-line" },
  info: { dot: "bg-console-muted", text: "text-console-muted", ring: "ring-console-line" },
};

const KIND_ICON: Record<NodeKind, typeof Target> = {
  intent: Target,
  model: Brain,
  tool: Wrench,
  policy: Shield,
  outcome: Flag,
};

const STATUS_ICON: Record<DecisionStatus, typeof CircleCheck> = {
  ok: CircleCheck,
  hold: PauseCircle,
  blocked: Ban,
  skipped: CircleSlash,
  info: CircleCheck,
};

function Payload({ data }: { data: Record<string, unknown> }) {
  return (
    <pre className="console-scroll bg-console mt-2 max-w-full overflow-x-auto rounded-md px-3 py-2.5 font-mono text-[11px] leading-relaxed text-console-muted ring-1 ring-console-line">
      {JSON.stringify(data, null, 2)}
    </pre>
  );
}

function Node({
  node,
  index,
  depth,
  animate,
}: {
  node: DecisionNode;
  index: number;
  depth: number;
  animate: boolean;
}) {
  const [open, setOpen] = useState(false);
  const style = STATUS_STYLE[node.status];
  const KindIcon = KIND_ICON[node.kind];
  const StatusIcon = STATUS_ICON[node.status];
  const hasPayload = Boolean(node.payload);
  const muted = node.status === "skipped";

  return (
    <li
      className={animate ? "node-in" : undefined}
      style={animate ? { animationDelay: `${index * 70}ms` } : undefined}
    >
      <div className="relative flex gap-3">
        {/* The spine: steps run in order, so the rail is load-bearing here.
            It runs the full height of the row behind the marker, which is the
            only way it stays unbroken between steps. */}
        <span
          className="absolute top-0 bottom-0 left-3 w-px bg-console-line last-rail-hide"
          aria-hidden
        />
        <span
          className={`relative z-10 mt-1.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-console-raised ring-1 ${style.ring}`}
        >
          <KindIcon className={`size-3 ${muted ? "text-console-muted" : style.text}`} strokeWidth={2.2} />
        </span>

        <div className="min-w-0 grow pb-4">
          <button
            type="button"
            onClick={() => hasPayload && setOpen((o) => !o)}
            aria-expanded={hasPayload ? open : undefined}
            disabled={!hasPayload}
            className={`group block w-full text-left ${hasPayload ? "cursor-pointer" : "cursor-default"}`}
          >
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <span className="font-mono text-[11px] text-console-muted tabular-nums">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span
                className={`text-sm font-semibold ${muted ? "text-console-muted" : "text-console-text"}`}
              >
                {node.label}
              </span>
              <span className={`inline-flex items-center gap-1 text-[11px] font-medium ${style.text}`}>
                <StatusIcon className="size-3" strokeWidth={2.4} />
                {STATUS_LABEL[node.status]}
              </span>
              <span className="ml-auto font-mono text-[11px] text-console-muted tabular-nums">
                {node.ms >= 1000 ? `${(node.ms / 1000).toFixed(1)}s` : `${node.ms}ms`}
              </span>
            </div>
            <p className="mt-0.5 pr-2 text-[13px] leading-snug text-console-muted">
              {node.detail}
            </p>
            {hasPayload && (
              <span className="mt-1 inline-flex items-center gap-1 text-[11px] text-console-muted transition-colors group-hover:text-coral group-focus-visible:text-coral">
                <ChevronRight
                  className={`size-3 transition-transform ${open ? "rotate-90" : ""}`}
                  strokeWidth={2.4}
                />
                <span
                  className={`transition-opacity ${
                    open ? "opacity-100" : "opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100"
                  }`}
                >
                  {open ? "Hide payload" : "Show payload"}
                </span>
              </span>
            )}
          </button>

          {open && node.payload && <Payload data={node.payload} />}

          {node.children && node.children.length > 0 && (
            <ul className="mt-3 border-l border-console-line pl-4">
              {node.children.map((child, i) => (
                <Node key={child.id} node={child} index={i} depth={depth + 1} animate={false} />
              ))}
            </ul>
          )}
        </div>
      </div>
    </li>
  );
}

export function DecisionTree({
  nodes,
  animate = true,
}: {
  nodes: DecisionNode[];
  animate?: boolean;
}) {
  return (
    <ul className="[&>li:last-child>div>.last-rail-hide]:hidden">
      {nodes.map((node, i) => (
        <Node key={node.id} node={node} index={i} depth={0} animate={animate} />
      ))}
    </ul>
  );
}
