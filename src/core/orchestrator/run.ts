/**
 * The session runner.
 *
 * One customer message in, one decision out. This is the entry point both the
 * HTTP route and the headless scenario runner call, so the UI and the
 * reviewer's command line exercise exactly the same code path.
 *
 * The shape of the run is fixed here and nowhere else: triage classifies, the
 * resolver turns that into a route using what the conversation already
 * established, a plain table maps the route to a pipeline, and the composer
 * writes the reply from the decision object rather than from the conversation.
 *
 * Nothing in this file decides policy. Every decision that matters was made by
 * the kernel before control returned here, and the conversation state it reads
 * and writes goes through the guard like any other customer data.
 */
import type {
  ComposerBriefing,
  OrderBriefing,
  RefundBriefing,
  RouteIntent,
  TriageOutput,
} from "../contracts.ts";
import { customerContext } from "../../guard/auth-context.ts";
import type { DisclosedOrder } from "../../guard/disclosure.ts";
import {
  readSessionContext,
  sessionToken,
  writeSessionContext,
  type PendingConfirmation,
} from "../../guard/sessions.ts";
import { AGENTS } from "../agents/roster.ts";
import { runAgent, type AgentRun } from "../agents/loop.ts";
import type { Envelope } from "../kernel/kernel.ts";
import { checkOutputFidelity, FIDELITY_FALLBACK } from "../kernel/output-fidelity.ts";
import { fence } from "../model/mock/briefing.ts";
import type { RefundRecord } from "../refunds/types.ts";
import { nowIso, nowMs, stamp } from "../runtime/clock.ts";
import type { DecisionNode, DecisionStatus, LogLine } from "../sessions/types.ts";
import { resolve } from "./resolve.ts";
import { route } from "./router.ts";
import { agentNode, toLogLine, toNode } from "./trace.ts";

export type SupportResult = {
  reply: string;
  outcome: DecisionStatus;
  /** One line for the sessions rail. */
  summary: string;
  route: RouteIntent;
  tree: DecisionNode[];
  logs: LogLine[];
  refunds: RefundRecord[];
};

export type SupportRequest = {
  customerId: string;
  customerName: string;
  sessionId: string;
  message: string;
};

/** Orders travel between agents as the disclosed projection, never the record. */
function ordersFrom(run: AgentRun): DisclosedOrder[] {
  const found: DisclosedOrder[] = [];
  for (const result of run.results) {
    if (!result || typeof result !== "object") continue;
    const row = result as { order?: DisclosedOrder; orders?: DisclosedOrder[] };
    if (row.order) found.push(row.order);
    if (Array.isArray(row.orders)) found.push(...row.orders);
  }
  return found;
}

const parseTriage = (text: string): TriageOutput | null => {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[0]) as Partial<TriageOutput>;
    const intents = ["order_status", "refund_request", "affirmation", "negation", "other"];
    if (typeof parsed.intent !== "string" || !intents.includes(parsed.intent)) return null;
    return {
      intent: parsed.intent as TriageOutput["intent"],
      order_ids: Array.isArray(parsed.order_ids) ? parsed.order_ids.map(String) : [],
      stated_amounts_minor: Array.isArray(parsed.stated_amounts_minor)
        ? parsed.stated_amounts_minor.filter((n): n is number => typeof n === "number")
        : [],
      asks_status: parsed.asks_status === true,
      certainty: typeof parsed.certainty === "number" ? parsed.certainty : 0,
    };
  } catch {
    return null;
  }
};

/** How an order is described back to the customer when asking "this one?". */
const describeOrder = (order: DisclosedOrder): string =>
  `order ${order.order_id}, ${order.status.replace(/_/g, " ")}, holding ` +
  order.items.map((i) => `${i.quantity} x ${i.name}`).join(" and ");

/**
 * What the customer is told when the model itself failed. It carries no facts
 * at all, because the one thing worse than an unanswered question is an answer
 * assembled from a response nobody could parse.
 */
const PROTOCOL_APOLOGY =
  "Something went wrong on my side and I could not read your order safely. " +
  "I have passed this to a colleague rather than guess at it.";

export async function runSupportRequest(request: SupportRequest): Promise<SupportResult> {
  const startedAt = nowMs();
  const tree: DecisionNode[] = [];
  const logs: LogLine[] = [];
  const refunds: RefundRecord[] = [];
  const allowedAmounts: number[] = [];

  const ctx = customerContext(request.customerId);
  const token = sessionToken(request.customerId, request.sessionId);

  /**
   * Everything the pipeline emits is logged at info. The log is a record of
   * what the system did for a given session, not a severity feed, and a level
   * that varies by outcome makes it harder to read a session end to end.
   */
  const log = (scope: string, message: string) =>
    logs.push({ at: stamp(), level: "info", scope, message, sessionId: request.sessionId });

  const record = (agent: string, run: AgentRun, detail: string, status: DecisionStatus) => {
    tree.push(
      agentNode({
        label: `${agent} agent`,
        detail,
        status,
        ms: nowMs() - startedAt,
        entries: run.entries,
      }),
    );
    for (const entry of run.entries) logs.push(toLogLine(request.sessionId, agent, entry));
    allowedAmounts.push(...run.disclosedAmountsMinor);
    refunds.push(...run.refunds);
  };

  const envelope: Envelope = {
    customerId: request.customerId,
    sessionId: request.sessionId,
    sessionToken: token.token,
    message: request.message,
    statedAmountsMinor: [],
  };

  log("session", `Token ${token.token} in use for ${request.customerId}.`);

  /* ------------------------------------------------------------- triage */

  const triageRun = await runAgent(
    AGENTS.triage,
    envelope,
    fence("A customer has written in. Classify the message.", { message: request.message }),
  );

  const classification = triageRun.error ? null : parseTriage(triageRun.text);

  if (!classification) {
    tree.push(
      toNode({
        label: "Triage",
        status: "blocked",
        detail: "The model did not return a classification this system can read. Pipeline stopped.",
        payload: { code: "model_protocol_error", raw: triageRun.text.slice(0, 200) },
      }),
    );
    log("triage", "model_protocol_error: triage returned no readable classification.");
    return {
      reply: PROTOCOL_APOLOGY,
      outcome: "blocked",
      summary: "Stopped: the model returned something unreadable.",
      route: "other",
      tree,
      logs,
      refunds,
    };
  }

  envelope.statedAmountsMinor = classification.stated_amounts_minor;

  tree.push(
    toNode({
      label: "Triage",
      status: "info",
      detail: `Read as ${classification.intent}.`,
      payload: {
        intent: classification.intent,
        order_ids: classification.order_ids,
        stated_amounts_minor: classification.stated_amounts_minor,
        asks_status: classification.asks_status,
        model_certainty: classification.certainty,
      },
    }),
  );
  log(
    "triage",
    `Intent ${classification.intent}. References ${classification.order_ids.join(", ") || "none"}.` +
      (classification.asks_status ? " Asked for the current status." : ""),
  );

  /* ------------------------------------------------ resolve and route */

  const established = readSessionContext(ctx, request.sessionId, request.customerId);
  const context = established.ok ? established.value : null;

  const resolution = resolve({
    intent: classification.intent,
    namedOrderIds: classification.order_ids,
    lastOrderId: context?.lastOrderId ?? null,
    pending: context?.pending ?? null,
  });

  tree.push(
    toNode({
      label: "Routing",
      status: "info",
      detail: resolution.because,
      payload: {
        route: resolution.route,
        targets: resolution.targetOrderIds,
        was_awaiting: context?.pending?.orderId ?? null,
      },
    }),
  );

  /** Captured before the question is cleared, because the work still needs it. */
  const answered = context?.pending ?? null;

  const pipeline = route(resolution.route);
  log("router", `Route ${resolution.route}. Pipeline ${pipeline.join(" -> ")}. ${resolution.because}`);

  /**
   * A question that has been answered, either way, is no longer outstanding.
   * Clearing it before the work runs means a failure part way through cannot
   * leave the customer able to confirm the same thing twice.
   */
  if (context?.pending) {
    writeSessionContext(ctx, request.sessionId, request.customerId, { pending: null });
  }

  /* -------------------------------------------------------------- order */

  let orders: DisclosedOrder[] = [];
  let denials: AgentRun["denials"] = [];

  if (pipeline.includes("order")) {
    const briefing: OrderBriefing = {
      message: request.message,
      order_ids: resolution.targetOrderIds,
      purpose: resolution.route,
    };
    const run = await runAgent(
      AGENTS.order,
      envelope,
      fence("Retrieve what this customer is asking about.", briefing),
    );
    orders = ordersFrom(run);
    denials = run.denials;
    record(
      "order",
      run,
      `${orders.length} order record(s) retrieved.`,
      orders.length ? "ok" : "blocked",
    );

    /** The order under discussion carries forward, so "refund that" resolves. */
    if (orders.length === 1) {
      writeSessionContext(ctx, request.sessionId, request.customerId, {
        lastOrderId: orders[0].order_id,
      });
    }
  }

  /* ------------------------------------------------------------- refund */

  if (pipeline.includes("refund")) {
    const briefing: RefundBriefing = {
      /**
       * On a confirmation turn the customer's message is "yes". What they
       * actually asked for was said a turn earlier, so that is what the agent
       * reasons about.
       */
      message: answered?.requestText ?? request.message,
      order_ids: resolution.targetOrderIds,
      stated_amounts_minor: classification.stated_amounts_minor,
      orders,
      confirmed_order_id: resolution.confirmedOrderId,
    };
    const run = await runAgent(
      AGENTS.refund,
      envelope,
      fence("Decide whether a refund should be proposed, and on what.", briefing),
    );
    if (run.denials.length) denials = [...denials, ...run.denials];
    record(
      "refund",
      run,
      run.refunds.length ? `Refund ${run.refunds[0].id} held for approval.` : "No refund raised.",
      run.refunds.length ? "hold" : "blocked",
    );
  }

  /* ------------------------------------------- the question, if any */

  let ask: ComposerBriefing["ask"];

  if (resolution.route === "refund_ask" && orders.length === 1) {
    const pending: PendingConfirmation = {
      kind: "refund_target",
      orderId: orders[0].order_id,
      orderSummary: describeOrder(orders[0]),
      requestText: request.message,
      askedAt: nowIso(),
    };
    writeSessionContext(ctx, request.sessionId, request.customerId, { pending });
    ask = {
      kind: "confirm_refund_target",
      order_id: pending.orderId,
      order_summary: pending.orderSummary,
    };
    tree.push(
      toNode({
        label: "Confirmation",
        status: "info",
        detail: `Asked the customer to confirm ${pending.orderId} before anything is raised.`,
        payload: { order_id: pending.orderId, awaiting: "affirmation or negation" },
      }),
    );
    log("session", `Awaiting confirmation of ${pending.orderId}.`);
  } else if (resolution.route === "refund_pick" || (resolution.route === "refund_ask" && !orders.length)) {
    ask = { kind: "which_order" };
    tree.push(
      toNode({
        label: "Confirmation",
        status: "info",
        detail: "No order in play, so the customer is asked to choose from their own records.",
        payload: { offered: orders.map((o) => o.order_id) },
      }),
    );
  }

  /* ----------------------------------------------------------- composer */

  const held = refunds[0];

  /**
   * A refusal is the answer only when nothing came back. Asking about two
   * orders where one is yours and one is not should tell you about yours, not
   * refuse the whole turn, and a refund that could not be raised on an order
   * that was retrieved is still a refusal about that order.
   */
  const refused = denials.length > 0 && (orders.length === 0 || pipeline.includes("refund"));

  const status: DecisionStatus = held
    ? "hold"
    : ask
      ? "info"
      : refused
        ? "blocked"
        : orders.length
          ? "ok"
          : "info";

  const composerBriefing: ComposerBriefing = {
    customer_name: request.customerName,
    intent: resolution.route,
    status: status === "hold" ? "hold" : status === "blocked" ? "blocked" : status === "ok" ? "ok" : "info",
    orders,
    /**
     * A status question gets a status answer. Only when something was actually
     * retrieved: leading with a state when no record came back would be a
     * sentence about nothing.
     */
    ...(classification.asks_status && resolution.route === "order_status" && orders.length
      ? { focus: "status" as const }
      : {}),
    ...(ask ? { ask } : {}),
    ...(refused && !held && !ask ? { refusal: denials[0] } : {}),
    ...(held
      ? {
          refund: {
            refund_id: held.id,
            order_id: held.orderId,
            item_name: held.itemName,
            quantity: held.quantity,
            amount: `${held.currency} ${(held.amountMinor / 100).toFixed(2)}`,
            amount_minor: held.amountMinor,
            state: held.state,
          },
          certainty: held.modelCertainty,
        }
      : {}),
  };

  const composerRun = await runAgent(
    AGENTS.composer,
    envelope,
    fence("Write the reply for this decision.", composerBriefing),
  );
  record("composer", composerRun, "Reply drafted.", "ok");

  /* -------------------------------------------- R10, output fidelity */

  if (held) allowedAmounts.push(held.amountMinor);
  const fidelity = checkOutputFidelity(composerRun.text, allowedAmounts);
  let reply = composerRun.text || FIDELITY_FALLBACK;

  if (!fidelity.ok) {
    reply = FIDELITY_FALLBACK;
    const entry = {
      label: "R10 Output fidelity",
      status: "blocked" as const,
      detail: `The draft stated ${fidelity.offending.length} figure(s) no decision carried. Replaced with a template.`,
      payload: { offending_minor: fidelity.offending, allowed_minor: [...new Set(allowedAmounts)] },
    };
    tree.push(toNode(entry));
    logs.push(toLogLine(request.sessionId, "composer", entry));
  } else {
    tree.push(
      toNode({
        label: "R10 Output fidelity",
        status: "info",
        detail: "Every figure in the reply came from the decision.",
      }),
    );
  }

  const summary = held
    ? `Refund held for approval on ${held.orderId}.`
    : ask?.kind === "confirm_refund_target"
      ? `Waiting on the customer to confirm ${ask.order_id}.`
      : ask
        ? "Asked the customer which order they mean."
        : resolution.route === "refund_cancel"
          ? "Customer said it was the wrong order. Nothing raised."
          : refused
            ? `Refused: ${denials[0].code.replace(/_/g, " ")}.`
            : orders.length
              ? `Answered on ${orders.map((o) => o.order_id).join(", ")}.`
              : "Answered without touching the record.";

  log("session", summary);

  return { reply, outcome: status, summary, route: resolution.route, tree, logs, refunds };
}
