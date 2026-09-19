# Architecture

The app is organised by **feature**, not by file type. If you are chasing a bug,
start from the feature that owns the behaviour rather than from a `components/`
or `hooks/` folder that spans the whole app.

```
src/
  app/                    Next.js routes. Thin: they compose features and own
                          page chrome (headers), nothing else.
    page.tsx              /          landing
    login/page.tsx        /login
    shop/page.tsx         /shop      customer
    console/page.tsx      /console   operator
    globals.css           design tokens, the only stylesheet

  features/               one folder per domain, each self-contained
    auth/
    catalog/
    wallet/
    assistant/
    sessions/

  shared/                 cross-feature primitives with no domain knowledge
    ui/                   Tooltip, BrandMark
    lib/                  money formatting
```

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
| `auth` | Identity and roles. Who is signed in, and which screen they are allowed on. | `model/session-store.ts` (the localStorage external store), `model/accounts.ts` (the two hardcoded logins), `components/role-guard.tsx` |
| `catalog` | The products. | `data/catalog.ts` (20 items), `components/item-card.tsx` |
| `wallet` | Money. Balance, basket, and the purchase rule that refuses when the basket is over the balance. | `model/wallet-context.tsx` |
| `assistant` | The customer-facing chat. | `data/opening-exchange.ts` (fixture), `components/chat-dock.tsx` |
| `sessions` | Operator observability: transcripts, decision trees, server logs. | `data/sessions.fixtures.ts`, `model/types.ts`, `components/decision-tree.tsx` |

## Where state lives

There is no store library and no server.

- **Auth** is an external store over `localStorage`, read with
  `useSyncExternalStore`. It survives a reload and a second tab.
- **Wallet** is a React context scoped to `/shop`. It does not persist: a
  reload puts the balance back to €50, which is what you want when re-running a
  scenario.
- **Sessions** are static fixtures. Nothing writes them yet.

## When the runtime lands

The seam is deliberate. `features/sessions/data/sessions.fixtures.ts` is the only
place that invents a session, and `features/assistant/data/opening-exchange.ts`
is the only place that invents a reply. Replace those two exports with a real
source and every component above them keeps working.

The likely shape of that change:

- `features/assistant/model/` gains the tool contracts and the call to the model.
- `features/sessions/data/` becomes a reader over recorded runs rather than a
  literal array.
- A `features/orders/` feature appears for order lookups and refunds, which the
  assistant calls and `sessions` records.

## Design tokens

All colour, type and elevation live in `src/app/globals.css` as CSS variables
mapped into Tailwind through `@theme inline`. One palette across the whole
product: warm paper, ink text, coral for action. Status colour (green, amber,
red) is only ever applied to something that has a status, and monospace is only
ever used for content a machine produced.
