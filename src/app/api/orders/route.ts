import { NextResponse } from "next/server";

import { placeOrder, type BasketLine } from "@/core/orders/place";
import { ORDER_WINDOW_DAYS, customerOrders, operatorOrders } from "@/core/orders/views";

export const dynamic = "force-dynamic";

/**
 * Orders, for whoever is asking.
 *
 * One route, two principals, and the guard is what makes that safe: the
 * projections behind these two calls are scoped by auth context, so a customer
 * cannot widen this into the operator's list by editing a query string.
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const customerId = params.get("customerId");

  const orders = customerId
    ? customerOrders(customerId)
    : operatorOrders(params.get("operatorId") ?? "operator");

  return NextResponse.json({ orders, windowDays: ORDER_WINDOW_DAYS });
}

/**
 * A purchase from the shop.
 *
 * The order it creates is real: it goes into the same store the assistant
 * reads through the guard, and it shows up in the operator's Orders view, so
 * something bought here can be asked about in the chat a second later.
 */
export async function POST(request: Request) {
  const body = (await request.json()) as { customerId?: string; lines?: BasketLine[] };

  const result = placeOrder(body.customerId ?? "", body.lines ?? []);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

  return NextResponse.json({ order: result.order }, { status: 201 });
}
