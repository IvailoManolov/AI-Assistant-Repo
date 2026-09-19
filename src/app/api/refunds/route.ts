import { NextResponse } from "next/server";

import { operatorContext } from "@/guard/auth-context";
import { listRefunds } from "@/guard/scoped-store";

export const dynamic = "force-dynamic";

/**
 * Every refund the operator can act on, newest first, held ones first.
 *
 * The operator id arrives from the query rather than a server session because
 * authentication is out of scope for this exercise: the brief hands us an
 * already-authenticated identity. In a real deployment this is the one line
 * that changes, and the guard below it does not.
 */
export async function GET(request: Request) {
  const operatorId = new URL(request.url).searchParams.get("operatorId") ?? "operator";
  const refunds = listRefunds(operatorContext(operatorId)).sort((a, b) => {
    if (a.state !== b.state) return a.state === "held" ? -1 : 1;
    return b.proposedAt.localeCompare(a.proposedAt);
  });

  return NextResponse.json({ refunds });
}
