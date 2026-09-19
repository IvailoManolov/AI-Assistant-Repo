/**
 * Turning a basket into an order.
 *
 * In core rather than in the route handler, for two reasons. The pricing rule
 * needs somewhere to be tested from, and a purchase is domain behaviour rather
 * than an HTTP concern: the route should read the request, call this, and
 * shape the response.
 *
 * The client sends item ids and quantities and nothing else. Prices come from
 * the product master on this side, for the same reason the kernel recomputes a
 * refund amount rather than taking the model's: a number that arrived over the
 * wire is a claim, not a fact. A price edited in the browser buys nothing.
 */
import { customerContext } from "../../guard/auth-context.ts";
import type { Order, OrderLine } from "../../guard/records.ts";
import { createRuntimeOrder, nextOrderId } from "../../guard/scoped-store.ts";
import { loadProducts } from "../../mock-env/seed.ts";
import { nowIso } from "../runtime/clock.ts";

export type BasketLine = { itemId: string; quantity: number };

export type PurchaseOutcome = { ok: true; order: Order } | { ok: false; error: string };

export function placeOrder(customerId: string, basket: readonly BasketLine[]): PurchaseOutcome {
  if (!customerId) return { ok: false, error: "No customer on the request." };
  if (!Array.isArray(basket) || basket.length === 0) {
    return { ok: false, error: "The basket is empty." };
  }

  const products = loadProducts();
  const lines: OrderLine[] = [];

  for (const entry of basket) {
    const product = products.find((p) => p.item_id === entry.itemId);
    if (!product) return { ok: false, error: `No product ${entry.itemId}.` };
    if (!Number.isInteger(entry.quantity) || entry.quantity < 1) {
      return { ok: false, error: `Bad quantity for ${entry.itemId}.` };
    }
    lines.push({
      itemId: product.item_id,
      name: product.name,
      quantity: entry.quantity,
      unitPriceMinor: product.unit_price_minor,
    });
  }

  const totalMinor = lines.reduce((sum, l) => sum + l.unitPriceMinor * l.quantity, 0);
  const at = nowIso();

  /**
   * Created delivered and paid, arriving the moment it is bought.
   *
   * Not realistic, and deliberate: it is the only way something bought in this
   * environment is immediately eligible for the refund path, which is the
   * whole reason the shop and the support capability sit in one app. A
   * purchase that had to spend three days in transit before anyone could ask
   * about it would make the thing untestable by hand.
   */
  const created = createRuntimeOrder(customerContext(customerId), {
    orderId: nextOrderId(),
    customerId,
    status: "delivered",
    currency: "EUR",
    totalMinor,
    lines,
    placedAt: at,
    paidAt: at,
    deliveredAt: at,
    cancelledAt: null,
  });

  if (!created.ok) return { ok: false, error: "The order could not be created." };
  return { ok: true, order: created.value };
}
