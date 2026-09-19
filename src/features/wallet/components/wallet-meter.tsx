"use client";

import { eur } from "@/shared";
import { STARTING_BALANCE, useWallet } from "../model/wallet-context";

/**
 * The wallet is the most consequential number on the shop screen, so it gets a
 * real meter rather than a badge. The block is width-locked so the bar always
 * sits directly under the figure it describes.
 */
export function WalletMeter() {
  const { balance, cartCount } = useWallet();
  const spent = STARTING_BALANCE - balance;
  const pct = Math.max(0, Math.min(100, (balance / STARTING_BALANCE) * 100));

  return (
    <div className="order-last ml-auto w-44 sm:order-none">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[13px] text-muted">Wallet</span>
        <span className="font-mono text-base font-semibold tabular-nums">{eur(balance)}</span>
      </div>
      <div
        className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-line"
        role="meter"
        aria-valuenow={balance}
        aria-valuemin={0}
        aria-valuemax={STARTING_BALANCE}
        aria-label="Wallet balance"
      >
        <div
          className="h-full rounded-full bg-coral transition-[width] duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mt-1.5 text-right text-[11px] text-muted">
        {cartCount > 0 ? (
          <a href="#basket" className="font-medium text-coral-deep hover:underline">
            {cartCount} in basket
          </a>
        ) : spent > 0 ? (
          `${eur(spent)} spent`
        ) : (
          `Started at ${eur(STARTING_BALANCE)}`
        )}
      </p>
    </div>
  );
}
