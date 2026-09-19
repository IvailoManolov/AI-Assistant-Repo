"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

/**
 * A small dropdown menu.
 *
 * Opens and closes on the same curve as the chat dock, so the two moving
 * surfaces in the product feel like one product. The panel stays mounted and
 * inert while closed, which is what lets it animate out rather than vanish.
 */
export function Menu({
  label,
  children,
  onClose,
}: {
  label: string;
  /** Receives a closer, so an item can act and dismiss in one go. */
  children: (close: () => void) => React.ReactNode;
  onClose?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    onClose?.();
  }, [onClose]);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) close();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        close();
        triggerRef.current?.focus();
      }
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, close]);

  function toggle() {
    if (open) {
      close();
      return;
    }
    setOpen(true);
    requestAnimationFrame(() => {
      panelRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    });
  }

  /** Arrow keys walk the items, which is what a menu is expected to do. */
  function onPanelKeyDown(event: React.KeyboardEvent) {
    const items = [...(panelRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])];
    if (items.length === 0) return;

    const current = items.indexOf(document.activeElement as HTMLElement);
    const focus = (index: number) => {
      event.preventDefault();
      items[(index + items.length) % items.length].focus();
    };

    if (event.key === "ArrowDown") focus(current + 1);
    if (event.key === "ArrowUp") focus(current - 1);
    if (event.key === "Home") focus(0);
    if (event.key === "End") focus(items.length - 1);
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={toggle}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-medium text-ink-soft ring-1 ring-line transition-colors hover:bg-cream"
      >
        {label}
        <ChevronDown
          className={`size-3.5 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          strokeWidth={2.2}
        />
      </button>

      <div
        ref={panelRef}
        role="menu"
        inert={!open}
        aria-hidden={!open}
        onKeyDown={onPanelKeyDown}
        className={`bg-paper absolute top-full right-0 z-50 mt-2 w-64 origin-top-right overflow-hidden rounded-xl py-1 shadow-lift ring-1 ring-line transition-[opacity,translate,scale] duration-200 ease-[cubic-bezier(0.4,0,0.2,1)] motion-reduce:transition-none ${
          open
            ? "translate-y-0 scale-100 opacity-100"
            : "pointer-events-none -translate-y-1 scale-95 opacity-0"
        }`}
      >
        {children(close)}
      </div>
    </div>
  );
}

export function MenuItem({
  onClick,
  children,
  tone = "default",
}: {
  onClick: () => void;
  children: React.ReactNode;
  tone?: "default" | "danger";
}) {
  return (
    <button
      role="menuitem"
      type="button"
      onClick={onClick}
      className={`block w-full px-3 py-2 text-left text-[13px] transition-colors ${
        tone === "danger" ? "text-danger hover:bg-danger-soft" : "text-ink hover:bg-cream-deep"
      }`}
    >
      {children}
    </button>
  );
}
