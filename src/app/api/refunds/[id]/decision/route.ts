import { NextResponse } from "next/server";

import { settleRefund } from "@/core/refunds/settle";

export const dynamic = "force-dynamic";

/**
 * The human half of a refund.
 *
 * This route decides nothing. It reads who clicked and what they clicked and
 * hands both on, and the kernel re-runs the rules against the record as it
 * stands now and returns a trace either way. A refusal here is a 409 rather
 * than a 500: the system working correctly is not a server error.
 *
 * Settling marks the record and closes the session. It moves no money.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = (await request.json()) as { decision?: string; operatorId?: string };

  if (body.decision !== "approve" && body.decision !== "reject") {
    return NextResponse.json(
      { error: "A decision of approve or reject is required." },
      { status: 400 },
    );
  }

  const result = settleRefund({
    refundId: id,
    decision: body.decision,
    operatorId: body.operatorId ?? "operator",
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.code, message: result.detail, trace: result.entries },
      { status: result.code === "not_found" ? 404 : 409 },
    );
  }

  return NextResponse.json({
    refund: result.record,
    trace: result.entries,
    sessionCompleted: result.sessionCompleted,
  });
}
