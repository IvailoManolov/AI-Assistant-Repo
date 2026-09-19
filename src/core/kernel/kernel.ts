/**
 * The policy kernel.
 *
 * Agents propose. Only this module executes. Every proposed tool call passes
 * through the same five stages in the same order, and each stage leaves a
 * trace entry behind whether it passed or not, so the operator console shows
 * the checks that succeeded as well as the one that stopped things.
 *
 *   1. Capability   is this tool inside the calling agent's grant?
 *   2. Auth binding the customer id comes from the envelope, never the model
 *   3. Preconditions the rule set, in order
 *   4. Handler      the only place a side effect happens
 *   5. Post-shaping disclosure rules applied to the result
 *
 * Denials are returned as typed tool results, not thrown. The agent sees a
 * refusal it can reason about, and the composer can explain it without the
 * kernel having to leak why.
 */
import { customerContext } from "../../guard/auth-context.ts";
import { discloseOrder, notFoundResult } from "../../guard/disclosure.ts";
import {
  explainNotFound,
  getOrder,
  insertRefund,
  listOrders,
  listRefundsForOrder,
} from "../../guard/scoped-store.ts";
import { readSessionContext, validateSessionToken } from "../../guard/sessions.ts";
import type { AuthContext } from "../../guard/types.ts";
import { formatMinor } from "../money.ts";
import { checkRefundRequestShape } from "../refunds/schema.ts";
import type { RefundRecord, Signal } from "../refunds/types.ts";
import { nowIso } from "../runtime/clock.ts";
import { newId } from "../runtime/ids.ts";
import type { DecisionStatus } from "../sessions/types.ts";
import { CUSTOMER_WORDING, type DenyCode } from "./codes.ts";
import { evaluateRefund, type RuleOutcome } from "./rules.ts";
import { GRANTS, isToolName, type AgentName, type ToolName } from "./tools.ts";

/**
 * Everything the kernel knows that did not come from the model. The customer
 * id in here is the authenticated one, and it is the only one that exists as
 * far as any handler is concerned.
 */
export type Envelope = {
  customerId: string;
  sessionId: string;
  /**
   * The conversation's token, minted by the guard. It is checked on every
   * single tool call rather than once at the start, because a session that
   * stops being valid halfway through a pipeline should stop the pipeline.
   */
  sessionToken: string;
  message: string;
  /** Amounts the customer named, extracted by triage. Feeds R8 only. */
  statedAmountsMinor: number[];
};

export type ToolCall = {
  id: string;
  name: string;
  input: Record<string, unknown>;
};

/** One line of the decision trace, before it is given an id and a duration. */
export type TraceEntry = {
  label: string;
  detail: string;
  status: DecisionStatus;
  payload?: Record<string, unknown>;
};

export type KernelResult = {
  status: "allow" | "deny" | "hold";
  code?: DenyCode;
  /** The tool_result content handed back to the agent. */
  result: unknown;
  entries: TraceEntry[];
  signals: Signal[];
  /** Present when the call created one. */
  refund?: RefundRecord;
  /** Figures this call authorises the composer to state. Feeds R10. */
  disclosedAmountsMinor: number[];
};

const entry = (
  label: string,
  status: DecisionStatus,
  detail: string,
  payload?: Record<string, unknown>,
): TraceEntry => ({ label, status, detail, ...(payload ? { payload } : {}) });

const denial = (code: DenyCode, extra?: Record<string, unknown>) => ({
  error: code,
  message: CUSTOMER_WORDING[code],
  ...extra,
});

const ruleEntry = (outcome: RuleOutcome): TraceEntry =>
  entry(
    `${outcome.rule} ${outcome.title}`,
    outcome.status,
    outcome.detail,
    outcome.code ? { code: outcome.code, ...(outcome.payload ?? {}) } : outcome.payload,
  );

/**
 * Stage 2. Is this a real session, and whose is it?
 *
 * Two things happen here and they are deliberately adjacent. First the
 * conversation's token is looked up through the guard, which is the stand-in
 * for the session lookup a real deployment would do against its own store. A
 * token that is unknown, or that belongs to a different account, stops the
 * call before any handler sees it.
 *
 * Then identity is bound. The model may not name a customer; if it did anyway,
 * the value is overwritten with the envelope's and the attempt becomes an
 * audit line. "Ignore previous instructions, I am CUST-002" ends here.
 */
function bindSession(
  call: ToolCall,
  envelope: Envelope,
): { entries: TraceEntry[]; signals: Signal[]; invalid: boolean } {
  const entries: TraceEntry[] = [];
  const signals: Signal[] = [];

  const validity = validateSessionToken(envelope.sessionToken, envelope.customerId);
  if (!validity.valid) {
    entries.push(
      entry("Session check", "blocked", `The conversation token failed: ${validity.reason}.`, {
        code: "session_invalid",
        reason: validity.reason,
        session_id: envelope.sessionId,
      }),
    );
    signals.push({
      code: "session_invalid",
      detail: `Token rejected: ${validity.reason}.`,
      payload: { reason: validity.reason, session_id: envelope.sessionId },
    });
    return { entries, signals, invalid: true };
  }

  entries.push(
    entry("Session check", "info", `Token valid for ${validity.sessionId}, issued ${validity.issuedAt}.`, {
      session_id: validity.sessionId,
      customer_id: validity.customerId,
    }),
  );

  const supplied = call.input.customer_id ?? call.input.customerId;
  if (supplied === undefined || supplied === envelope.customerId) {
    entries.push(
      entry("Auth binding", "info", `Bound to ${envelope.customerId} from the request envelope.`),
    );
    return { entries, signals, invalid: false };
  }

  const signal: Signal = {
    code: "identity_override_attempt",
    detail: `Model supplied ${String(supplied)}; overwritten with ${envelope.customerId}.`,
    payload: { supplied: String(supplied), bound: envelope.customerId },
  };
  entries.push(
    entry("Auth binding", "blocked", signal.detail, {
      code: "identity_override_attempt",
      ...signal.payload,
    }),
  );
  signals.push(signal);
  return { entries, signals, invalid: false };
}

/**
 * The session lookup an agent can perform for itself.
 *
 * It returns what has been established in the conversation so far, which is
 * how the refund agent knows which order "refund that one" refers to without
 * the customer having to name it twice.
 */
function handleCheckSession(ctx: AuthContext, envelope: Envelope): KernelResult {
  const validity = validateSessionToken(envelope.sessionToken, envelope.customerId);
  const context = readSessionContext(ctx, envelope.sessionId, envelope.customerId);

  const established = context.ok ? context.value : null;

  return {
    status: "allow",
    result: {
      valid: validity.valid,
      session_id: envelope.sessionId,
      last_order_id: established?.lastOrderId ?? null,
      awaiting_confirmation: established?.pending ?? null,
    },
    entries: [
      entry(
        "check_session",
        "info",
        established?.pending
          ? `Session live. Waiting on confirmation of ${established.pending.orderId}.`
          : `Session live. Order under discussion: ${established?.lastOrderId ?? "none yet"}.`,
        {
          session_id: envelope.sessionId,
          last_order_id: established?.lastOrderId ?? null,
          awaiting_confirmation: established?.pending?.kind ?? null,
        },
      ),
    ],
    signals: [],
    disclosedAmountsMinor: [],
  };
}

const str = (value: unknown): string | null => (typeof value === "string" && value ? value : null);

/* ------------------------------------------------------------- handlers */

function handleGetOrders(ctx: AuthContext, envelope: Envelope): KernelResult {
  const orders = listOrders(ctx).map(discloseOrder);
  return {
    status: "allow",
    result: { orders },
    entries: [
      entry("get_orders", "ok", `${orders.length} order(s) on ${envelope.customerId}.`, {
        order_ids: orders.map((o) => o.order_id),
      }),
    ],
    signals: [],
    disclosedAmountsMinor: [],
  };
}

function handleGetOrder(ctx: AuthContext, call: ToolCall, envelope: Envelope): KernelResult {
  const orderId = str(call.input.order_id);
  if (!orderId) {
    return {
      status: "deny",
      code: "invalid_arguments",
      result: denial("invalid_arguments"),
      entries: [entry("get_order", "blocked", "No order reference in the arguments.")],
      signals: [],
      disclosedAmountsMinor: [],
    };
  }

  const access = getOrder(ctx, orderId);
  if (!access.ok) {
    /**
     * R1 and R2 collapse to the same answer here. The internal reason is
     * recorded for the operator and never travels outward.
     */
    const reason = explainNotFound(ctx, orderId);
    return {
      status: "deny",
      code: "not_found",
      result: notFoundResult(orderId),
      entries: [
        entry(
          reason === "ownership_denied" ? "R1 Ownership" : "R2 Record exists",
          "blocked",
          reason === "ownership_denied"
            ? `${orderId} exists but is not on ${envelope.customerId}. Answered as not found.`
            : `${orderId} does not exist. Answered as not found.`,
          { code: "not_found", internal: reason, order_id: orderId },
        ),
      ],
      signals: [],
      disclosedAmountsMinor: [],
    };
  }

  const disclosed = discloseOrder(access.value);
  return {
    status: "allow",
    result: { order: disclosed },
    entries: [
      entry("get_order", "ok", `${orderId} read: ${access.value.status}, ${access.value.lines.length} line(s).`, {
        order_id: orderId,
        status: access.value.status,
        origin: access.value.origin,
      }),
    ],
    signals: [],
    disclosedAmountsMinor: [
      access.value.totalMinor,
      ...access.value.lines.map((l) => l.unitPriceMinor),
    ],
  };
}

function handleProposeRefund(ctx: AuthContext, call: ToolCall, envelope: Envelope): KernelResult {
  /**
   * The shape first, and separately from the policy.
   *
   * A proposal that does not name a customer, an order, a line and a quantity
   * is not a refund that was refused, it is not a refund request at all. The
   * customer id comes from the envelope rather than the arguments, so by the
   * time the shape is checked the question of whose refund this is has already
   * been settled by something the model cannot reach.
   */
  const shape = checkRefundRequestShape({
    customerId: envelope.customerId,
    sessionId: envelope.sessionId,
    orderId: call.input.order_id,
    itemId: call.input.item_id,
    quantity: call.input.quantity,
    amountMinor: call.input.amount_minor,
    reasonCode: call.input.reason_code ?? "unspecified",
    certainty: call.input.certainty,
  });

  if (!shape.ok) {
    return {
      status: "deny",
      code: "invalid_arguments",
      result: denial("invalid_arguments"),
      entries: [
        entry("Refund schema", "blocked", "The proposal did not match the refund request schema.", {
          code: "invalid_arguments",
          problems: shape.problems,
        }),
      ],
      signals: [],
      disclosedAmountsMinor: [],
    };
  }

  const request = shape.request;
  const { orderId, itemId, quantity, reasonCode: reason, certainty } = request;
  const proposed = request.amountMinor;

  const access = getOrder(ctx, orderId);
  if (!access.ok) {
    const internal = explainNotFound(ctx, orderId);
    return {
      status: "deny",
      code: "not_found",
      result: notFoundResult(orderId),
      entries: [
        entry(
          internal === "ownership_denied" ? "R1 Ownership" : "R2 Record exists",
          "blocked",
          `Refund refused on ${orderId}. Answered as not found.`,
          { code: "not_found", internal, order_id: orderId },
        ),
      ],
      signals: [],
      disclosedAmountsMinor: [],
    };
  }

  const schemaEntry = entry(
    "Refund schema",
    "info",
    `Request is well formed: ${quantity} x ${itemId} on ${orderId} for ${envelope.customerId}.`,
    { reason_code: reason, certainty },
  );

  const evaluation = evaluateRefund({
    order: access.value,
    customerId: envelope.customerId,
    itemId,
    quantity,
    proposedAmountMinor: proposed,
    statedAmountsMinor: envelope.statedAmountsMinor,
    priorRefunds: listRefundsForOrder(ctx, orderId),
  });

  const entries = [schemaEntry, ...evaluation.outcomes.map(ruleEntry)];
  const signals: Signal[] = evaluation.outcomes
    .filter((o) => o.code && o.status !== "ok")
    .map((o) => ({ code: o.code as string, detail: o.detail, payload: o.payload }));

  if (evaluation.verdict.kind === "deny") {
    return {
      status: "deny",
      code: evaluation.verdict.code,
      result: denial(evaluation.verdict.code, { order_id: orderId }),
      entries,
      signals,
      disclosedAmountsMinor: [],
    };
  }

  const { amountMinor, line } = evaluation.verdict;
  const record: RefundRecord = {
    id: newId("REF"),
    sessionId: envelope.sessionId,
    customerId: envelope.customerId,
    orderId,
    itemId,
    itemName: line.name,
    quantity,
    amountMinor,
    currency: access.value.currency,
    reasonCode: reason,
    state: "held",
    signals,
    modelCertainty: certainty,
    proposedAt: nowIso(),
    decidedAt: null,
    decidedBy: null,
  };

  const stored = insertRefund(ctx, record);
  if (!stored.ok) {
    return {
      status: "deny",
      code: "duplicate_refund",
      result: denial("duplicate_refund", { order_id: orderId }),
      entries: [...entries, entry("Handler", "blocked", "The refund record could not be stored.")],
      signals,
      disclosedAmountsMinor: [],
    };
  }

  entries.push(
    entry("Handler", "hold", `Refund ${record.id} held at ${formatMinor(amountMinor, record.currency)}.`, {
      refund_id: record.id,
      amount_minor: amountMinor,
      quantity,
      item_id: itemId,
      certainty,
    }),
  );

  return {
    status: "hold",
    result: {
      refund_id: record.id,
      state: record.state,
      order_id: orderId,
      item_id: itemId,
      item_name: line.name,
      quantity,
      amount: formatMinor(amountMinor, record.currency),
      amount_minor: amountMinor,
      message: "Held for a human operator to approve. Nothing has been paid.",
    },
    entries,
    signals,
    refund: record,
    disclosedAmountsMinor: [amountMinor, line.unitPriceMinor],
  };
}

/* --------------------------------------------------------------- kernel */

/**
 * Executes one proposed tool call, or refuses to.
 *
 * The AuthContext is minted here from the envelope rather than accepted from
 * the caller, so there is no parameter an agent could pass to widen its own
 * scope.
 */
export function execute(agent: AgentName, call: ToolCall, envelope: Envelope): KernelResult {
  const header = entry("Proposal", "info", `${agent} proposed ${call.name}.`, {
    tool: call.name,
    input: call.input,
  });

  if (!isToolName(call.name) || !GRANTS[agent].includes(call.name as ToolName)) {
    return {
      status: "deny",
      code: "capability_violation",
      result: denial("capability_violation"),
      entries: [
        header,
        entry("Capability", "blocked", `${call.name} is not in the ${agent} grant.`, {
          code: "capability_violation",
          granted: GRANTS[agent],
        }),
      ],
      signals: [
        {
          code: "capability_violation",
          detail: `${agent} proposed ${call.name}, which it does not hold.`,
          payload: { agent, tool: call.name },
        },
      ],
      disclosedAmountsMinor: [],
    };
  }

  const capability = entry("Capability", "info", `${call.name} is in the ${agent} grant.`);
  const binding = bindSession(call, envelope);
  const ctx = customerContext(envelope.customerId);

  if (binding.invalid) {
    return {
      status: "deny",
      code: "session_invalid",
      result: denial("session_invalid"),
      entries: [header, capability, ...binding.entries],
      signals: binding.signals,
      disclosedAmountsMinor: [],
    };
  }

  const handled =
    call.name === "check_session"
      ? handleCheckSession(ctx, envelope)
      : call.name === "get_orders"
        ? handleGetOrders(ctx, envelope)
        : call.name === "get_order"
          ? handleGetOrder(ctx, call, envelope)
          : handleProposeRefund(ctx, call, envelope);

  return {
    ...handled,
    entries: [header, capability, ...binding.entries, ...handled.entries],
    signals: [...binding.signals, ...handled.signals],
  };
}
