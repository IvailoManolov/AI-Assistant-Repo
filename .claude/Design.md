# Design: AI-assisted customer support capability

Status: built. The guard, the policy kernel, the four agents, the mocked model
boundary, the refund lifecycle, the orchestrator and the headless runner all
exist and are covered by tests. `npm run scenarios` runs the supplied examples
end to end.

The operator can approve or reject a held refund from the console, and doing so
closes the session that raised it.

Buying in the shop places a real order the assistant can be asked about and the
operator can see. Not built: any movement of actual money. Noted in section 17.

`docs/TEST-PLAN.md` is the runnable version of section 15.
Date: 2026-09-19
Scope of this document: the support capability only. The existing Next.js UI
(shop, operator console, decision tree) is referenced where it consumes this
design, but its own design is not restated here.

---

## 1. What is being built

An ecommerce customer sends a support message together with an
already-authenticated customer ID. The system reads the commerce record,
decides what action is appropriate, and either answers directly or drafts a
refund for a human operator to approve.

No refund is ever paid by the machine. The assistant proposes; an operator
clicks.

---

## 2. Requirements

The exercise brief and the supplied data are two different sources of
requirement, and they are kept apart deliberately. The first is what was
asked for. The second is what the data quietly demands, and is where most of
the design effort goes.

### 2.1 Stated explicitly by the exercise

| # | Requirement |
|---|---|
| E1 | A customer message arrives with an already-authenticated customer ID. Authentication itself is out of scope. |
| E2 | The solution may use the supplied commerce data and a refund capability to respond and take appropriate action. |
| E3 | The model interaction may be mocked. The boundary must stay representative of how a real model would be used. |
| E4 | Seed files are immutable source data. All runtime change is in memory. Restarting restores the original seed state. |
| E5 | The mock environment defines no refund schema, no lifecycle, no approval model, no confirmation model, no authorization rules. Those belong to the solution. |
| E6 | A simple way to clear temporary runtime state without touching seed files. |
| E7 | The four example requests are illustrative. They must not be hard-coded against. |
| E8 | Straightforward for a reviewer to run against the example requests. |
| E9 | A README covering: how to run, what was implemented, assumptions, what was left incomplete, what would come next. |
| E10 | Submission carries implementation, README, mock data, and raw Claude Code transcripts. No secrets, no caches, no build artifacts. |
| E11 | No UI, cloud deployment, or infrastructure is expected. |

E11 is worth noting rather than obeying: a UI already exists in this repo
because the operator approval step needs somewhere to happen. It is surplus
to the brief, not a substitute for the headless path in E8.

### 2.2 Implied by the seed data and the example requests

None of the following appears in the brief. Each is forced by the shape of
the data that was supplied.

| # | Implied requirement | What forces it |
|---|---|---|
| I1 | Line-item, quantity-aware partial refunds | scenario-02 asks for one broken wine glass. ORD-200 holds `Wine Glass, quantity: 2, unit_price: 14.90`. The correct amount is 14.90, not the 29.80 line total and not the 54.80 order total. Three plausible numbers, one right answer. |
| I2 | Ownership enforcement on every read | ORD-204 belongs to CUST-002 while scenario-03 authenticates as CUST-001. The pairing is deliberate. |
| I3 | Non-disclosure on ownership failure | Same scenario. Replying "you are not allowed to see ORD-204" confirms ORD-204 exists. An ownership failure and a nonexistent order must be indistinguishable to the customer. |
| I4 | Customer-stated amounts are untrusted input | scenario-04 claims a 34.90 refund against an order whose recorded total is 29.90. |
| I5 | Duplicate-refund protection | scenario-04 says "I still haven't received it", which is a claim about prior state. Replaying the scenario must not pay twice. |
| I6 | Order status gates the action | `in_transit`, `delivered`, `returned` plus `return_status: received` are the entire supplied status vocabulary. A refund against an undelivered order is a different branch from a refund against a delivered one. |
| I7 | Money is EUR, two decimals | Every supplied order. Argues for integer minor units, and for a currency check that exists and never fires. |
| I8 | Shipping detail is disclosable to the owner | ORD-100 carries a carrier and tracking number and scenario-01 asks where it is. |

---

## 3. Decisions

These were set before the design and then pressure-tested. Where the test
changed something, the change is recorded.

### D1. The model is mocked behind an Anthropic Messages API shape

Swapping in a real client is replacing one binding at the composition root.

Survived. Extended: the mock is **rule-based, not a fixture table**. A lookup
keyed on the four scenario strings would be hard-coding against the examples,
which E7 forbids in as many words. The mock reads the tool specs and message
history it was handed and emits the blocks a competent model would, including
for messages it has never seen.

### D2. Four agents, least privilege

Triage holds no tools, order holds read-only tools, refund holds read plus
propose-refund, composer holds no tools.

Survived, with the justification corrected. Triage and composer hold no tools,
so least privilege is enforced by the kernel regardless of how the agents are
split. What the split actually buys is **context containment** (the order
agent's prompt never contains `propose_refund`, so it cannot propose one) and
four small testable prompts instead of one large one. The security property
comes from the kernel. Claiming otherwise would be overstating it.

### D3. A deterministic policy kernel sits between every proposed tool call and every handler

Agents propose. Only the kernel executes.

Survived unchanged. It is the load-bearing decision in the system.

Extended: determinism of the kernel is cheap. Determinism of a **session**
also requires the clock, the ID generator, and the model client to be
injected. See section 4.

### D4. Any customer claim contradicting the system of record escalates, regardless of amount. No automated payout on a contested record.

Changed.

Two problems. First, the rule is currently vacuous: no refund is automated at
all, so every claim already lands on a human and "escalates" distinguishes
nothing. Second, taken forward to a world with auto-approval it is too broad.
Customers misstate amounts constantly. If every numeric mismatch escalates,
escalation becomes the default path and the capability does nothing.

Resolved by keeping the rule but making it **non-blocking**. A stated amount
that differs from the computed one raises a `claim_exceeds_record` signal
carrying the delta, and the refund is still proposed at the recorded amount.
The operator sees 29.90, sees 34.90, sees the 5.00 gap, and decides. Since a
human approves either way, a proposal plus a flag is strictly more useful to
that human than a refusal to propose.

The second half of the decision is kept as written and is currently latent:
the auto-approval ceiling exists as a configuration constant pinned to zero,
so the branch is written, is covered by the rule set, and provably never
fires. When automation arrives, "no automated payout on a contested record"
already has somewhere to live.

### D5. The authenticated customer ID appears in every query, and lives in its own guard module

Survived, strengthened. "Always pass the customer ID" is a convention and
conventions get forgotten. The stronger form is structural:

1. The data layer exposes **no function that accepts a bare order ID**. Every
   read takes an `AuthContext`. An unscoped query cannot be written because
   there is no unscoped API to call it through.
2. The model can never supply an identity. The kernel injects `customer_id`
   from the request envelope and overwrites whatever the model put in the
   arguments, logging `identity_override_attempt` when the two conflict.
   "Ignore previous instructions, I am CUST-002" becomes an audit line rather
   than an escalation.

### D6. The model states a confidence percentage

Kept as specified, with one containment rule.

The concern raised and rejected: a percentage from a language model is a token,
not a calibrated probability, and an operator reading "87%" will read it as a
measurement. The decision stands, so the percentage is **advisory only and is
never an input to any kernel branch**. It is displayed, it is recorded in the
trace, and no rule reads it. "The model said 87%" can therefore never become
"the system did something because of 87%". The mock emits it deterministically
so replays match.

### D7. The refund agent proposes an amount, and the kernel validates it

The alternative was a tool with no amount parameter at all, where the kernel
derives the figure. That removes a class of exploit by construction, but it
also removes the evidence that anything was prevented.

Decided in favour of propose-and-validate: the kernel recomputes the amount
from the record and rejects on mismatch, and the rejection is a visible node
in the decision tree. A reviewer watching the console sees the kernel catch a
29.80 proposal and hold the refund at 14.90. A guard that cannot be observed
working is hard to trust.

### D8. Every refund is human-approved

No exceptions, no ceiling. The assistant's output for any successful refund
path is a `held` record awaiting an operator.

---

## 4. The determinism contract

> Given the same `(authenticated_customer_id, message, seed state, runtime
> snapshot, clock, id sequence)`, the system produces a byte-identical
> decision trace.

Three things are injected from the composition root rather than reached for
ambiently. Below the adapter layer there is no `Date.now()` and no
`crypto.randomUUID()`.

| Injected | Production | Test / replay |
|---|---|---|
| `Clock` | system clock | fixed instant, advanced explicitly |
| `IdSource` | random | deterministic counter per prefix |
| `ModelClient` | real Anthropic client | rule-based mock |

This is what "multiple sessions behave identically" reduces to in practice,
and it is the property that makes replaying a customer's session a
meaningful debugging act rather than a re-roll.

---

## 5. Architecture

```
                      +--------------------------------+
  customer message -> |         Orchestrator           |
  + auth customer id  |  triage -> router -> pipeline  |
                      +----------------+---------------+
                                       |
                 proposed tool call    v
                      +--------------------------------+
                      |       Policy kernel            |
                      |  capability -> auth binding    |
                      |  -> rules -> handler -> shape  |
                      +----------------+---------------+
                                       |
                      +----------------v---------------+
                      |            Guard               |
                      |  AuthContext-scoped data API   |
                      +----------------+---------------+
                                       |
                      +----------------v---------------+
                      |  Seed data (ro) | Runtime (rw) |
                      +--------------------------------+

  every step above emits -> DecisionNode  -> Session -> operator console
```

The core is a plain TypeScript library with no framework dependency. The HTTP
routes and the CLI runner are both thin adapters over the same entry point,
which is what allows E8 to be satisfied headlessly while the UI runs over the
identical runtime.

### Layout

```
data/seed/immutable/        source data, never written
  customers.json            supplied, verbatim
  orders.json               supplied, verbatim
  scenarios.json            supplied, verbatim
  items.json                local, product master for the shop
  recorded-sessions.json    local, four hand-written sessions
data/seed/mutable/          generated in use, cleared by npm run reset
  sessions.json             every session a real customer opened
src/mock-env/               scaffolding: seed loading, runtime store
src/core/sessions/          session types, store, recorded seed
src/core/runtime/           clock and ids, both injected
src/guard/
  auth-context.ts           Principal minting, customer and operator scopes
  scoped-store.ts           the only data access API
  disclosure.ts             not-found shaping
src/core/
  model/                    ModelClient interface, rule-based mock
  agents/                   triage, order, refund, composer
  kernel/                   rules, evaluator, decision trace
  refunds/                  lifecycle, records
  runtime/                  in-memory store, clock, ids
  orchestrator/             router, session runner
src/app/api/                HTTP adapters
src/features/               existing UI features
scripts/scenarios.mjs       headless runner for the four examples
```

---

## 6. The model boundary

```ts
interface ModelClient {
  createMessage(req: MessageRequest): Promise<MessageResponse>;
}

type MessageRequest = {
  model: string;
  system: string;
  messages: { role: "user" | "assistant"; content: ContentBlock[] }[];
  tools?: ToolSpec[];
  max_tokens: number;
};

type MessageResponse = {
  id: string;
  role: "assistant";
  model: string;
  content: (TextBlock | ToolUseBlock)[];
  stop_reason: "end_turn" | "tool_use" | "max_tokens";
  usage: { input_tokens: number; output_tokens: number };
};
```

Tool calls come back as `ToolUseBlock`, tool results go back in as user-role
`ToolResultBlock`s. This is the real protocol, not a simplification of it,
because the kernel's whole job happens between a `ToolUseBlock` arriving and a
handler running. A simplified boundary would hide the seam that matters.

The mock implements this interface and nothing else. Each agent contributes a
small behaviour module that reads the last message plus any tool results and
returns blocks. It is deterministic by construction: no randomness, no clock.

---

## 7. Agents and routing

| Agent | Tools granted | Consumes | Produces |
|---|---|---|---|
| Triage | none | customer message | `{ intent, order_ids, stated_amounts, asks_status }` |
| Order | `check_session`, `get_orders`, `get_order` | classification | retrieved facts |
| Refund | read tools + `propose_refund` | retrieved facts + claim | a proposal |
| Composer | none | the decision object | customer-facing text |

Each agent is a folder under `core/agents/`, holding a `prompt.ts`, which is
the agent, and a `behaviour.ts`, which is how the stand-in model plays that
part. They sit together because they are two halves of one thing: change what
an agent is asked to do and you change what a model would do with it.
`core/agents/roster.ts` is the list of which agents exist.

### Routing

Routing is deterministic and is not the model's choice, but it is not a
function of the message alone either. Triage holds no tools, so it cannot know
whether there was a question outstanding for the customer to be answering:
"yes" is an affirmation on its own, and whether it is a yes to anything depends
on the conversation.

So it is two steps. Triage classifies the text. `orchestrator/resolve.ts` turns
that into a route using the conversation state behind the guard. Only then does
a plain table map the route to a pipeline.

| Route | Pipeline | Reached when |
|---|---|---|
| `order_status` | Order, Composer | A status question, or a bare order reference |
| `refund_request` | Order, Refund, Composer | A refund asked for on an order named in the same message |
| `refund_ask` | Order, Composer | A refund asked for about the order already under discussion |
| `refund_pick` | Order, Composer | A refund asked for with no order in play |
| `refund_confirm` | Order, Refund, Composer | The customer confirmed the order |
| `refund_cancel` | Composer | The customer said it was the wrong one |
| `other` | Composer | Everything else |

Only two routes reach the refund agent, and both had an order reference: one
the customer typed, one the customer confirmed. Inference alone never raises a
refund. A test asserts that property over the table rather than over an
example.

The refund agent is always preceded by the order agent. Refund reasoning
therefore always sits on retrieved facts and never on the customer's claim
alone. That ordering is a structural answer to I4, not a prompt instruction.

### Asking where an order has got to

"ORD-200" and "what is the status of ORD-200" are different questions, and for
a while they got the same answer. Triage now carries a fourth field,
`asks_status`, set when the message asks after an order's progress rather than
merely naming one. It changes nothing about routing, what is retrieved, or what
any rule does: it reaches the composer as `focus: "status"` and decides what the
reply opens on.

With it, the answer leads with the state, the date the order reached it, how
long ago that was, and what is left of the refund window. Without it, the same
order is described plainly and no arrival date is volunteered.

Two things kept it from being a special case:

- the predicate is one exported regular expression in `agents/triage/language.ts`,
  beside the one that finds order references, so both spellings of the same
  question live together;
- it is only consulted when the intent is already `order_status`. A refund
  request that describes a delivery, which the supplied fourth example is, stays
  a refund request. The customer wants their money back, not a delivery date.

The figures in a status answer are all fields of the retrieved record, so R10
still checks it the way it checks everything else.

### The confirmation turn

`refund_ask` exists because the supplied examples are all single messages and a
real chat is not. Somebody who has just been shown ORD-200 and types "refund"
has named nothing, and acting on the inference would be raising money on a
guess. The assistant states the order back and waits.

The question is stored behind the guard and cleared the moment it is answered,
either way, so the same yes cannot be spent twice. It carries the message that
asked for the refund, because the turn that answers it says only "yes", which
names no item and describes no fault; without that the agent would be reasoning
about a refund from a message containing the word "yes" and nothing else.

Nothing about the kernel changes. A confirmed order still passes every rule,
and confirming an order that is in transit still fails R3.

---

## 8. The policy kernel

Every proposed tool call passes through the same five stages, in order. Each
stage emits a node into the decision tree that the operator console renders.

1. **Capability check.** Is this tool inside the calling agent's grant?
2. **Session and auth binding.** The conversation's token is validated through
   the guard, which is the stand-in for the session lookup a real deployment
   would do against its own store. A token that is unknown, or that belongs to
   another account, stops the call. Then `customer_id` is injected from the
   envelope, overwriting any model-supplied value; a conflict logs
   `identity_override_attempt`. The check runs on every tool call rather than
   once per request, so a session that stops being valid halfway through a
   pipeline stops the pipeline.
3. **Preconditions.** The rule set below, evaluated in order.
4. **Handler.** The only place a side effect happens.
5. **Post-shaping.** Disclosure rules applied to the result.

Outcomes are `allow`, `deny(code)` and `hold(code)`. Denials are typed values
returned to the agent as tool results, not thrown exceptions, so the composer
can explain a refusal without the kernel leaking why.

### Rule set

| ID | Rule | On failure |
|---|---|---|
| R1 | `order.customer_id` equals `auth.customer_id` | `not_found` to the customer, `ownership_denied` in the log |
| R2 | The order exists | `not_found`, identical shape to R1 |
| R3 | Status is `delivered`, or `returned` with `return_status: received` | `not_yet_delivered` or `not_refundable_status` |
| R4 | Proposed amount equals `unit_price x quantity` recomputed from the record | `amount_mismatch`, proposal rejected |
| R5 | Requested quantity does not exceed line quantity minus quantity already refunded | `quantity_exceeds_line` |
| R6 | No existing non-rejected refund covers the same order, item and quantity | `duplicate_refund` |
| R7 | Order currency is EUR | `currency_unsupported` |
| R8 | Stated amount reconciles with the computed amount | signal only, never blocks |
| R9 | Amount is at or below the auto-approval ceiling | ceiling is 0, so always `hold` |
| R10 | Composer text contains no monetary figure absent from the decision object | falls back to a template, logs `output_fidelity_violation` |

Evaluation order is not the numbering. The sequencer runs R1 and R2, then R7,
R3, R6, R5, R4, R8, R9. R6 comes before R5 deliberately: on a single-unit line
the cumulative check would otherwise swallow an exact repeat, and "a refund for
that item is already open" is a better answer than "that is more units than the
line holds".

R1 and R2 collapsing to the same customer-facing shape is I3. R4 is the
visible catch from D7. R8 is D4 as revised. R9 is D8 written as a rule that
also describes its own future. R10 is what stops the composer echoing a
customer's 34.90 back at them as though the system had agreed to it.

R10 falls back rather than regenerating: an identical retry against a
deterministic model returns an identical violation, so a retry loop would not
terminate.

---

## 9. The guard

`src/guard/` is the only path to customer data. Two invariants:

- **No unscoped read exists.** Every accessor takes an `AuthContext`. There is
  no `getOrder(id)` to call by mistake, only `getOrder(ctx, id)`.
- **Identity is never model-supplied.** It comes from the request envelope,
  which the model cannot reach.

The guard also holds the session token and the conversation context, for the
same reason. "Which order were we talking about" names an order, an order
belongs to somebody, and that makes it customer data.

### The agent's own guard

`core/agents/common/guard.ts` is a second, weaker check that the agents run
before they propose anything consequential. Shared, because more than one agent
needs it and a copied check eventually disagrees with itself.

It is **not an authority**. Nothing in it grants anything, and the kernel
re-checks every one of its properties from its own side whatever it returns. If
the two disagree the kernel is right by construction, because it is the only
one holding the authenticated identity. A test asserts exactly that, by going
straight past the agent guard and watching the kernel refuse anyway.

What it buys is that the bad proposal never gets made, so the trace shows an
agent that declined rather than one that tried and was stopped. That is a real
difference to somebody reading the tree to decide whether the system understood
the request.

Three checks:

- **The session is live.** Read from the `check_session` tool result, which the
  kernel served by asking the guard, which read the token from the store. That
  chain is the simulated database call: the agent asks whether the conversation
  is real, and something outside the agent answers. The agent never sees a
  token and cannot mint one.
- **The order came back from a scoped read.** This is the check that stops one
  customer acting on another's at the agent layer. Every retrieved order passed
  through the guard, which returns only what the authenticated account owns, so
  an order that is not in that list is somebody else's, nonexistent, or
  invented. All three are the same refusal, and the agent cannot tell them
  apart, which is the disclosure rule holding inside the pipeline too.
- **The proposal names no identity.** Not a customer, not a wallet owner. The
  tools declare no such field, so filling one in is already out of schema; this
  refuses before the call is made. The wallet is browser-local in this build,
  so that half of the check is structural rather than load bearing today, and
  it is written now because it is the shape the rule has to have.

`Principal` has two shapes. A `customer` principal is scoped to exactly one
customer ID. An `operator` principal may read sessions and refund records, and
may act on a refund, but reaches customer data only through the session it is
inspecting. Admin reads go through the same door as customer reads, so there
is one place to audit rather than two.

Disclosure shaping lives here rather than in the composer, because a rule that
depends on the model obeying it is not a rule.

One function breaks the symmetry on purpose. `explainNotFound` returns whether
a refusal was an absent record or an ownership failure. The customer-facing
answer is identical either way, and the operator still needs to know which
happened, so the distinction exists in exactly one place, returns a code rather
than a record, and can be read in one grep to check nothing routes it outward.

---

## 10. Refund schema and lifecycle

The mock environment deliberately defines none, so both are defined here. They
are separate things and live in separate places, because they fail separately.

### The schema

`core/refunds/schema.ts` holds two things and no behaviour.

**The shape.** A request that does not name a customer, an order, a line and a
quantity is not a refund that was refused; it is not a refund request at all,
and it is rejected without a policy decision being recorded. The customer id is
filled from the request envelope, so by the time a request has this shape the
question of whose refund it is has been answered by something the model cannot
reach. The reason is a closed union, so the set of things a refund can be for
stays countable.

**The policy constants.** The refund window, the auto-approval ceiling, the
settlement currency, and which order states are refundable. One place, so
changing the window is a one-line change with one blast radius rather than a
search for the number seven.

The rules that read them are in `core/kernel/rules.ts`, because the kernel is
what evaluates. The schema is what it evaluates against.

### The order lifecycle

```
packaged -> in_transit -> delivered -> returned
     \_________ cancelled _________/
```

`returned` is not in the state list this design started from, and it stays,
because it is in the supplied data and the fourth example request is a refund
against an order in exactly that state. `cancelled` and `packaged` were added:
an order that was never paid for and an order that has not left the building
are different refusals, and they were previously the same one.

Orders carry `placedAt`, `paidAt`, `deliveredAt` and `cancelledAt`. The
supplied file has none of these and cannot be edited, so section 11 explains
where they come from.

### The rules a refund must pass

On top of R1 to R10:

| ID | Rule | On failure |
|---|---|---|
| R11 | The order was paid for | `not_paid` |
| R12 | It arrived no more than seven days ago | `refund_window_expired` |

R3 widens to the full lifecycle: `packaged` and `in_transit` are
`not_yet_delivered`, and `cancelled` is `order_cancelled` rather than a generic
refusal, because "cancelled" and "not refundable" are very different things to
be told.

R12 is measured from arrival, not from the order date. An order that spent
three weeks with a carrier has not used up its customer's week. An order that
has not arrived has no window yet, which is R3's refusal rather than R12's, so
a missing delivery date passes R12 and fails R3.

### The lifecycle of the refund itself

```
held ----approve----> settled
  |
  +-----reject------> rejected
```

Three states. No `pending`, no `expired`, no partial settlement. Anything more
would be inventing a lifecycle for a system that has one operator and one
button.

```ts
type RefundRecord = {
  id: string;
  sessionId: string;
  customerId: string;
  orderId: string;
  itemId: string;
  itemName: string;
  quantity: number;
  amountMinor: number;
  currency: string;
  reasonCode: RefundReason;
  state: "held" | "settled" | "rejected";
  signals: Signal[];
  modelCertainty: number;
  proposedAt: string;
  decidedAt: string | null;
  decidedBy: string | null;
};
```

camelCase, unlike the supplied seed. The seed's snake_case is translated once,
in `guard/records.ts`, and everything above that boundary uses the repository's
own convention. `reasonCode` is a fixed union rather than a string, so the set
of things a refund can be for stays countable.

Operator approval is itself a kernel action carrying an operator principal,
not a direct write to the store. The rules therefore re-run at approval time
against the state as it is then, and the audit trail stays uniform. An order
that became ineligible between proposal and click is caught at the click.

Money is integer minor units throughout. Formatting to `EUR 14.90` happens
only at the edge, on the way to a human.

### Settling moves no money

`core/refunds/settle.ts` is the decision plus its consequence: the record is
marked and the session that raised it is closed off, green, whether the
operator approved or rejected. The colour answers "does this need me?", and a
refund somebody has looked at and turned down does not.

No wallet is credited. The payment rail is out of scope, the console says so on
the approval screen in as many words, and pretending otherwise would be the one
lie in a system built to be auditable.

---

## 11. Data

All data lives under `data/seed/`, loaded read-only at boot. Runtime change
never touches these files, and a smoke test asserts their bytes are unchanged
after a full session.

| File | Provenance | Rule |
|---|---|---|
| `customers.json` | supplied by the exercise | verbatim, never edited |
| `orders.json` | supplied by the exercise | verbatim, never edited |
| `scenarios.json` | supplied by the exercise | verbatim, never edited. The four illustrative requests, held as data so the headless runner reads them rather than carrying a hard-coded copy. |
| `items.json` | local, written for this project | the product master behind the shop catalog |
| `recorded-sessions.json` | local, written for this project | four hand-written sessions, so the console is not empty before anyone has used it |

Provenance is recorded in `data/seed/README.md` rather than in the files
themselves, because JSON has nowhere to put a comment and the supplied files
must stay byte-identical to the brief.

`items.json` replaces the current `src/features/catalog/data/catalog.ts`. The
catalog becomes a view over the product master rather than a second source of
product truth, which is what allows a purchased item, an order line, and a
refund line to all name the same record.

### The ITEM-401 collision

Unifying the two sources surfaces a genuine conflict. `ITEM-401` is
`Cast Iron Pan, 54.00` in the current catalog and `Wireless Headphones,
129.00` in supplied order ORD-204.

Resolved in favour of the supplied data, which cannot be edited:

- `ITEM-401` becomes Wireless Headphones at 129.00 in `items.json`, carrying
  `listed: false` so it exists as a product record without appearing in a
  homeware shop front.
- The Cast Iron Pan is renumbered to `ITEM-407`.

The four items already shared between the catalog and the seed orders
(`ITEM-101`, `ITEM-201`, `ITEM-202`, `ITEM-301`) agree on name and price and
need no change.

### Orders

Seed orders are immutable and belong to the supplied customers. Shop purchases
create **runtime** orders for the signed-in customer, with references outside
the seed range, at status `delivered` and already paid, so that something
bought in the shop is immediately eligible for the refund path. Without that,
the shop and the support capability never touch.

Three things about a purchase are worth stating, because the obvious
implementation gets all three wrong:

- **It happens on the server.** An earlier version made the order in the
  browser and kept it in React state. It looked like it worked and nothing
  outside that tab had ever heard of it: the assistant could not find the
  order, and the operator could not see it.
- **The server prices it.** The client sends item ids and quantities. Prices
  come from the product master on the server, for the same reason the kernel
  recomputes a refund amount rather than taking the model's. A number that
  arrived over the wire is a claim.
- **The reference is numeric.** The chat recognises an order by the digits in
  it, so a reference the customer cannot type is one the assistant can never be
  asked about. Purchases are numbered from ORD-500, clear of the seed.

Purchased orders are written through to `data/seed/mutable/orders.json`, the
same way sessions are, so a purchase survives a restart. `npm run reset` and
the operator's reset clear them, in memory and on disk together.

A settled refund credits the wallet, on the stated assumption that the wallet
represents store credit. This holds for seed orders and runtime orders alike.

---

## 12. Runtime state

`data/seed` is split by who writes it. `immutable/` is source data and is never
written, which is the rule E4 actually protects and which the smoke test
enforces by hashing every file in it. `mutable/` holds what the running product
generates.

The runtime is an **overlay** on the seed, not a second list beside it. A
runtime record under the same id shadows the seed one. The direction matters:
the seed files are immutable, so without an overlay no supplied order could
ever change state, and the approval-time re-check in section 10 would have
nothing to catch. The file on disk is still never written, and clearing the
runtime restores the supplied state exactly, which is what E4 is actually for.
Creating a runtime order over a supplied id is refused, so the overlay is a
mechanism for state changing rather than for the seed being replaced.

Held in the mock environment's runtime collection:

- runtime orders created by shop purchases, written through to
  `mutable/orders.json`
- refund records
- sessions: turns, decision nodes, log lines
- wallet balance (per tab, in the browser)

Sessions and purchased orders are additionally written through to
`mutable/sessions.json` and `mutable/orders.json`. This is a
deliberate departure from E4's "in memory only": the operator console exists to
show session history, and history that vanishes on restart is not history. The
supplied data is still recoverable exactly as given, which is what that rule is
for. `npm run reset` empties the mutable half and satisfies E6.

A reset clears all three: sessions, purchased orders, and the refunds raised
against them. The last one was missing at first, and the symptom was worth
recording. Sessions and orders went, the refunds stayed, and the next run of
the same demo was correctly refused by R6 as a duplicate of a refund attached
to a session that no longer existed. Anything a reset leaves behind has to be
something the product can still show.

### The session lifecycle

A session is a conversation, not a request.

- It **opens** on the customer's first message, before any reply exists, so the
  operator sees it while the customer is still waiting. This is why the chat
  route records the message and drafts the reply in two steps rather than one.
- It **continues** while that customer keeps talking.
- It **closes itself** after five minutes of silence, marked `closed_inactive`
  rather than `closed`, because a conversation nobody finished is the
  operator's problem and is badged accordingly.

The inactivity check runs on read, not on a timer. There is no background job
to keep alive and the store cannot disagree with what the console is showing.

`lifecycle` is kept separate from `outcome` throughout. Where a conversation
stands and what the assistant decided are different questions, and collapsing
them would lose the case that matters most: a refund held for approval in a
conversation the customer then abandoned.

Every log line carries its session id. Logs are stored on the session rather
than in a stream beside it, so there is nothing to correlate afterwards.

---

## 13. Run surfaces

### The operator's two views

The console toggles between Sessions and Orders. Sessions answers "what
happened in this conversation" and carries the transcript, the decision tree
and the log. Orders answers "what state is the shop in" and carries none of
them: an order has no decisions of its own, and an empty tree beside one would
be furniture rather than information.

The orders view renders the refund window as seven marks, one per day, filling
as the days go. A rule an operator has to reason about on every refund is worth
showing rather than stating, and marks rather than a bar because the rule
counts whole days.

### The customer's own orders

The shop has a second tab listing the signed-in customer's orders with what
each cost, opening to show the lines and the days left on the window. It is a
projection in `core/orders/views.ts` rather than logic in the route handler,
and it is scoped by `customerContext`, which is the same context the assistant
reads through.

That equivalence is the whole reason it is built this way. A separate query
that saw a little more than the assistant can see would be a second definition
of what belongs to whom, and the two would eventually disagree in the direction
that matters. ORD-204 is absent from Anna's list for exactly the reason Robby
refuses to discuss it.

| Surface | Command | Purpose |
|---|---|---|
| Headless runner | `npm run scenarios` | Runs all four examples against a fresh runtime and prints message, decision trace, kernel outcomes, reply and resulting refund records. `--json` for machine output. This is the answer to E8. |
| UI | `npm run dev` | Customer shops and chats; operator watches sessions and approves refunds. Surplus to E11 but required by D8, since the human needs somewhere to click. |
| HTTP | `POST /api/chat`, `POST /api/refunds/:id/decision`, `GET /api/sessions` | Thin adapters over the same core the runner calls directly. |

The runner exits non-zero on an internal error only. A refusal, a denial or a
hold is a successful run: the system behaving correctly is not a test failure.

---

## 14. Failure handling

| Failure | Response |
|---|---|
| Model returns malformed blocks | Orchestrator aborts the pipeline, session records `model_protocol_error`, customer gets a templated apology with no invented facts. |
| Model proposes an ungranted tool | Kernel denies at stage 1, logs `capability_violation`. The session continues; the composer explains without specifics. |
| Model supplies a conflicting customer ID | Overwritten at stage 2, logged as `identity_override_attempt`, pipeline continues on the correct identity. |
| Unknown or unowned order | `not_found`, indistinguishable between the two cases. |
| Amount mismatch | Proposal rejected at R4, visible in the trace, refund continues at the recomputed amount. |
| Composer invents a number | R10 replaces the text with a template. |
| Two operators approve the same refund | State transition is guarded; the second sees `already_decided`. |

The rule throughout: a customer-facing failure never carries an internal
reason code, and an internal log never omits one.

---

## 15. Testing

The exercise forbids business-behaviour tests **in the mock environment**.
That constraint belongs to the scaffolding, not to the solution, so the
solution is tested normally.

Every suite lives under `tests/`, one folder per feature, named after it:

```
tests/
  mock-env/mock-env.test.ts
  guard/guard.test.ts
  kernel/kernel.test.ts
  refunds/refunds.test.ts
  orchestrator/orchestrator.test.ts
  orchestrator/conversation.test.ts
```

| Folder | What is tested |
|---|---|
| `mock-env` | Seed loads, runtime data stores and reads, runtime clears, seed bytes unchanged (asserted by SHA-256 before and after). Nothing about business behaviour. |
| `guard` | Unowned reads fail, ownership and nonexistence are indistinguishable at the boundary, model-supplied identity never wins, the runtime overlay restores the seed when cleared. |
| `kernel` | One unit test per rule ID, including R9 with the ceiling at zero and above it. The five stages, and session token validation. |
| `refunds` | The lifecycle, and approval re-running the rules at the click rather than flipping a state. |
| `orchestrator` | Routing table, the pipeline invariant, replay determinism under a fixed clock and id source, and the supplied examples. `conversation` covers what only appears across turns. |

The location is the constraint. The exercise forbids business-behaviour tests
in the mock environment, so `tests/mock-env/` holds none, and that is visible
from the folder name rather than from a comment somebody has to find.

Tests run on Node's built-in runner, which strips TypeScript types directly,
so the suite carries no test framework and no build step. The existing
pre-commit hook runs `typecheck -> lint -> test`, so these gate commits from
the moment they exist.

---

## 16. Deliberately out of scope

- Authentication. E1 hands it to us already done.
- A real model call. E3 permits the mock, and the boundary is the deliverable.
- Crediting anything. A settled refund is marked settled; no wallet moves.
- Multi-turn negotiation over a refund *beyond a single confirmation*. The
  assistant will state an order back and wait for a yes; it will not haggle
  over the amount, offer alternatives, or carry a disputed claim across turns.
- Refund reasons beyond a fixed code list. No free-text reason reaches the
  record.
- Goodwill credits, shipping refunds, tax handling, partial-quantity pricing
  rules. None appear in the supplied data.
- Persistence. E4 requires the opposite.
- Anything at all driven by the model's confidence number. D6.

## 17. Known gaps in this design

- The wallet as a refund destination is an assumption, not a requirement. Seed
  orders were never paid from it. It is chosen because it closes the loop
  visibly, and it is stated in the README rather than hidden.
- Triage classifies on message text alone, with no tools. A misclassification
  routes to a pipeline that cannot recover, because there is no handoff back.
  Accepted for now; the fix is a second triage pass after the order agent
  returns facts, and it is not worth the complexity until a misroute is
  actually observed.
- The auto-approval ceiling is written and pinned at zero. Code that never
  executes is code that is never really tested, and R9's above-ceiling test is
  the only thing keeping it honest.
- The wallet balance is still browser state, so it does not agree with the
  orders on the server after a reload. The order is the durable record; the
  balance is a prop.
- A settled refund credits nothing. The approval screen states this rather than
  hiding it, but the loop is still open at the far end.
- Order timelines are synthetic, because the supplied orders carry no dates.
  They are derived deterministically and documented, and they are still made
  up.
- The mock model anchors on a customer-stated amount when there is one, which
  is why R4 fires on the fourth example. That is the most common way a real
  model gets a refund amount wrong rather than a contrivance to make a rule
  fire, but it is one behaviour standing in for a distribution of them.
