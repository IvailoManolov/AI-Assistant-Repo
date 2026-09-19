import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { BrandMark, RobbyAvatar } from "@/shared";
import { CATALOG } from "@/features/catalog";
import { PipelineScroll, Reveal, Shot } from "@/features/landing";
import { DecisionTree, StatusMarker } from "@/features/sessions";
import { recordedSession } from "@/core/sessions/recorded";

/** A recorded run, not a live one. The landing page never reads the store. */
const HERO_SESSION = recordedSession("SES-7c19");

const FACTS = [
  {
    t: "€50.00",
    d: "The wallet Robby is limited to. Several things in the shop cost more than that, which is where the interesting behaviour lives.",
  },
  {
    t: `${CATALOG.length} items`,
    d: "A real catalog with real prices, so shortfalls and partial baskets happen on their own rather than being staged.",
  },
  {
    t: "12 rules",
    d: "Every one of them runs between a proposed tool call and the code that would carry it out. None of them are in a prompt.",
  },
  {
    t: "0 cents",
    d: "What a settled refund pays. Approval records a decision and closes the session. Moving money is out of scope, and the screen says so.",
  },
];

/**
 * Each of these is one screenshot of the running product plus rather more
 * words than picture. A page that is mostly screenshots is a gallery, and a
 * reader deciding whether to open the thing needs the argument, not the view.
 */
const SECTIONS = [
  {
    id: "shop",
    heading: "A shop, with a robot in the corner",
    shot: "/shots/shop-chat.png",
    alt: "The Robby shop with the chat panel open, answering a question about order ORD-200",
    caption:
      "Two turns of a real conversation. The second one raised a refund that is now waiting on an operator.",
    paragraphs: [
      "Anna signs in with a wallet of fifty euro and a catalog priced in euro. Robby sits in the corner of it. He can look up any order on her account, explain where it is, and raise a refund against a line of it.",
      "He is answering from records, not from the conversation. Ask about an order that is not on the account and he will tell you he cannot find it, in exactly the same words he uses for an order that does not exist, because the difference between those two answers is a way of confirming that somebody else's order is real.",
    ],
    points: [
      "Buying places a real order on the server, priced from the product master rather than from the browser",
      "The order reference is one you can type back into the chat a second later",
      "Every message opens a session an operator can replay",
    ],
  },
  {
    id: "orders",
    heading: "Your orders, and a question about one",
    shot: "/shots/orders-tab.png",
    alt: "The customer's orders tab, with one order opened to show its lines and prices",
    caption:
      "One order opened. The refund window is the same number the rule will use when the refund is asked for.",
    paragraphs: [
      "The Orders tab lists everything on the account, newest first, with what each order cost. Opening one shows the lines, the price of each, and how many days are left to ask for a refund on it.",
      "It reads through the guard with the same customer context Robby reads through. That equivalence is deliberate: if a row is on this screen then he can be asked about it, and if it is not, he will say he cannot find it. There is no second query that sees more.",
    ],
    points: [
      "Type \"status of ORD-200\" and the answer opens on the state and the date it arrived",
      "The same question without the keyword works too: where is it, has it arrived, any update",
      "Ask Robby about it puts the question in the box and leaves the sending to you",
    ],
  },
  {
    id: "console",
    heading: "Every conversation replays",
    shot: "/shots/console-session.png",
    alt: "The operator console showing a transcript beside the decision tree for that session",
    caption:
      "The transcript on the left, the decision that produced it on the right, down to the session token.",
    paragraphs: [
      "The operator console holds every session. Each one carries the transcript, the decision tree, and the server log, and they are three views of the same run rather than three things written separately.",
      "The tree is not a summary. Each node is a step that actually happened: the intent triage read, the tool an agent proposed, the capability check, the session lookup, the rule that passed or refused, and how long each took. Expanding a node shows the payload it carried.",
    ],
    points: [
      "Sessions are coloured by what they need: green is done, amber is waiting on a person, red was refused",
      "The server log is the same run as a flat list, at info, for reading end to end",
      "Nothing is reconstructed afterwards. The tree is written as the run happens",
    ],
  },
  {
    id: "refusal",
    heading: "What a refusal looks like",
    shot: "/shots/console-refused.png",
    alt: "A session where an order belonging to another customer was asked about and refused",
    caption:
      "The lookup was never executed. The check runs before the fetch, so no record reached the model.",
    paragraphs: [
      "Anna asks about ORD-204. It exists, and it belongs to somebody else. The ownership check refuses it before the fetch runs, so there is no order in memory for a model to be careless with.",
      "The reply she gets is worded so that it does not confirm the order exists. The console records both halves: the operator can see that this was an ownership refusal rather than a missing record, and the customer cannot tell the difference. That split is the whole design.",
    ],
    points: [
      "The guard is the only path to customer data, and every accessor takes an auth context",
      "An agent that names an account id in a proposal has that field overwritten and the attempt logged",
      "There is no unscoped read to call by mistake",
    ],
  },
  {
    id: "approval",
    heading: "Nothing moves without a person",
    shot: "/shots/refund-review.png",
    alt: "The refund approval panel, showing the amount, the signals raised, and the two decisions",
    caption:
      "The amount the kernel recomputed, what it raised about it, and what approving does and does not do.",
    paragraphs: [
      "A refund Robby raises is held. The operator sees the amount, the order and line it is against, and the signals the kernel raised and deliberately did not act on, including the confidence figure, which is advisory and read by no rule.",
      "Approving marks it settled and records who decided. It pays nothing, and the panel says so rather than implying otherwise. Either decision closes the session green, because a rejected refund needs no more attention than an approved one.",
    ],
    points: [
      "The rules run again at the moment of the click, against an operator principal",
      "Two operators reaching for the same refund is handled: the second one is told it has been decided",
      "The automatic approval ceiling is zero, so nothing this system allows is ever automatic",
    ],
  },
  {
    id: "orders-all",
    heading: "Every order, and how long is left on it",
    shot: "/shots/console-orders.png",
    alt: "The operator's order list with status, refund window, totals and refund counts",
    caption:
      "Seven marks, one per day of the window, filling as they go. Grey is cancelled, which needs nobody.",
    paragraphs: [
      "The console's other view answers a different question. An order has no decisions of its own, so there is no tree and no log here: what matters is the state it is in, whether it was paid for, and how much of the refund window is left.",
      "The window is drawn as seven marks rather than a bar because the rule counts whole days. It turns amber and then red as it runs out, and it is computed by the same function the kernel calls, so a screen can never disagree with a refusal.",
    ],
    points: [
      "Orders supplied with the exercise, written for it, and created while the app was running, all in one list",
      "Rows open to show line items, dates and carrier",
      "A reset clears everything created at runtime and leaves the supplied data exactly as it shipped",
    ],
  },
];

const LIMITS = [
  {
    t: "No money moves",
    d: "A settled refund is marked settled. Nothing credits a wallet, and the approval screen says so instead of implying a payout.",
  },
  {
    t: "The model is a stand-in",
    d: "A deterministic mock sits behind an Anthropic Messages API shaped boundary. It plays each agent by rule, including one realistic failure the kernel exists to catch.",
  },
  {
    t: "Order dates are synthetic",
    d: "The supplied orders carry no timestamps and are treated as immutable, so their timelines are generated relative to now. They never quietly expire.",
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
        {/* ------------------------------------------------------------ hero */}
        <section className="grid items-start gap-10 pt-8 pb-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-14 lg:pt-16">
          <div className="max-w-[34rem]">
            <span className="flex items-center gap-2 text-[13px] font-medium text-coral-deep">
              <RobbyAvatar size={26} />
              Robby, a support assistant that shows its working
            </span>

            <h1 className="mt-5 font-display text-[2.6rem] leading-[1.03] font-bold text-balance sm:text-[3.4rem] lg:text-[3.8rem]">
              Every refund he raises stops at a person.
            </h1>

            <p className="mt-6 max-w-[46ch] text-[1.0625rem] leading-relaxed text-ink-soft">
              Robby runs a small homeware shop. He can read a customer&rsquo;s orders, tell them
              where a parcel is, spend their wallet, and argue for a refund. He cannot pay one. A
              deterministic kernel sits between what he proposes and what actually happens, and
              every intent, tool call, check and refusal is recorded, so any conversation can be
              opened afterwards and read as the decision that produced it.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href="/login"
                className="flex items-center gap-2 rounded-full bg-coral px-6 py-3 text-sm font-semibold text-white shadow-lift transition-colors hover:bg-coral-deep"
              >
                Open the demo
                <ArrowRight className="size-4" strokeWidth={2.4} />
              </Link>
              <p className="text-sm text-muted">
                Two accounts, one shopper and one operator. Pick a card and go.
              </p>
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

        {/* ----------------------------------------------------------- facts */}
        <dl className="mb-20 grid gap-px overflow-hidden rounded-xl bg-line sm:grid-cols-2 lg:grid-cols-4">
          {FACTS.map((f) => (
            <div key={f.t} className="bg-paper px-5 py-5">
              <dt className="font-display text-xl font-bold">{f.t}</dt>
              <dd className="mt-1.5 text-[13px] leading-snug text-muted">{f.d}</dd>
            </div>
          ))}
        </dl>

        {/* -------------------------------------------------------- pipeline */}
        <section className="border-t border-line pt-14 pb-20">
          <Reveal className="mb-12 max-w-[44ch]">
            <h2 className="font-display text-[2rem] leading-tight font-bold sm:text-[2.4rem]">
              One message, five steps, in this order
            </h2>
            <p className="mt-3 text-[15.5px] leading-relaxed text-ink-soft">
              Four agents and a kernel. Each one holds the smallest set of tools that lets it do
              its job, and the one that can raise money is the one that can do the least with it.
              Scroll, and the same message moves through them.
            </p>
          </Reveal>

          <PipelineScroll />
        </section>

        {/* ------------------------------------------------------- sections */}
        {SECTIONS.map((section, at) => (
          <section
            key={section.id}
            className="grid items-start gap-8 border-t border-line py-14 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-14"
          >
            <Reveal className={at % 2 === 1 ? "lg:order-2" : undefined}>
              <h2 className="font-display text-[1.75rem] leading-tight font-bold sm:text-[2.05rem]">
                {section.heading}
              </h2>

              {section.paragraphs.map((paragraph) => (
                <p
                  key={paragraph.slice(0, 24)}
                  className="mt-4 max-w-[58ch] text-[15.5px] leading-relaxed text-ink-soft"
                >
                  {paragraph}
                </p>
              ))}

              <ul className="mt-5 grid gap-2">
                {section.points.map((point) => (
                  <li key={point} className="flex gap-2.5 text-[14px] leading-snug text-muted">
                    <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-coral" />
                    {point}
                  </li>
                ))}
              </ul>
            </Reveal>

            <Shot
              src={section.shot}
              alt={section.alt}
              caption={section.caption}
              tall={section.id === "orders" || section.id === "console"}
            />
          </section>
        ))}

        {/* --------------------------------------------------------- limits */}
        <section className="border-t border-line py-16">
          <Reveal className="max-w-[46ch]">
            <h2 className="font-display text-[1.75rem] leading-tight font-bold sm:text-[2.05rem]">
              What this is not
            </h2>
            <p className="mt-3 text-[15.5px] leading-relaxed text-ink-soft">
              Three things are deliberately missing, and saying so is cheaper than letting somebody
              find them and wonder what else was glossed over.
            </p>
          </Reveal>

          <dl className="mt-8 grid gap-px overflow-hidden rounded-xl bg-line sm:grid-cols-3">
            {LIMITS.map((limit, at) => (
              <Reveal key={limit.t} className="bg-paper px-5 py-5" delay={at * 0.08}>
                <dt className="font-display text-[15px] font-bold">{limit.t}</dt>
                <dd className="mt-1.5 text-[13.5px] leading-snug text-muted">{limit.d}</dd>
              </Reveal>
            ))}
          </dl>
        </section>

        {/* ------------------------------------------------------------ cta */}
        <section className="border-t border-line py-16">
          <Reveal className="bg-paper shadow-soft flex flex-wrap items-center justify-between gap-6 rounded-2xl px-6 py-8 ring-1 ring-line sm:px-9">
            <div className="max-w-[40ch]">
              <h2 className="font-display text-[1.6rem] leading-tight font-bold">
                Break it in about two minutes
              </h2>
              <p className="mt-2 text-[14.5px] leading-relaxed text-ink-soft">
                Sign in as Anna, ask about an order that is not hers, ask for a refund on one that
                is, then sign in as the operator and read what happened.
              </p>
            </div>
            <Link
              href="/login"
              className="flex items-center gap-2 rounded-full bg-coral px-6 py-3 text-sm font-semibold text-white shadow-lift transition-colors hover:bg-coral-deep"
            >
              Open the demo
              <ArrowRight className="size-4" strokeWidth={2.4} />
            </Link>
          </Reveal>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-6 text-[13px] text-muted sm:px-8">
          <span>Robby is a demo environment. No real payments, no real orders.</span>
          <Link href="/login" className="font-medium text-ink transition-colors hover:text-coral-deep">
            Sign in
          </Link>
        </div>
      </footer>
    </div>
  );
}
