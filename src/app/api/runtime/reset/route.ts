import { NextResponse } from "next/server";

import { resetSessions } from "@/core/sessions/store";
import { resetPurchasedOrders, resetRefunds } from "@/guard/scoped-store";

export const dynamic = "force-dynamic";

/**
 * Clears the mutable half of data/seed and the matching in-process state.
 *
 * Both halves of both things: sessions and purchased orders each live in
 * memory and on disk, and clearing only the file leaves the process holding
 * what it had, so its next write puts everything straight back. Refunds are
 * in memory only, and they go too: a refund outliving the session that raised
 * it is a held decision nobody can open.
 *
 * The immutable half, which carries the data supplied with the exercise, is
 * never touched, so a reset returns the environment to how it shipped rather
 * than to an empty one.
 */
export async function POST() {
  const sessions = resetSessions();
  const orders = resetPurchasedOrders();
  const refunds = resetRefunds();

  return NextResponse.json({
    removed: sessions.removed,
    sessions: sessions.removed,
    orders: orders.removed,
    refunds: refunds.removed,
  });
}
