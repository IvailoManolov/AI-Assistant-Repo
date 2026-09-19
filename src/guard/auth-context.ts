/**
 * Minting an AuthContext.
 *
 * Both constructors take the identity from their caller, and their callers
 * are adapters that got it from the request envelope. Nothing downstream can
 * build one of these out of model output, because building one means naming
 * a customer id, and by the time model output is being read the context has
 * already been created and passed in.
 */
import { nowIso } from "../core/runtime/clock.ts";
import type { AuthContext, Principal } from "./types.ts";

export const customerContext = (customerId: string): AuthContext => ({
  principal: { kind: "customer", customerId },
  issuedAt: nowIso(),
});

export const operatorContext = (operatorId: string): AuthContext => ({
  principal: { kind: "operator", operatorId },
  issuedAt: nowIso(),
});

/** The id a record must carry for a customer principal to see it. */
export const scopedCustomerId = (ctx: AuthContext): string | null =>
  ctx.principal.kind === "customer" ? ctx.principal.customerId : null;

/** For the audit line. Never used as an authorization input. */
export const principalLabel = (principal: Principal): string =>
  principal.kind === "customer" ? principal.customerId : `operator:${principal.operatorId}`;
