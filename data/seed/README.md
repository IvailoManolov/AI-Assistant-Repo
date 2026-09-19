# Seed data

Two halves, split by who writes them.

```
immutable/   source data. Supplied by the exercise, or authored once.
             Never written by the running process.
mutable/     generated while the product is used. `npm run reset` empties
             this and nothing else.
```

The brief requires that the supplied seed data survive a restart untouched.
That rule is what `immutable/` protects, and the mock environment's smoke test
enforces it by hashing every file in it before and after a run. `mutable/`
exists because the operator console is meant to show session history, and
history that vanishes on restart is not history.

## immutable

| File | Origin | Contents |
|---|---|---|
| `customers.json` | Supplied by the brief | Reproduced verbatim. |
| `orders.json` | Supplied by the brief | Reproduced verbatim. |
| `scenarios.json` | Supplied by the brief | The four illustrative requests, kept as data so the runner reads them rather than carrying a hard-coded copy. |
| `orders-local.json` | Written for this project | Orders covering the states the supplied four do not: packaged, cancelled and unpaid, and a delivery old enough to be outside the refund window. Kept in their own file so `orders.json` stays byte-identical. |
| `items.json` | Written for this project | The product master behind the shop. |
| `recorded-sessions.json` | Written for this project | Four hand-written sessions, so the console has something to show before anyone has talked to the assistant. |

### Dates

The supplied orders carry no dates and no payment flag, and the file cannot be
edited, so the four of them get their timeline from a table in
`src/guard/timeline.ts`. Orders written for this project carry their own
offsets in their JSON. Two mechanisms for one thing is what immutability
forces: the alternative is editing the brief's data or having no timeline at
all, and the refund window is a rule that cannot exist without one.

Everything is expressed as days before now, so a reviewer opening this in a
month still finds ORD-200 inside its window rather than an environment that
quietly expired.

The supplied files carry the exact values printed in the brief, including
`ORD-204` belonging to `CUST-002` while every example request authenticates as
`CUST-001`. That mismatch is deliberate in the source and is not a typo to fix.

## mutable

| File | Written by | Contents |
|---|---|---|
| `sessions.json` | `core/sessions/store.ts` | Every session opened by a real customer message. Recorded sessions are never written back here. |

## Resetting

Two routes, both of which clear only `mutable/`:

- The operator console's menu, while the app is running. It clears the
  server's in-memory sessions and the file together.
- `npm run reset`, which uses the server when one is listening and falls back
  to clearing the files when it is not.

Clearing the file by hand while a server is running does not work: the process
still holds the sessions, and its next write restores them.

## items.json

A product master, not a catalog. It is the single place a product's name and
price are recorded, so a shop listing, an order line, and a refund line all
resolve to the same record.

`listed: false` means the product exists but is not sold in the shop front.

Prices are integer minor units (`6480` is EUR 64.80). The supplied files use
decimal majors because that is how they were given, and they are not rewritten.

### ITEM-401

Folding the shop catalog into this directory surfaced a collision. `ITEM-401`
was a Cast Iron Pan at EUR 54.00 in the shop catalog, and is Wireless
Headphones at EUR 129.00 in supplied order `ORD-204`.

The supplied data cannot be edited, so it wins. `ITEM-401` is the headphones,
carrying `listed: false` because a homeware shop does not sell them, and they
are only here so `ORD-204` resolves to a real product record. The Cast Iron Pan
was renumbered to `ITEM-407`.
