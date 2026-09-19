"use client";

import { useState } from "react";
import { LogOut, RotateCcw } from "lucide-react";
import { BrandMark } from "@/shared";
import { RoleGuard, useAuth } from "@/features/auth";
import { CatalogGrid } from "@/features/catalog";
import { CustomerOrders } from "@/features/orders";
import { Basket, WalletMeter, WalletProvider, useWallet } from "@/features/wallet";
import { ChatDock } from "@/features/assistant";

/**
 * Two things a shopper does: buy, and check on what they bought.
 *
 * A tab rather than a second page, because the wallet and the chat dock have
 * to survive the switch. Losing a half-filled basket to look up a reference
 * would be the kind of thing that stops anyone testing the assistant properly.
 */
type Tab = "catalog" | "orders";

const TABS: { key: Tab; label: string }[] = [
  { key: "catalog", label: "Catalog" },
  { key: "orders", label: "Your orders" },
];

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

function TabBar({ tab, onChange }: { tab: Tab; onChange: (t: Tab) => void }) {
  return (
    <div
      role="tablist"
      aria-label="Shop view"
      className="bg-cream-deep flex w-fit items-center gap-0.5 rounded-full p-0.5"
    >
      {TABS.map((t) => (
        <button
          key={t.key}
          type="button"
          role="tab"
          aria-selected={tab === t.key}
          onClick={() => onChange(t.key)}
          className={`rounded-full px-4 py-1.5 text-[13px] font-medium transition-colors ${
            tab === t.key ? "bg-paper text-ink shadow-sm" : "text-muted hover:text-ink"
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

function ShopScreen({ customerId }: { customerId: string | null }) {
  const [tab, setTab] = useState<Tab>("catalog");

  return (
    <div className="bg-grain min-h-dvh">
      <ShopHeader />
      {/* The orders list is one column, so the page narrows with it rather
          than leaving a field of empty paper beside it. */}
      <main
        className={`mx-auto px-5 py-8 sm:px-8 ${tab === "catalog" ? "max-w-7xl" : "max-w-4xl"}`}
      >
        <div className="mb-7 flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
          <div className="max-w-[46ch]">
            <h1 className="font-display text-3xl font-bold">
              {tab === "catalog" ? "The catalog" : "Your orders"}
            </h1>
            <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">
              {tab === "catalog"
                ? "Everything is priced in euro and charged against your wallet. A few things cost more than you have, which is the point."
                : "Every order on your account, newest first. Open one to see what it held and what it cost, then ask Robby about it by reference."}
            </p>
          </div>
          <TabBar tab={tab} onChange={setTab} />
        </div>

        {tab === "catalog" ? (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_19rem] lg:items-start">
            <CatalogGrid />
            <div className="lg:sticky lg:top-28">
              <Basket />
            </div>
          </div>
        ) : (
          <div className="pane-in">
            {customerId ? (
              <CustomerOrders customerId={customerId} />
            ) : (
              <p className="text-[14px] text-muted">
                Sign in as a customer to see orders on an account.
              </p>
            )}
          </div>
        )}
      </main>
      <ChatDock />
    </div>
  );
}

/**
 * The wallet needs to know whose account it is buying for, because an order is
 * placed on the server against a real customer id. It comes from the signed-in
 * session, which is the same place the chat takes it from, so a purchase and a
 * question about that purchase are unambiguously the same person.
 */
function Shop() {
  const { session } = useAuth();
  const customerId = session?.customerId ?? null;
  return (
    <WalletProvider customerId={customerId}>
      <ShopScreen customerId={customerId} />
    </WalletProvider>
  );
}

export default function ShopPage() {
  return (
    <RoleGuard role="user">
      <Shop />
    </RoleGuard>
  );
}
