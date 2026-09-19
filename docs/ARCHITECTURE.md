# Architecture

The app is organised by **feature**, not by file type. If you are chasing a bug,
start from the feature that owns the behaviour rather than from a `components/`
or `hooks/` folder that spans the whole app.

```
data/seed/
  immutable/              source data. Supplied by the exercise, or authored
                          once. Never written, and a reset does not touch it.
  mutable/                generated while the product is used. Sessions so far.
                          `npm run reset` empties this and nothing else.

tests/                    every suite, one folder per feature. Nothing under
                          src/ is a test; the runner refuses to start if one
                          drifts back there.
  mock-env/               infrastructure only, as the brief requires
  guard/                  ownership and disclosure
  kernel/                 rules R1 to R10, the five stages, session tokens
  refunds/                the schema, the lifecycle, and operator approval
  agents/                 the guard agents run before proposing
  orders/                 buying, and who can see what was bought
  orchestrator/           routing, determinism, and behaviour across turns

src/
  app/                    Next.js routes. Thin: they compose features and own
                          page chrome (headers), nothing else.
    page.tsx              /          landing
    login/page.tsx        /login
    shop/page.tsx         /shop      customer
    console/page.tsx      /console   operator
    api/chat/             POST a customer message, get the assistant's turn
    api/sessions/         GET every session, for the operator console
    api/orders/           GET every order; POST a purchase
    api/refunds/          GET refunds; POST a decision on one
    api/runtime/reset/    POST to clear generated state
    globals.css           design tokens, the only stylesheet

  mock-env/               the exercise's mock commerce environment. Scaffolding:
                          it loads seed data and holds runtime records, and
                          knows nothing about refunds or support.

  guard/                  the only path to customer data. Every accessor takes
                          an AuthContext, so an unscoped read cannot be
                          written. Disclosure shaping, session tokens and the
                          conversation's own state live here too.

  core/                   the capability itself, framework free. Imported by
                          route handlers and by the CLI alike.
    contracts.ts          the shapes passed between orchestrator and agents
    model/                the Anthropic Messages shape, and the mock behind it
    agents/               roster.ts names them; one folder each, holding the
                          prompt and how the mock model plays it
    kernel/               five stages per tool call, rules R1 to R10
    orders/               placing a purchase, priced server side
    refunds/              the schema, the three-state lifecycle, settlement
    orchestrator/         resolve, route, run the pipeline, check the output
    sessions/             session types, the store, the recorded seed
    runtime/              clock and id generation, both injected
    text/                 money and order references out of free text

  features/               one folder per domain, each self-contained
    auth/
    catalog/
    wallet/
    assistant/
    sessions/
    orders/                 the operator's order table and refund window
    refunds/                the review panel and the strip that opens it

  shared/                 cross-feature primitives with no domain knowledge
    ui/                   Tooltip, BrandMark
    notifications/        NotificationBadge and useUnread
    lib/                  money formatting
```

`core/` holds no JSX and imports nothing from `features/`. The dependency only
ever points one way: a route handler or a component may read `core`, never the
reverse.

## Feature layout

Every feature uses the same three folders, so you always know where to look:

```
features/<name>/
  components/   React components. Presentation and local interaction.
  model/        Types, state, and rules. No JSX beyond context providers.
  data/         Seed data and fixtures. Swappable for a real source.
  index.ts      The feature's public API.
```

**Import features through `index.ts`.** `import { useWallet } from "@/features/wallet"`
is a supported dependency; reaching into `@/features/wallet/model/wallet-context`
from another feature is not. Inside a feature, use relative paths (`../model/types`)
so the boundary is obvious when reading a diff.

## The features

| Feature | Owns | Key files |
| --- | --- | --- |
| `auth` | Identity and roles. Who is signed in, and which screen they are allowed on. | `model/session-store.ts` (the localStorage external store), `model/accounts.ts` (the two hardcoded logins), `model/demo-accounts.ts` (how the two are described on the sign-in cards), `components/role-guard.tsx` |
| `catalog` | The products. | `data/catalog.ts`, a view over `data/seed/immutable/items.json` |
| `wallet` | Money. Balance, basket, and the purchase rule that refuses when the basket is over the balance. | `model/wallet-context.tsx` |
| `assistant` | The customer-facing chat. Opens a session on the first message. | `components/chat-dock.tsx`, `data/opening-exchange.ts` (the greeting only) |
| `orders` | Orders on screen, for both roles. The operator's table across accounts, and the customer's own list in the shop. | `components/orders-view.tsx`, `components/customer-orders.tsx`, `components/refund-window.tsx` |
| `refunds` | The approval panel and the strip that leads to it. | `components/refund-review.tsx`, `components/refund-banner.tsx` |
| `sessions` | Operator observability: transcripts, decision trees, server logs. | `components/console-workspace.tsx` (polls the feed), `model/types.ts` |
| `landing` | The public page. The scroll-driven pipeline explainer and the screenshot frames. | `components/pipeline-scroll.tsx`, `data/pipeline.ts` |

Both order views are projections from `core/orders/views.ts` rather than from
the route handler, because what each role may see is domain policy and needs
somewhere to be tested from. `customerOrders` is scoped by `customerContext`,
which is the same context the assistant reads through: if a row is on the
customer's screen then Robby can be asked about it, and if it is not, he will
say he cannot find it.

## Where state lives

There is no store library. State sits at whichever level actually needs it.

- **Auth** is an external store over `localStorage`, read with
  `useSyncExternalStore`. It survives a reload and a second tab.
- **Wallet balance** is a React context scoped to `/shop`. It does not persist:
  a reload puts it back to €50, which is what you want when re-running a
  scenario. The **order** a purchase creates is not browser state: it is placed
  on the server, priced there from the product master, and written to
  `data/seed/mutable/orders.json`, so the assistant can be asked about it and
  the operator can see it.
- **Sessions** are server state, in `core/sessions/store.ts`. They are held in
  the mock environment's runtime collection and written through to
  `data/seed/mutable/sessions.json`, so the console still has history after a
  restart. The console polls `/api/sessions` every three seconds.

## Sessions

A session is a conversation, not a request.

- It **opens** on the customer's first message, before any reply exists, so the
  operator sees it while the customer is still waiting.
- It **continues** for as long as that customer keeps talking.
- It **closes itself** after five minutes of silence, and is marked
  `closed_inactive` rather than `closed`, because a conversation nobody
  finished is the operator's problem.

The inactivity check runs on read rather than on a timer. There is no
background job to keep alive, and the store cannot disagree with what the
console is showing.

### Resetting

Sessions live in two places at once: in the process, and in
`data/seed/mutable/sessions.json`. A reset has to clear both. Clearing the
file alone leaves the process holding the sessions it already had, and its next
write puts them straight back, so there are exactly two supported routes:

- **The operator menu**, which is the one to use while the app is running. It
  posts to `/api/runtime/reset`, which clears memory and disk together and
  reports how many sessions went.
- **`npm run reset`**, which posts to that same endpoint when a server is
  listening, and clears the files directly when one is not.

Either way `data/seed/immutable/` is untouched, so a reset returns the
environment to the state it shipped in rather than to an empty one.

Every log line carries the id of the session it came from. There is no global
log stream to correlate against afterwards, which is the point: logs are stored
on the session, not next to it.

## Scroll ownership (operator console)

The console is exactly the height of the viewport and the page itself never
scrolls. Each pane owns its own scrollbar, so a session with 5 messages and 120
log lines scrolls the log table and nothing else.

That holds through an unbroken chain, and breaking any link in it puts the
scrollbar back on the window:

```
page      h-dvh overflow-hidden
  header  shrink-0
  grid    min-h-0 grow overflow-hidden
    col   min-h-0 overflow-hidden
      pane  flex h-full min-h-0 flex-col
        head  shrink-0            <- stays put
        body  min-h-0 grow overflow-y-auto   <- the only scroller
```

`min-h-0` is the load-bearing part: a flex or grid child defaults to
`min-height: auto`, which refuses to shrink below its content and pushes the
overflow up to the page.

## Notifications

`shared/notifications/` is one badge and one hook, used by both roles so the
two surfaces teach the same vocabulary. A breathing mark means something is
waiting on a person; its colour says how much that matters.

| Tone | Means | Where |
| --- | --- | --- |
| `info` (cobalt) | New, unseen, no action required yet | Unread assistant replies; a live session the operator has not opened |
| `attention` (amber) | Drafted, waiting on a decision | A session holding a refund |
| `alert` (danger) | Went wrong on its own | A session closed by inactivity |

`useUnread` has no effects: everything is marked seen from an event handler,
so there is no render where the count is briefly wrong. Whatever is present on
the first render counts as seen, so a surface with a backlog opens quiet.

The badge breathes with a scale **and** a halo. Scale alone cannot carry it: 5%
of a 10px dot is a sub-pixel move that nobody sees. The halo reads at dot size,
the scale reads on the wider counted badges, and one animation covers both.

## Motion

| Class | What it marks | Where |
| --- | --- | --- |
| `breathe` | Something is waiting on a person | Notification badges |
| `pane-in` | The contents of a pane were replaced | Selecting a session |
| `node-in` | Agent execution unfolding in sequence | Decision tree nodes |
| `typing-dot` | A reply is being composed | Chat dock |
| `reveal` | A section has been reached | Landing page |
| `spine-fill`, `stage` | Where you are in the pipeline you are reading about | Landing page |

All of it answers something the person did, except `breathe`, which is the one
thing allowed to move on its own because its whole job is to be noticed.
`prefers-reduced-motion` neutralises every one of them in `globals.css`.

## The runtime, now that it has landed

The seam held. `core/orchestrator/reply.ts` was the only place that invented
what the assistant says, and replacing its body with the real pipeline changed
nothing above it: the session lifecycle, the logging, the API and the console
are untouched, and the decision tree the console already rendered simply
started carrying real nodes.

What sits behind it, per `.claude/Design.md`:

- `src/guard/` is the only path to customer data. Every accessor takes an
  `AuthContext`, so an unscoped read cannot be written.
- `core/model/` is the Anthropic Messages shape and a rule-based mock behind
  it. `setModelClient` at the composition root is the whole swap.
- `core/agents/` holds four small system prompts and one loop. The loop never
  touches a handler; it hands every proposed tool call to the kernel.
- `core/kernel/` runs five stages per call (capability, auth binding,
  preconditions R1 to R10, handler, disclosure) and emits a trace entry for
  every one, passed or failed.
- `core/refunds/` is the three-state lifecycle. Operator approval re-runs the
  rules against the record as it stands at the click.
- `core/runtime/` is the injected clock and id source. Below the adapters
  there is no `Date.now()` and no `randomUUID()`, which is what makes a replay
  a replay.

Run it headlessly with `npm run scenarios`. That prints the message, the whole
trace, the outcome, the reply and any refund record, for every supplied
example plus one replay that demonstrates duplicate protection.

### Two rules inside core

**No barrel files.** `src/core/**` and `src/guard/` have no `index.ts`. Export
from the file that owns the thing and import from that file, so a reader can
always see where something came from. The folders under `src/features/` keep
theirs: that is the UI's public-API boundary and a different rule.

**Relative imports carrying the `.ts` extension.** It looks fussy next to the
`@/` aliases in `src/features`, and it is load bearing: it is what lets
`node --test` execute those files directly, with no bundler, no transpile step
and no test framework.

### Conversations

A session is a conversation, and the pipeline runs once per message in it.
Three things make that work:

- `guard/sessions.ts` holds the conversation's token and its context. The
  token is validated on every tool call. The context is what "that order"
  refers to and what question is outstanding.
- `orchestrator/resolve.ts` turns triage's reading of the message into a route,
  using that context. Triage has no tools, so it cannot know on its own whether
  a "yes" is a yes to anything.
- The store groups each turn's decision tree under one node, so a three-message
  conversation reads as three decisions rather than one long list.

Every line the pipeline logs is `info`, so a session can be read end to end
with nothing hidden behind a level filter. The one exception is the store's own
warn when a session closes itself through inactivity, which is about the
conversation rather than about the work.

See `docs/TEST-PLAN.md` for what to run and what to type.

## Design tokens

All colour, type and elevation live in `src/app/globals.css` as CSS variables
mapped into Tailwind through `@theme inline`. One palette across the whole
product: warm paper, ink text, coral for action. Status colour (green, amber,
red) is only ever applied to something that has a status, and monospace is only
ever used for content a machine produced.
