# AI-Assistant-Repo

An AI-assisted customer-support capability for a small ecommerce store, built
for the Senior Engineer (AI Systems) take-home exercise.

A customer sends a support message together with an already-authenticated
customer ID. The system reads the commerce record, answers order questions,
and drafts refunds. It never pays one: every refund is held for a human
operator to approve.

## Shape

- **Next.js + TypeScript + Tailwind.** Two roles behind a mock login, chosen
  as cards rather than typed: a customer who shops against a EUR 50 wallet,
  tracks her own orders, and chats with Robby, and an operator who watches
  sessions, reads the server log and the agent's decision tree, and approves or
  rejects held refunds. The assistant is called Robby, and so is the product.
- **Four agents** (triage, order, refund, composer) with least-privilege tool
  grants, behind a mocked model client shaped like the Anthropic Messages API.
- **A deterministic policy kernel** between every proposed tool call and every
  handler. Agents propose; only the kernel executes.
- **A guard module** through which all customer data is read. Every accessor
  requires an auth context, and the model can never supply an identity.

## State of play

The pipeline is built and connected. A customer message opens a session, runs
triage, the order agent, the refund agent where relevant and the composer, and
every tool call in between passes the kernel. `npm run scenarios` runs the
supplied examples headlessly and prints the whole decision trace.

The operator can approve or reject a held refund, which closes the session
green, and can switch the console between Sessions and Orders. Buying in the
shop places a real server-side order Robby can then be asked about, and the
customer has an Orders tab of her own, scoped by the same guard.

Asking after an order's progress is its own thing: triage sets `asks_status`
when the message asks where an order has got to, and the reply then opens on
the state, the date it was reached, and what is left of the refund window.

Still open: nothing credits a wallet. A settled refund is marked settled and no
money moves, which the approval screen says out loud.

## Layers

`src/` has one direction of dependency, and it is worth keeping:

    guard  <-  core  <-  app / features

- `src/mock-env/` is scaffolding. Seed loading, a schema-free runtime store,
  and the mutable half of the seed. It knows nothing about refunds.
- `src/guard/` is the only path to customer data. Every accessor takes an
  `AuthContext`; there is no unscoped read to call by mistake.
- `src/core/` is the capability: `model/` (Anthropic-shaped boundary and the
  rule-based mock), `agents/`, `kernel/` (rules R1 to R12), `refunds/`
  (schema, lifecycle, settlement), `orders/`, `orchestrator/`, `runtime/`
  (injected clock and ids), `sessions/`.
- `src/app/` and `src/features/` are adapters over it. Core holds no JSX and
  imports nothing from features.

### Agents

`src/core/agents/roster.ts` names the four that exist. Each is a folder beside
it holding a `prompt.ts`, which is the agent, and a `behaviour.ts`, which is
how the stand-in model plays that part.

    triage/     reads the message and says what kind it is. No tools.
    order/      retrieves records. Read-only tools.
    refund/     proposes on a retrieved record. Read tools + propose_refund.
    composer/   writes the reply. No tools.

The orchestrator is not an agent and is not in there. It lives in
`core/orchestrator/` and is the only thing that decides which agents run.

### Two conventions in core

- **No barrel files.** `src/core/**` and `src/guard/` have no `index.ts`.
  Export from the file that owns the thing, and import from that file. The
  folders under `src/features/` keep their `index.ts`: that is the UI's
  public-API boundary and a different rule.
- **Relative imports with the `.ts` extension.** It looks fussy next to the
  `@/` aliases in `src/features`, and it is load bearing: it is what lets
  `node --test` run those files directly, with no bundler and no test
  framework.

## Testing

Every suite lives under `tests/`, one folder per feature, named after it:

    tests/<feature>/<feature>.test.ts

Nothing under `src/` is a test. The runner walks `tests/` only, and fails with
a list rather than running anything if a `.test.ts` has drifted back into
`src/`, because a suite that silently stops running is worse than no suite.

`npm run verify` is typecheck, lint, then 143 tests. `npm run scenarios` runs
the supplied examples plus the multi-turn conversation, headlessly, with the
full decision trace. `docs/TEST-PLAN.md` is the checklist to work through
before committing, including the live chat script.

Read `.claude/Design.md` before writing any of it. It records what the
exercise asked for, what the supplied seed data implies but never states, the
decisions taken, and the ones that were revised under pressure-testing.

`docs/ARCHITECTURE.md` covers the existing feature-based UI layout.

## Conventions

- Feature-based folders. Cross-feature imports go through a feature's
  `index.ts`; imports inside a feature are relative.
- Money is integer minor units everywhere, formatted only at the edge.
- Nothing a browser sends is priced by the browser. Baskets carry item ids and
  quantities; the server prices them from the product master.
- `data/seed/immutable/` is source data and is never written. `data/seed/mutable/`
  holds what the running product generates (sessions, purchased orders), and
  `npm run reset` empties only that.
- No em dashes in prose, comments, or UI copy.
- `npm run verify` is typecheck, lint, then tests. The pre-commit hook runs it.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
