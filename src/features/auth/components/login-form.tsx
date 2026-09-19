"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";

import { useAuth } from "../model/auth-context";
import { readStoredSession } from "../model/session-store";
import { ACCOUNTS, landingRouteFor } from "../model/accounts";
import { DEMO_ACCOUNTS } from "../model/demo-accounts";
import { AccountCard } from "./account-card";

/**
 * Signing in by choosing who you are.
 *
 * The old screen asked for a username and a password that were both printed
 * on the page above the box, which is a form pretending to be a gate. There
 * are exactly two identities here, so the honest control is a choice between
 * two, and the typed form stays underneath for anyone who wants to see the
 * failure path work.
 */
export function LoginForm() {
  const router = useRouter();
  const { session, signIn } = useAuth();
  const [picked, setPicked] = useState<string | null>(null);
  const [manual, setManual] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const cardsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const current = readStoredSession();
    if (current) router.replace(landingRouteFor(current.role));
  }, [session, router]);

  const chosen = DEMO_ACCOUNTS.find((a) => a.username === picked) ?? null;

  function enter(name: string, secret: string) {
    const result = signIn(name, secret);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setError(null);
    /** The account decides where it lands. A username is not a role. */
    router.replace(landingRouteFor(ACCOUNTS[name.trim()].role));
  }

  /** Arrow keys move between cards, which is what a radio group owes you. */
  function onKeyDown(event: React.KeyboardEvent) {
    const keys = ["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp"];
    if (!keys.includes(event.key)) return;
    event.preventDefault();
    const step = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : -1;
    const at = DEMO_ACCOUNTS.findIndex((a) => a.username === picked);
    const next = DEMO_ACCOUNTS[(Math.max(at, 0) + step + DEMO_ACCOUNTS.length) % DEMO_ACCOUNTS.length];
    setPicked(next.username);
    setError(null);
    requestAnimationFrame(() => {
      const buttons = cardsRef.current?.querySelectorAll<HTMLButtonElement>('[role="radio"]');
      buttons?.[DEMO_ACCOUNTS.indexOf(next)]?.focus();
    });
  }

  return (
    <>
      <div className="max-w-[40ch]">
        <h1 className="font-display text-[2.1rem] leading-tight font-bold">Who are you today?</h1>
        <p className="mt-2.5 text-[15px] leading-relaxed text-ink-soft">
          Pick a card to sign in. The two accounts see the same system from opposite ends: one
          spends money, the other decides whether it moves.
        </p>
      </div>

      <div
        ref={cardsRef}
        role="radiogroup"
        aria-label="Choose an account"
        onKeyDown={onKeyDown}
        className="mt-7 grid gap-3.5 sm:grid-cols-2"
      >
        {DEMO_ACCOUNTS.map((account) => (
          <AccountCard
            key={account.username}
            account={account}
            selected={picked === account.username}
            onSelect={() => {
              setPicked(account.username);
              setError(null);
            }}
          />
        ))}
      </div>

      <button
        type="button"
        disabled={!chosen}
        onClick={() => chosen && enter(chosen.username, chosen.password)}
        className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-coral px-6 py-3.5 text-sm font-semibold text-white shadow-lift transition-colors hover:bg-coral-deep disabled:bg-cream-deep disabled:text-muted disabled:shadow-none"
      >
        {chosen ? `Continue as ${chosen.displayName}` : "Choose an account to continue"}
        {chosen && <ArrowRight className="size-4" strokeWidth={2.4} />}
      </button>

      {error && (
        <p role="alert" className="mt-3 rounded-lg bg-danger-soft px-3.5 py-2.5 text-[13px] text-danger">
          {error}
        </p>
      )}
    </>
  );
}
