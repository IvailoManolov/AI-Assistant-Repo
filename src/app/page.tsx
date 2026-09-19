import Link from "next/link";
import { BrandMark } from "@/shared";
import { CATALOG } from "@/features/catalog";
import { DecisionTree, SESSIONS, StatusMarker } from "@/features/sessions";

const HERO_SESSION = SESSIONS.find((s) => s.id === "SES-7c19")!;

const FACTS = [
  {
    t: "€50.00",
    d: "The wallet the assistant is limited to. Some things in the shop cost more than that.",
  },
  {
    t: `${CATALOG.length} items`,
    d: "A real catalog with real prices, so shortfalls and partial baskets happen on their own.",
  },
  {
    t: "Full replay",
    d: "Transcript, decision tree and server log, kept together per session.",
  },
];

export default function Landing() {
  return (
    <div className="bg-grain min-h-dvh">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-6 sm:px-8">
        <BrandMark />
        <Link
          href="/login"
          className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-cream transition-colors hover:bg-coral-deep"
        >
          Sign in
        </Link>
      </header>

      <main className="mx-auto max-w-6xl px-5 sm:px-8">
        <section className="grid items-start gap-10 pt-8 pb-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-14 lg:pt-16">
          <div className="max-w-[34rem]">
            <h1 className="font-display text-[2.6rem] leading-[1.03] font-bold text-balance sm:text-[3.4rem] lg:text-[3.9rem]">
              Watch the assistant think before it spends.
            </h1>
            <p className="mt-6 max-w-[46ch] text-[1.0625rem] leading-relaxed text-ink-soft">
              Kiln is a homeware shop with an AI assistant sitting on the customer&rsquo;s wallet.
              It can look up orders, issue refunds and buy things. Every intent, tool call, policy
              check and refusal it makes is recorded, so you can open any conversation afterwards
              and read the decision that produced the answer.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href="/login"
                className="rounded-full bg-coral px-6 py-3 text-sm font-semibold text-white shadow-lift transition-colors hover:bg-coral-deep"
              >
                Sign in
              </Link>
              <p className="text-sm text-muted">Two demo accounts, one shopper and one operator.</p>
            </div>
          </div>

          {/* The hero is the product's own output: one recorded session. */}
          <div className="bg-paper shadow-soft overflow-hidden rounded-2xl ring-1 ring-line">
            <div className="bg-cream-deep flex flex-wrap items-center justify-between gap-2 border-b border-line px-5 py-3.5">
              <span className="flex items-center gap-2.5">
                <StatusMarker status={HERO_SESSION.outcome} />
                <span className="font-mono text-xs">{HERO_SESSION.id}</span>
                <span className="text-xs text-muted">{HERO_SESSION.customer}</span>
              </span>
              <span className="font-mono text-[11px] text-muted tabular-nums">
                {(HERO_SESSION.durationMs / 1000).toFixed(2)}s
              </span>
            </div>

            <div className="border-b border-line px-5 py-4">
              <p className="text-[13px] leading-relaxed text-ink-soft">
                <span className="font-medium text-ink">Anna:</span> {HERO_SESSION.turns[0].text}
              </p>
            </div>

            <div className="px-5 py-5">
              <DecisionTree nodes={HERO_SESSION.tree} />
            </div>
          </div>
        </section>

        <dl className="mb-16 grid gap-px overflow-hidden rounded-xl bg-line sm:grid-cols-3">
          {FACTS.map((f) => (
            <div key={f.t} className="bg-paper px-5 py-5">
              <dt className="font-display text-xl font-bold">{f.t}</dt>
              <dd className="mt-1.5 max-w-[42ch] text-[13px] leading-snug text-muted">{f.d}</dd>
            </div>
          ))}
        </dl>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-6 text-[13px] text-muted sm:px-8">
          <span>Kiln is a demo environment. No real payments, no real orders.</span>
          <Link href="/login" className="font-medium text-ink transition-colors hover:text-coral-deep">
            Sign in
          </Link>
        </div>
      </footer>
    </div>
  );
}
