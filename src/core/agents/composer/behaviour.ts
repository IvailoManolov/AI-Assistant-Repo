/**
 * How the stand-in model plays the composer.
 *
 * Every branch here is built from the briefing it was handed and nothing else.
 * If a number appears in this file's output it came in through the decision
 * object, which is what R10 goes on to verify independently.
 */
import type { DisclosedOrder } from "../../../guard/disclosure.ts";
import type { ComposerBriefing } from "../../contracts.ts";
import { readBriefing } from "../../model/mock/briefing.ts";
import { lastUserText, type MessageRequest, type TextBlock } from "../../model/types.ts";
import { refundDaysLeft } from "../../refunds/schema.ts";

const text = (value: string): TextBlock => ({ type: "text", text: value });

const describe = (orders: DisclosedOrder[]): string =>
  orders
    .map((o) => {
      const shipping = o.shipping
        ? ` It is with ${o.shipping.carrier}, tracking ${o.shipping.tracking_number}.`
        : "";
      const items = o.items.map((i) => `${i.quantity} x ${i.name}`).join(", ");
      return `Order ${o.order_id} is ${o.status.replace(/_/g, " ")} and holds ${items}.${shipping}`;
    })
    .join(" ");

/** Dates are written the way a person would say them, and always in UTC. */
const onDate = (iso: string): string =>
  new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", timeZone: "UTC" });

const plural = (n: number, word: string): string => `${n} ${word}${n === 1 ? "" : "s"}`;

/**
 * Where one order has got to, in one sentence.
 *
 * Every clause is a field of the record that was retrieved: the state, the
 * date it reached that state, and how long ago that was. Nothing here is
 * inferred, which is what lets the same reply be checked against the decision
 * afterwards.
 */
function progress(order: DisclosedOrder): string {
  const id = `Order ${order.order_id}`;
  const carrier = order.shipping
    ? ` with ${order.shipping.carrier}, tracking ${order.shipping.tracking_number},`
    : "";

  switch (order.status) {
    case "packaged":
      return `${id} is packed and waiting for a carrier, so it has not shipped yet.`;
    case "in_transit":
      return `${id} is on its way${carrier} and has not arrived yet.`;
    case "cancelled":
      return `${id} was cancelled, so nothing is on its way.`;
    case "returned":
      return `${id} has been sent back and the return is being handled.`;
    case "delivered": {
      const when = order.delivered_at ? ` on ${onDate(order.delivered_at)}` : "";
      const ago =
        order.days_since_arrival === null
          ? ""
          : order.days_since_arrival === 0
            ? ", which was today"
            : `, ${plural(order.days_since_arrival, "day")} ago`;
      return `${id} was delivered${when}${ago}.`;
    }
    default:
      return `${id} is ${order.status.replace(/_/g, " ")}.`;
  }
}

/** Whether they can still do anything about it. Only ever said of a delivery. */
function windowNote(order: DisclosedOrder): string {
  if (order.status !== "delivered") return "";
  /** The rule's own arithmetic, so a reply cannot promise a day R12 would refuse. */
  const left = refundDaysLeft(order.days_since_arrival);
  if (left === null) return "";
  if (left < 0) return " The refund window on it has closed.";
  if (left === 0) return " Today is the last day to ask for a refund on it.";
  return ` You have ${plural(left, "day")} left to ask for a refund on it.`;
}

const statusReport = (orders: DisclosedOrder[]): string =>
  orders
    .map((o) => {
      const items = o.items.map((i) => `${i.quantity} x ${i.name}`).join(", ");
      return `${progress(o)} It holds ${items}.${windowNote(o)}`;
    })
    .join(" ");

export function composerBehaviour(request: MessageRequest): TextBlock[] {
  const briefing = readBriefing<ComposerBriefing>(lastUserText(request.messages));
  if (!briefing) return [text("I could not put an answer together for that one.")];

  const name = briefing.customer_name.split(" ")[0];

  if (briefing.ask?.kind === "confirm_refund_target") {
    return [
      text(
        `Hi ${name}. Before I raise anything, can you confirm you mean ${briefing.ask.order_summary}? ` +
          `Reply yes and I will check what can be refunded on it.`,
      ),
    ];
  }

  if (briefing.ask?.kind === "which_order") {
    return [
      text(
        briefing.orders.length
          ? `Hi ${name}. Which order is that about? ${describe(briefing.orders)}`
          : `Hi ${name}. Which order is that about? Give me the reference, for example ORD-200.`,
      ),
    ];
  }

  if (briefing.intent === "refund_cancel") {
    return [
      text(
        `Hi ${name}. Understood, I have not raised anything. Tell me which order you meant and I will look again.`,
      ),
    ];
  }

  if (briefing.refusal) {
    return [text(`Hi ${name}. ${briefing.refusal.message}`)];
  }

  if (briefing.refund) {
    const r = briefing.refund;
    return [
      text(
        `Hi ${name}. I have raised a refund of ${r.amount} for ${r.quantity} x ${r.item_name} ` +
          `on order ${r.order_id}. It is with a colleague for approval now, so nothing has been ` +
          `paid out yet. Reference ${r.refund_id}.`,
      ),
    ];
  }

  if (briefing.orders.length > 0) {
    /**
     * They asked where it had got to, so the answer opens on the state rather
     * than on the contents. The contents follow, because "delivered" on its
     * own is not an answer to anyone with more than one order open.
     */
    if (briefing.focus === "status") {
      return [text(`Hi ${name}. ${statusReport(briefing.orders)}`)];
    }
    return [text(`Hi ${name}. ${describe(briefing.orders)}`)];
  }

  return [
    text(
      `Hi ${name}. I can look up your orders and raise a refund for a colleague to approve. ` +
        `Tell me the order reference and what went wrong with it.`,
    ),
  ];
}
