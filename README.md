**#Architecture Proposal**
Architecture will be tested throughout https://breakscale.tech/ Breakscale. My favorite source for architecutre load testing.

This is just contrived architecture made to potentially scale. I am using many queries to test just to practice my architectural design.

A read-heavy, globally distributed service. Traffic from four regional populations (two Canada, two Europe) reaches a pair of CDNs. It redirects to the lb in your area. The origin consults a 4-way sharded store and delegates work to an AI agent, which is the sole consumer of the data layer: a cache, a search index, and a database.

100Requests / 1Sec.
<img width="2362" height="886" alt="image" src="https://github.com/user-attachments/assets/8194d446-8367-4836-b576-68d744a48cdd" />

5000 Requests / 1Sec.
<img width="2412" height="1017" alt="image" src="https://github.com/user-attachments/assets/d4998cef-34bc-4fcd-8dd4-b4bb711cac0c" />


**#Agent Architecture**
  POST { authenticated_customer_id, message }
                    │
                    ▼
        ┌───────────────────────┐
        │   ORCHESTRATOR        │   owns the turn, the budget, the audit log
        └───────────┬───────────┘
                    ▼
        ┌───────────────────────┐
        │   TRIAGE AGENT        │   model call #1
        │   tools: none         │   out: { intent, order_refs[], specialist }
        └───────────┬───────────┘
                    │  routes to exactly ONE specialist
         ┌──────────┴───────────┐
         ▼                      ▼
 ┌────────────────┐    ┌──────────────────┐
 │  ORDER AGENT   │    │  REFUND AGENT    │
 │  READ ONLY     │    │  READ + PROPOSE  │
 │  ┌──────────┐  │    │  ┌────────────┐  │
 │  │get_order │  │    │  │get_order   │  │
 │  │get_ship  │  │    │  │propose_ref │  │
 │  └──────────┘  │    │  └────────────┘  │
 └────────┬───────┘    └────────┬─────────┘
          │   proposals only    │
          └──────────┬──────────┘
                     ▼
    ╔═════════════════════════════════════╗
    ║        POLICY KERNEL                ║   ← 100% deterministic, zero LLM
    ║  1. schema validate  (reject malformed)
    ║  2. AUTHORIZE        (ownership)    ║   ← D1  scenario-03
    ║  3. POLICY           (eligibility)  ║   ← D4
    ║  4. DERIVE AMOUNT    (ground truth) ║   ← D2, D3  scenario-02/04
    ║  5. IDEMPOTENCY      (dedupe key)   ║   ← D5
    ║  6. EXECUTE + AUDIT                 ║
    ╚══════════════════╤══════════════════╝
                       ▼
        ┌───────────────────────┐
        │  RESPONSE COMPOSER    │   model call #N: facts → customer reply
        │  tools: none          │   input is ONLY kernel-verified facts
        └───────────┬───────────┘
                    ▼
      { reply, actions[], audit[], decisions[] }
      
# Kiln

A homeware shop with an AI assistant sitting on the customer's wallet, and an
operator console that replays every decision the assistant made.

This is the UI pass. The shop is real and interactive; the assistant and the
recorded sessions are static fixtures, so the screens can be judged before the
runtime exists.

## Run it

```bash
npm install
npm run dev
```

Then open http://localhost:3000.

## Signing in

There is no database and no account store. Two hardcoded logins switch roles.

| Username | Password   | Lands on           |
| -------- | ---------- | ------------------ |
| `User`   | `Test123$` | The shop           |
| `Admin`  | `Test123$` | The operator console |

The session is kept in `localStorage` and route guards are client-side only.
That is deliberate for a demo and is not a security boundary.

## What is here

**Landing** (`/`) opens on the product's own output: a live-looking decision
card for a refund that the assistant held for approval.

**Shop** (`/shop`) is the customer side. A 20 item catalog, a €50 wallet, a
basket, and a purchase that refuses when the basket is over the balance. Wallet
and basket live in a React context for the length of the tab, so a reload puts
the wallet back to €50. The assistant dock is open to typing but answers with a
fixed placeholder rather than a faked model reply.

**Console** (`/console`) is the operator side. Four recorded sessions, each with
its transcript, its decision tree, and the server log for the same window. Tree
nodes expand to the machine payload behind each step.

The four fixture sessions are deliberately not all happy paths:

- `SES-4f2a` a tracking lookup that changed nothing.
- `SES-7c19` a refund for one of two wine glasses. The tree shows the €14.90
  unit refund alongside the line total and order total it rejected, then holds
  the refund because it is over the auto-approval ceiling.
- `SES-91d3` a request for an order belonging to a different customer. The
  ownership check runs before the fetch, `get_order` never executes, and the
  refusal is worded so it does not confirm the order exists.
- `SES-2b60` a purchase that cost more than the wallet held, narrowed to the
  affordable item and charged only after explicit confirmation.

## Layout of the code

Organised by feature, not by file type. See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
for the full map and the rules about crossing feature boundaries.

```
src/app/        routes, thin
src/features/   auth · catalog · wallet · assistant · sessions
src/shared/     cross-feature primitives
```

## Design

Colour, type and the token structure follow
[inboxed-web](https://github.com/IvailoManolov/inboxed-web): cream and coral,
Bricolage Grotesque for display, Inter for UI, JetBrains Mono for machine
content. One palette across both roles. Colour is reserved for status; mono is
reserved for content a machine produced.

## Pre-commit guard

`.husky/pre-commit` runs `npm run verify`, which is typecheck, then lint, then
tests. `npm install` wires the hook up through husky's `prepare` script.

There is no test suite yet. `scripts/run-tests.mjs` looks for `*.test.*` and
`*.spec.*` files and reports honestly rather than passing on an empty run: if it
finds test files with no runner configured, it fails and says so. Replace that
branch when a runner is added.

## Not done yet

- The assistant runtime. The chat composer and every session in the console are
  static; nothing calls a model.
- Sessions are not produced by the shop. Shopping in `/shop` does not create a
  session in `/console`.
- No server. State is per tab, and signing in does not touch a backend.
- No tests. The guard is in place and will run them once they exist.
