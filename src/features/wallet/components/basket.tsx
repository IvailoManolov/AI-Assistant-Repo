"use client";

import { useState } from "react";
import { Minus, Plus, Trash2 } from "lucide-react";
import { eur } from "@/shared";
import { useWallet } from "../model/wallet-context";

export function Basket() {
  const { cart, cartTotal, balance, setQuantity, remove, purchase, purchases } = useWallet();
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  const after = balance - cartTotal;
  const short = after < 0;

  function onPurchase() {
    const result = purchase();
    if (!result.ok) {
      setMessage({ tone: "error", text: result.error });
      return;
    }
    setMessage({
      tone: "ok",
      text: `Order ${result.purchase.id} placed for ${eur(result.purchase.total)}.`,
    });
  }

  return (
    <aside id="basket" className="bg-paper scroll-mt-28 rounded-xl ring-1 ring-line">
      <div className="border-b border-line px-4 py-3.5">
        <h2 className="font-display text-base font-bold">Basket</h2>
      </div>

      {cart.length === 0 ? (
        <p className="px-4 py-6 text-[13px] leading-relaxed text-muted">
          Nothing in the basket yet. Add something from the catalog, or ask the
          assistant to find it for you.
        </p>
      ) : (
        <ul className="divide-y divide-line">
          {cart.map((line) => (
            <li key={line.item.id} className="flex items-start gap-3 px-4 py-3">
              <div className="min-w-0 grow">
                <p className="truncate text-[13px] font-semibold">{line.item.name}</p>
                <p className="mt-0.5 font-mono text-[11px] text-muted tabular-nums">
                  {eur(line.item.price)} each
                </p>
                <div className="mt-2 flex items-center gap-1">
                  <button
                    type="button"
                    aria-label={`Fewer ${line.item.name}`}
                    onClick={() => setQuantity(line.item.id, line.quantity - 1)}
                    className="flex size-6 items-center justify-center rounded-md ring-1 ring-line transition-colors hover:bg-cream-deep"
                  >
                    <Minus className="size-3" strokeWidth={2.6} />
                  </button>
                  <span className="w-6 text-center font-mono text-[13px] tabular-nums">
                    {line.quantity}
                  </span>
                  <button
                    type="button"
                    aria-label={`More ${line.item.name}`}
                    onClick={() => setQuantity(line.item.id, line.quantity + 1)}
                    className="flex size-6 items-center justify-center rounded-md ring-1 ring-line transition-colors hover:bg-cream-deep"
                  >
                    <Plus className="size-3" strokeWidth={2.6} />
                  </button>
                  <button
                    type="button"
                    aria-label={`Remove ${line.item.name}`}
                    onClick={() => remove(line.item.id)}
                    className="ml-1 flex size-6 items-center justify-center rounded-md text-muted transition-colors hover:bg-danger-soft hover:text-danger"
                  >
                    <Trash2 className="size-3" strokeWidth={2.2} />
                  </button>
                </div>
              </div>
              <span className="font-mono text-[13px] font-medium tabular-nums">
                {eur(line.item.price * line.quantity)}
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="border-t border-line px-4 py-3.5">
        <dl className="grid gap-1.5 font-mono text-[13px] tabular-nums">
          <div className="flex justify-between">
            <dt className="font-sans text-muted">Basket</dt>
            <dd>{eur(cartTotal)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="font-sans text-muted">Wallet</dt>
            <dd>{eur(balance)}</dd>
          </div>
          {cart.length > 0 && (
            <div className={`flex justify-between border-t border-line pt-1.5 font-medium ${short ? "text-danger" : ""}`}>
              <dt className="font-sans">{short ? "Short by" : "Left after"}</dt>
              <dd>{eur(Math.abs(after))}</dd>
            </div>
          )}
        </dl>

        <button
          type="button"
          onClick={onPurchase}
          disabled={cart.length === 0}
          className="mt-3.5 w-full rounded-full bg-coral px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-coral-deep disabled:cursor-not-allowed disabled:bg-line disabled:text-muted"
        >
          Purchase
        </button>

        {message && (
          <p
            role="status"
            className={`mt-3 rounded-lg px-3 py-2 text-[13px] leading-snug ${
              message.tone === "ok" ? "bg-green-soft text-green" : "bg-danger-soft text-danger"
            }`}
          >
            {message.text}
          </p>
        )}
      </div>

      {purchases.length > 0 && (
        <div className="border-t border-line px-4 py-3.5">
          <h3 className="text-[13px] font-semibold">This session</h3>
          <ul className="mt-2 grid gap-1.5">
            {purchases.map((p) => (
              <li key={p.id} className="flex justify-between font-mono text-[12px] text-muted tabular-nums">
                <span>{p.id}</span>
                <span>{eur(p.total)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </aside>
  );
}
