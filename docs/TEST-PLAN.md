# Test plan

Everything to run before committing, in the order it is worth running. The
first two sections are automated and take seconds. The third is the live chat,
which is the only place the multi-turn behaviour can actually be seen.

Start from a clean environment:

```bash
npm run reset      # clears generated sessions, leaves the supplied data alone
```

---

## 1. Automated. `npm run verify`

Typecheck, then lint, then 143 tests. Expect `pass 143`, `fail 0`, and no lint
warnings.

Every suite lives under `tests/`, one folder per feature, named after it. There
is one place to look, and the runner refuses to start if a test file has drifted
back into `src/`.

```
tests/
  mock-env/mock-env.test.ts
  guard/guard.test.ts
  agents/agents.test.ts
  kernel/kernel.test.ts
  refunds/refunds.test.ts
  refunds/schema.test.ts
  orders/orders.test.ts
  orchestrator/orchestrator.test.ts
  orchestrator/conversation.test.ts
  orchestrator/status.test.ts
```

| Suite | Tests | What it holds the line on |
| --- | ---: | --- |
| `mock-env` | 7 | Seed loads, runtime stores and clears, and the supplied files are byte-identical afterwards (SHA-256 before and after). Nothing about business behaviour, because the brief forbids that here. |
| `guard` | 13 | Ownership, and that an unowned order is indistinguishable from a nonexistent one. The runtime overlay, and that a purchase cannot shadow supplied data. |
| `agents` | 11 | The guard the agents run before proposing: the simulated session lookup, that an order no scoped read returned cannot be acted on, and that the kernel refuses the same things anyway. |
| `kernel` | 28 | One test per rule R1 to R10, both sides of R9's ceiling, the five kernel stages, session tokens, and that the model's amount never becomes the refund's amount. |
| `refunds` | 12 | The human half: approval re-runs the rules at the click, two operators cannot both decide, a rejection frees the line again, deciding either way closes the session green, and a reset takes the raised refunds with it. |
| `refunds/schema` | 17 | The request shape, and the policy: the order lifecycle, R11 payment, R12 the refund window measured from arrival. |
| `orders` | 16 | Buying: the server prices the basket, references are typable and do not collide, and what was bought is visible to the buyer, the operator and on disk. The two order views, and that a customer's own list never carries an account id or somebody else's row. |
| `orchestrator/orchestrator` | 13 | The routing table, the pipeline invariant, replay determinism, and the four supplied examples. |
| `orchestrator/conversation` | 17 | Across turns: what "that order" refers to, what "yes" is a yes to, and what happens when it is a yes to nothing. |
| `orchestrator/status` | 9 | The status keyword: what counts as asking where an order has got to, what does not, and that the answer carries the state, the arrival date and the days the rule would allow. |

Run one suite on its own while working on it:

```bash
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test tests/kernel/kernel.test.ts
```

## 2. Automated. `npm run scenarios`

The four supplied examples end to end, plus two runs they do not cover. Fixed
clock and id source, so two runs are byte-identical and a diff means something
changed.

```bash
npm run scenarios              # readable, with the full decision trace
npm run scenarios -- --json    # the same as one JSON document
npm run scenarios -- scenario-02
```

Expect eight runs:

| Run | Outcome | The thing to check |
| --- | --- | --- |
| scenario-01 | `ok` | Answered with carrier and tracking. No refund. |
| scenario-02 | `hold` | **EUR 14.90**, not 29.80 and not 54.80. One broken glass out of a line of two. |
| scenario-03 | `blocked` | `not_found`. The reply must not contain ORD-204, or the words permission, allowed, or another customer. |
| scenario-04 | `hold` | R4 **blocked**, holding at EUR 29.90 against the model's 34.90. R8 notes the EUR 5.00 gap. The reply must not contain 34.90. |
| scenario-02 replayed | `blocked` | R6 `duplicate_refund`. No second payout. |
| conversation turn 1 | `ok` | `order-200` is read as a lookup and answers with the order. |
| conversation turn 2 | `info` | `refund` asks for confirmation. **No refund is raised on this turn.** |
| conversation turn 3 | `hold` | `yes` raises it. |

Then check the refusals the new rules add. These are not in the supplied set,
because the supplied orders are all inside their window:

```bash
npm run dev    # then, in the chat, section 3h below
```

Two things worth reading rather than skimming, because they are the point of
the design:

- In every trace, the rules that **passed** are printed as well as the one that
  stopped things. A guard that cannot be observed working is hard to trust.
- Every tool call shows `Session check` before it runs, and `Auth binding`
  saying the customer id came from the envelope.

## 3. The live chat

```bash
npm run dev
```

Two browser windows, or two tabs:

- `http://localhost:3000/login` as **User / Test123$** for the shop and chat.
- `http://localhost:3000/login` as **Admin / Test123$** for the operator
  console.

Open the chat from the dock at the bottom right of `/shop`. Leave the console
open beside it: a session appears there on the customer's **first** message,
before the reply exists.

### 3a. The three-turn refund. This is the main one.

| Type | Expect back | Console |
| --- | --- | --- |
| `order-200` | The order, its status and its two items. | Session appears. Turn 1 in the tree, outcome Passed. |
| `refund` | "Before I raise anything, can you confirm you mean order ORD-200..." | Turn 2. **No refund record.** A `Confirmation` node saying it is waiting. |
| `yes` | A refund of EUR 14.90 for 1 x Wine Glass, held for approval. | Turn 3, outcome Held. **Amber badge on the session in the rail.** |

The amber badge is the operator notification: it means something is drafted and
waiting on a person.

### 3b. The same, with the fault described

Reset first (operator menu, Reset to default), then:

```
ORD-200
I need a refund, the decanter arrived cracked
yes
```

Expect **EUR 25.00 for 1 x Decanter**, not the Wine Glass, and a reason of
`damaged_on_arrival`. The confirmation turn carries the original request
forward, so the agent reasons about what was actually complained about rather
than about the word "yes".

### 3c. Saying no

```
ORD-200
refund
no
```

Expect "Understood, I have not raised anything." No refund record anywhere.

### 3d. Yes to nothing

In a fresh session, type `yes` as the very first message. Expect the general
greeting, and **no refund**. A bare yes with no question outstanding is not an
answer to anything, which is how a system avoids raising money because somebody
typed "ok".

### 3e. Someone else's order

```
ORD-204
```

Expect "No order with that reference is available on this account." ORD-204
exists and belongs to CUST-002. Check the console: the tree says
`ownership_denied` internally while the customer was told nothing. Then type
`refund` and confirm it offers you a choice rather than assuming ORD-204, since
nothing was established.

### 3f. Spellings

Each of these should find the same order. This is the regex, and it is what
makes the chat usable for live testing.

```
ORD-200        order 200        order-200        ord 200        #200
```

And this one must find nothing, because it is a verb:

```
I ordered 3 wine glasses last week
```

### 3g. Buying something, then asking about it

This is the join that used to be broken: the order existed only in the buyer's
tab, so the assistant could not find it.

1. On `/shop`, add a couple of items to the basket and press **Purchase**.
2. The confirmation names a real reference, `ORD-500` or higher.
3. Ask the assistant about that reference by name. It should read it back with
   the right items.
4. Ask for a refund on one of them and confirm. It is refundable immediately,
   at the price the shop charged.
5. Switch the console to **Orders**. The order is there, source
   "Created while the app was running", with a full seven days of window left.
6. `cat data/seed/mutable/orders.json` shows it on disk. Restart `npm run dev`
   and ask again: still found.
7. Reset from the operator menu. Ask again: not found.

Prices are server side. Editing one in the browser buys nothing, because the
basket only ever sends item ids and quantities.

### 3h. The refund rules, in the chat

| Type | Expect | Why |
| --- | --- | --- |
| `refund the serving platter in ORD-401, it is faulty` | Not delivered yet | R3: packaged has not arrived |
| `refund the pepper mill in ORD-402, it arrived broken` | Outside the refund window | R12: delivered 24 days ago |
| `refund ORD-403, the saucepan was damaged` | That order was cancelled | R3: cancelled has its own answer |
| `refund the chef knife in ORD-405, it is broken` | Not available on this account | R1: it belongs to CUST-002 |

### 3i. Reading the session

In the console, with a session selected:

- **Decision tree**: grouped by turn. Each turn carries what the customer said,
  and under it the full pipeline: Triage, Routing, each agent, and every kernel
  stage. Click a row's chevron for the machine payload.
- **Server log**: every line is `info` and carries its session id, so a session
  can be read end to end with nothing hidden behind a level filter. The four
  demo sessions that ship with the app keep mixed levels, so the filter itself
  still has something to demonstrate.

### 3j. Approving a refund

With a session that holds one, the amber strip above the transcript says so.
Press **Review refund**.

The panel shows the amount first, then what it is for, then every signal the
kernel raised and deliberately did not act on. Check that it states plainly
that approving moves no money, and that the assistant's confidence is labelled
advisory.

Press **Approve refund**. Then:

- the session turns **green** in the rail and is closed,
- its decision tree ends with an `Operator decision` node naming you,
- the Orders view shows the refund count against that order.

Reject does the same, green and closed, because the operator dealt with it
either way. What was decided lives on the refund record, not in the colour.

### 3k. Asking for a status

The keyword and the answer it produces.

| Type | Expect |
| --- | --- |
| `what is the status of ORD-200?` | Delivered, the date it arrived, how many days ago, and what is left of the window |
| `status ORD-100` | On its way with DHL and its tracking number, and **no** refund window, because none has started |
| `has ORD-402 arrived` | Delivered, and that the window has closed |
| `ORD-200` | The plain description again, with no arrival date. Naming an order is not asking where it is |

In the console, the Triage node's payload carries `asks_status`, which is the
one thing that makes those two answers differ.

### 3l. The customer's own orders

On `/shop`, switch to **Your orders**.

- Every order on CUST-001 is listed, newest first, with its total.
- **ORD-204 is not there.** It belongs to CUST-002, and this view is scoped by
  the same guard the chat reads through.
- Open one. Line items with their prices, and a plain sentence about the refund
  window that agrees with the day track in the operator's Orders view.
- Press **Ask Robby about it**. The chat opens with the question typed and
  waits for you to send it, so no session is opened on your behalf.
- Buy something, come back: it is at the top.

### 3m. Signing in

Two cards, one per account, selectable with the mouse or the arrow keys. The
button names the account you picked. The typed form is still there under
**Type a username and password instead**, and a wrong password there still
produces the error, which is the only reason it was kept.

### 3n. The landing page

- The hero card is a recorded session, not a live read. `/` never touches the
  session store.
- Scrolling the pipeline section fills the spine and moves the panel on the
  left through the five steps. With reduced motion on, everything is present
  and nothing moves.
- Every screenshot on the page is of this build. If a screen changes, they are
  regenerated rather than retouched.

## 4. The operator's half, over HTTP

The console covers this now, but the API is worth exercising directly for the
re-check at the click. Take a refund id from section 3a.

```bash
curl -s "http://localhost:3000/api/refunds?operatorId=op-1" | python3 -m json.tool

curl -s -X POST http://localhost:3000/api/refunds/REF-xxxx/decision \
  -H 'content-type: application/json' \
  -d '{"decision":"approve","operatorId":"op-1"}' | python3 -m json.tool
```

Expect `state: "settled"`, and a trace showing **R3 and R4 re-run at the
click**, not just a state flip. Then run the same call again and expect HTTP
409 with `already_decided`.

## 5. The seed is untouched

```bash
git status --short data/seed/immutable/
```

Expect nothing. The smoke test asserts the same thing by SHA-256, but this
catches anything that edited a file outside a test run.

## 6. Build

```bash
npm run build
```

Expect a clean compile and these routes: `/`, `/login`, `/shop`, `/console`,
and `ƒ /api/chat`, `/api/orders`, `/api/refunds`, `/api/refunds/[id]/decision`,
`/api/runtime/reset`, `/api/sessions`.

---

## Known gaps, so they are not mistaken for failures

- Nothing credits a wallet. A settled refund is recorded as settled against the
  operator who decided it, and no money moves. The approval screen says so.
- The wallet balance is browser state, so it disagrees with the server after a
  reload. The order is the durable record; the balance is a prop.
- The model is a rule-based stand-in. It reasons from the records it was
  handed, and it does generalise beyond the supplied examples, but it is not a
  language model and will not cope with a message phrased far outside the
  patterns in `src/core/agents/triage/language.ts`.
