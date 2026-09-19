"use client";

import { LogOut, RotateCcw } from "lucide-react";
import { BrandMark } from "@/shared";
import { RoleGuard, useAuth } from "@/features/auth";
import { CatalogGrid } from "@/features/catalog";
import { Basket, WalletMeter, WalletProvider, useWallet } from "@/features/wallet";
import { ChatDock } from "@/features/assistant";

function ShopHeader() {
  const { session, signOut } = useAuth();
  const { reset } = useWallet();

  return (
    <header className="bg-cream/85 sticky top-0 z-30 border-b border-line backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-5 gap-y-3 px-5 py-3.5 sm:px-8">
        <BrandMark />
        <span className="hidden text-[13px] text-muted sm:inline">{session?.displayName}</span>

        <WalletMeter />

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
            className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-medium text-ink-soft transition-colors hover:text-coral-deep"
          >
            <LogOut className="size-3.5" strokeWidth={2.2} />
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}

function ShopScreen() {
  return (
    <div className="bg-grain min-h-dvh">
      <ShopHeader />
      <main className="mx-auto max-w-7xl px-5 py-8 sm:px-8">
        <div className="mb-7 max-w-[46ch]">
          <h1 className="font-display text-3xl font-bold">The catalog</h1>
          <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">
            Everything is priced in euro and charged against your wallet. A few things cost more
            than you have, which is the point.
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
      <WalletProvider>
        <ShopScreen />
      </WalletProvider>
    </RoleGuard>
  );
}
