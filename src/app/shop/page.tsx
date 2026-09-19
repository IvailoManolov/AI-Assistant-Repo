"use client";

import Link from "next/link";
import { LogOut, RotateCcw } from "lucide-react";
import { RoleGuard } from "@/components/role-guard";
import { CatalogGrid } from "@/components/catalog-grid";
import { Basket } from "@/components/basket";
import { ChatDock } from "@/components/chat-dock";
import { ShopProvider, useShop, STARTING_BALANCE } from "@/lib/shop-context";
import { useAuth } from "@/lib/auth-context";
import { eur } from "@/lib/catalog";

function Header() {
  const { session, signOut } = useAuth();
  const { balance, cartCount, reset } = useShop();
  const spent = STARTING_BALANCE - balance;
  const pct = Math.max(0, Math.min(100, (balance / STARTING_BALANCE) * 100));

  return (
    <header className="bg-cream/85 sticky top-0 z-30 border-b border-line backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-5 gap-y-3 px-5 py-3.5 sm:px-8">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="size-3 rounded-full bg-coral" aria-hidden />
          <span className="font-display text-lg font-bold">Kiln</span>
        </Link>

        <span className="hidden text-[13px] text-muted sm:inline">
          {session?.displayName}
        </span>

        {/* The wallet is the most consequential number on this screen, so it
            gets a real gauge rather than a badge. The block is width-locked so
            the meter always sits directly under the figure it describes. */}
        <div className="order-last ml-auto w-44 sm:order-none">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-[13px] text-muted">Wallet</span>
            <span className="font-mono text-base font-semibold tabular-nums">
              {eur(balance)}
            </span>
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

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={reset}
            className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-medium text-ink-soft ring-1 ring-line transition-colors hover:bg-paper"
          >
            <RotateCcw className="size-3.5" strokeWidth={2.2} />
            Reset
          </button>
          <button
            type="button"
            onClick={signOut}
            className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-medium text-ink-soft transition-colors hover:text-coral"
          >
            <LogOut className="size-3.5" strokeWidth={2.2} />
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}

function ShopBody() {
  return (
    <div className="bg-grain min-h-dvh">
      <Header />
      <main className="mx-auto max-w-7xl px-5 py-8 sm:px-8">
        <div className="mb-7 max-w-[46ch]">
          <h1 className="font-display text-3xl font-bold">The catalog</h1>
          <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">
            Everything is priced in euro and charged against your wallet. A few
            things cost more than you have, which is the point.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_19rem] lg:items-start">
          <CatalogGrid />
          <div className="lg:sticky lg:top-28">
            <Basket />
          </div>
        </div>
      </main>
      <ChatDock />
    </div>
  );
}

export default function ShopPage() {
  return (
    <RoleGuard role="user">
      <ShopProvider>
        <ShopBody />
      </ShopProvider>
    </RoleGuard>
  );
}
