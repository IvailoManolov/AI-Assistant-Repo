import { NextResponse } from "next/server";

import { listSessions } from "@/core/sessions/store";

/** The operator console polls this, so it must never be cached. */
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ sessions: listSessions() });
}
