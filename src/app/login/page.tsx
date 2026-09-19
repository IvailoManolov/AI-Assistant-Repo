"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ShoppingBag, SlidersHorizontal } from "lucide-react";
import { readStoredSession, useAuth } from "@/lib/auth-context";

const ROLES = [
  {
    username: "User",
    title: "Shop as a customer",
    blurb: "A €50 wallet, the full catalog, and the assistant in the corner.",
    icon: ShoppingBag,
  },
  {
    username: "Admin",
    title: "Open the operator console",
    blurb: "Replay any session: transcript, decision tree, server log.",
    icon: SlidersHorizontal,
  },
];

export default function LoginPage() {
  const router = useRouter();
  const { session, signIn } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const current = readStoredSession();
    if (current) {
      router.replace(current.role === "admin" ? "/console" : "/shop");
    }
  }, [session, router]);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const result = signIn(username, password);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setError(null);
    router.replace(username.trim() === "Admin" ? "/console" : "/shop");
  }

  function pick(name: string) {
    setUsername(name);
    setPassword("Test123$");
    setError(null);
  }

  return (
    <div className="bg-grain flex min-h-dvh flex-col">
      <header className="mx-auto flex w-full max-w-md items-center px-5 py-6 sm:px-8">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="size-3 rounded-full bg-coral" aria-hidden />
          <span className="font-display text-lg font-bold">Kiln</span>
        </Link>
      </header>

      <main className="mx-auto flex w-full max-w-md grow flex-col justify-center px-5 pb-16 sm:px-8">
        <h1 className="font-display text-3xl font-bold">Sign in</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">
          Pick a side. Both accounts use the password{" "}
          <code className="font-mono text-[13px] text-ink">Test123$</code>.
        </p>

        <div className="mt-6 grid gap-2.5">
          {ROLES.map((r) => {
            const Icon = r.icon;
            const active = username === r.username;
            return (
              <button
                key={r.username}
                type="button"
                onClick={() => pick(r.username)}
                aria-pressed={active}
                className={`flex items-start gap-3.5 rounded-xl px-4 py-3.5 text-left transition-colors ${
                  active
                    ? "bg-paper ring-2 ring-coral"
                    : "bg-paper/60 ring-1 ring-line hover:bg-paper"
                }`}
              >
                <Icon className="mt-0.5 size-4 shrink-0 text-coral" strokeWidth={2.2} />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">{r.title}</span>
                  <span className="mt-0.5 block text-[13px] leading-snug text-muted">
                    {r.blurb}
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        <form onSubmit={onSubmit} className="mt-6 grid gap-3.5" noValidate>
          <div className="grid gap-1.5">
            <label htmlFor="username" className="text-[13px] font-medium text-ink-soft">
              Username
            </label>
            <input
              id="username"
              name="username"
              autoComplete="username"
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                setError(null);
              }}
              className="rounded-lg bg-paper px-3.5 py-2.5 text-sm ring-1 ring-line outline-none placeholder:text-muted focus:ring-2 focus:ring-coral"
              placeholder="User"
            />
          </div>

          <div className="grid gap-1.5">
            <label htmlFor="password" className="text-[13px] font-medium text-ink-soft">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError(null);
              }}
              className="rounded-lg bg-paper px-3.5 py-2.5 text-sm ring-1 ring-line outline-none placeholder:text-muted focus:ring-2 focus:ring-coral"
              placeholder="Test123$"
            />
          </div>

          {error && (
            <p role="alert" className="rounded-lg bg-danger-soft px-3.5 py-2.5 text-[13px] text-danger">
              {error}
            </p>
          )}

          <button
            type="submit"
            className="mt-1 rounded-full bg-coral px-6 py-3 text-sm font-semibold text-white shadow-lift transition-colors hover:bg-coral-deep"
          >
            Sign in
          </button>
        </form>

        <p className="mt-6 text-[13px] leading-relaxed text-muted">
          There is no database and no account store. The two logins exist to
          switch roles.
        </p>
      </main>
    </div>
  );
}
