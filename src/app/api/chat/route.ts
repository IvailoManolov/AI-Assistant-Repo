import { NextResponse } from "next/server";

import { appendReply, receiveMessage } from "@/core/sessions/store";

export const dynamic = "force-dynamic";

/**
 * Stands in for the time a real model call takes. It is not decoration: the
 * session exists and is visible to the operator for the whole of this window,
 * which is the behaviour the console has to handle once agents are wired in.
 */
const MODEL_LATENCY_MS = 1200;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function POST(request: Request) {
  const body = (await request.json()) as {
    customerId?: string;
    customer?: string;
    message?: string;
  };

  const message = body.message?.trim();
  if (!body.customerId || !message) {
    return NextResponse.json(
      { error: "A customer id and a message are both required." },
      { status: 400 },
    );
  }

  const session = receiveMessage({
    customerId: body.customerId,
    customer: body.customer ?? body.customerId,
    message,
  });

  await wait(MODEL_LATENCY_MS);
  const reply = await appendReply(session.id);

  return NextResponse.json({ sessionId: session.id, reply });
}
