/**
 * Session tokens and conversation context, behind the guard.
 *
 * In a real deployment an agent that wants to know whether it is inside a live
 * authenticated session asks the session store, and the session store checks a
 * token against a database. There is no database here, so that lookup is
 * simulated: the token is minted by the guard, held in the mock environment's
 * runtime collection, and validated by the guard. The shape of the call is the
 * part that is real, and it is the part that would survive a rewrite.
 *
 * The conversation context lives here for the same reason it lives behind the
 * guard at all. "Which order were we talking about" is customer data: it names
 * an order, and an order belongs to somebody. A customer principal reaches
 * only their own.
 */
import { getRecord, listRecords, putRecord, type RuntimeRecord } from "../mock-env/runtime.ts";
import { nowIso } from "../core/runtime/clock.ts";
import { newId } from "../core/runtime/ids.ts";
import type { Access, AuthContext } from "./types.ts";

const TOKENS = "session_tokens";
const CONTEXT = "session_context";

const notFound = <T>(): Access<T> => ({ ok: false, code: "not_found" });
const found = <T>(value: T): Access<T> => ({ ok: true, value });

export type SessionToken = {
  token: string;
  sessionId: string;
  customerId: string;
  issuedAt: string;
};

/**
 * What the agent asked for when it asked whether the session is valid. It is
 * deliberately thin: a token check answers "are you who this conversation
 * says you are", not "tell me about the customer".
 */
export type SessionValidity =
  | { valid: true; sessionId: string; customerId: string; issuedAt: string }
  | { valid: false; reason: "unknown_token" | "customer_mismatch" };

const tokens = (): SessionToken[] => listRecords(TOKENS) as unknown as SessionToken[];

/**
 * The token for a conversation, minted on first use.
 *
 * Idempotent per session, so re-entering the same conversation does not
 * invalidate the token the earlier turns were checked against.
 */
export function sessionToken(customerId: string, sessionId: string): SessionToken {
  const existing = tokens().find((t) => t.sessionId === sessionId && t.customerId === customerId);
  if (existing) return existing;

  const minted: SessionToken = {
    token: newId("TOK"),
    sessionId,
    customerId,
    issuedAt: nowIso(),
  };
  putRecord(TOKENS, minted.token, minted as unknown as RuntimeRecord);
  return minted;
}

/**
 * The lookup the kernel performs on every tool call, and that the agents can
 * perform for themselves through `check_session`.
 *
 * `expectedCustomerId` is the identity from the request envelope. A token that
 * is real but belongs to somebody else fails as loudly as one that does not
 * exist, and it fails for a different stated reason, because the two mean very
 * different things to whoever reads the log.
 */
export function validateSessionToken(token: string, expectedCustomerId: string): SessionValidity {
  const record = getRecord(TOKENS, token) as unknown as SessionToken | undefined;
  if (!record) return { valid: false, reason: "unknown_token" };
  if (record.customerId !== expectedCustomerId) return { valid: false, reason: "customer_mismatch" };
  return {
    valid: true,
    sessionId: record.sessionId,
    customerId: record.customerId,
    issuedAt: record.issuedAt,
  };
}

export function revokeSessionToken(token: string): void {
  const record = getRecord(TOKENS, token) as unknown as SessionToken | undefined;
  if (record) putRecord(TOKENS, token, { ...record, customerId: "" } as unknown as RuntimeRecord);
}

/* ------------------------------------------------------- conversation state */

/**
 * The refund the assistant has offered to raise and is waiting to be told it
 * has the right one. It is a question that has been asked, not a decision that
 * has been taken: nothing here has passed a rule yet.
 */
export type PendingConfirmation = {
  kind: "refund_target";
  orderId: string;
  /**
   * How the order was described back to the customer, so the question and the
   * answer are about the same thing. Deliberately carries no amount: nothing
   * has been through a rule yet, and a figure quoted before the kernel has
   * recomputed it is a figure the system would have to stand behind.
   */
  orderSummary: string;
  /**
   * The message that asked for the refund, kept verbatim.
   *
   * The turn that answers the question says only "yes", which names no item
   * and describes no fault. Without this the agent would be reasoning about a
   * refund from a message that contains the word "yes" and nothing else.
   */
  requestText: string;
  askedAt: string;
};

export type SessionContext = {
  sessionId: string;
  customerId: string;
  /** The order this conversation is about, carried between turns. */
  lastOrderId: string | null;
  pending: PendingConfirmation | null;
  updatedAt: string;
};

const blank = (sessionId: string, customerId: string): SessionContext => ({
  sessionId,
  customerId,
  lastOrderId: null,
  pending: null,
  updatedAt: nowIso(),
});

function visibleTo(ctx: AuthContext, customerId: string): boolean {
  return ctx.principal.kind === "operator" || ctx.principal.customerId === customerId;
}

export function readSessionContext(
  ctx: AuthContext,
  sessionId: string,
  customerId: string,
): Access<SessionContext> {
  if (!visibleTo(ctx, customerId)) return notFound();
  const stored = getRecord(CONTEXT, sessionId) as unknown as SessionContext | undefined;
  if (!stored) return found(blank(sessionId, customerId));
  if (!visibleTo(ctx, stored.customerId)) return notFound();
  return found(stored);
}

export function writeSessionContext(
  ctx: AuthContext,
  sessionId: string,
  customerId: string,
  patch: Partial<Omit<SessionContext, "sessionId" | "customerId">>,
): Access<SessionContext> {
  const current = readSessionContext(ctx, sessionId, customerId);
  if (!current.ok) return current;

  const next: SessionContext = { ...current.value, ...patch, updatedAt: nowIso() };
  putRecord(CONTEXT, sessionId, next as unknown as RuntimeRecord);
  return found(next);
}
