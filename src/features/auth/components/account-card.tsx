"use client";

import { Check } from "lucide-react";

import type { DemoAccount } from "../model/demo-accounts";

/**
 * One account, as something you pick up rather than something you type.
 *
 * The card carries the credential it will sign in with, in plain sight. That
 * is only defensible because these two logins protect nothing: they exist to
 * choose a role, and hiding a password that is printed in the README would be
 * theatre. Keeping it visible also means the manual form underneath has
 * something to be a fallback for rather than a secret.
 */
export function AccountCard({
  account,
  selected,
  onSelect,
}: {
  account: DemoAccount;
  selected: boolean;
  onSelect: () => void;
}) {
  const Icon = account.icon;

  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      tabIndex={selected ? 0 : -1}
      onClick={onSelect}
      className={`group bg-paper relative flex w-full flex-col items-start gap-4 rounded-2xl p-5 text-left transition-[box-shadow,translate,border-color] duration-200 ease-out motion-reduce:transition-none ${
        selected
          ? `shadow-lift -translate-y-0.5 ring-2 ${account.accent.ring}`
          : "shadow-soft ring-1 ring-line hover:-translate-y-0.5 hover:shadow-lift"
      }`}
    >
      {/* The tick grows in on selection: the one motion this screen has. */}
      <span
        aria-hidden
        className={`absolute top-4 right-4 flex size-6 items-center justify-center rounded-full text-white transition-[opacity,scale] duration-200 motion-reduce:transition-none ${
          selected ? "scale-100 bg-coral opacity-100" : "scale-75 bg-muted opacity-0"
        }`}
      >
        <Check className="size-3.5" strokeWidth={3} />
      </span>

      <span className="flex items-center gap-3">
        <span
          className={`grid size-11 shrink-0 place-items-center rounded-full font-display text-[15px] font-bold ${account.accent.wash} ${account.accent.ink}`}
        >
          {account.initials}
        </span>
        <span className="min-w-0">
          <span className="block font-display text-[17px] leading-tight font-bold">
            {account.displayName}
          </span>
          <span className="mt-0.5 flex items-center gap-1.5 text-[12.5px] text-muted">
            <Icon className="size-3.5" strokeWidth={2.2} />
            {account.standing}
          </span>
        </span>
      </span>

      <ul className="space-y-1 text-[13px] leading-snug text-ink-soft">
        {account.can.map((line) => (
          <li key={line} className="flex gap-2">
            <span aria-hidden className="text-muted">
              &middot;
            </span>
            {line}
          </li>
        ))}
      </ul>

      <span className="mt-auto flex w-full items-center justify-between gap-3 border-t border-line pt-3 font-mono text-[11.5px] text-muted">
        <span>{account.username}</span>
        <span>{account.password}</span>
      </span>
    </button>
  );
}
