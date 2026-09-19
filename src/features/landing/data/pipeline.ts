/**
 * What happens to one message, in order.
 *
 * The example is the supplied fourth scenario, which is the most interesting
 * one: it names an order, describes damage, and asks for money. Every readout
 * below is what this system actually produces for that message, so the page
 * cannot drift away from the product without somebody noticing.
 */
export type Stage = {
  key: string;
  title: string;
  /** The tools this part holds. The shortest true answer. */
  holds: string;
  body: string;
  /** What it is structurally unable to do. This is the point of the whole page. */
  cannot: string;
  /** What is known once this stage has run, as the trace records it. */
  readout: { label: string; value: string }[];
};

export const EXAMPLE_MESSAGE = "The decanter in ORD-200 arrived cracked, I want a refund";

export const STAGES: Stage[] = [
  {
    key: "triage",
    title: "Triage reads the message",
    holds: "No tools at all",
    body: "A regular expression finds the reference however it was typed, and the wording decides what kind of message this is. Money the customer names is recorded as a claim, not as a fact.",
    cannot: "It cannot look anything up, so it can only report what the sentence says.",
    readout: [
      { label: "intent", value: "refund_request" },
      { label: "order_ids", value: "ORD-200" },
      { label: "claimed", value: "nothing stated" },
    ],
  },
  {
    key: "order",
    title: "The order agent fetches the record",
    holds: "Read only tools",
    body: "Every read goes through the guard with the signed-in customer's context. The record that comes back has the owner id stripped out of it before any agent sees it.",
    cannot: "It cannot name whose account it is reading, so it cannot ask for somebody else's.",
    readout: [
      { label: "ORD-200", value: "delivered 17 September" },
      { label: "holds", value: "2 x Wine Glass, 1 x Decanter" },
      { label: "window", value: "5 of 7 days left" },
    ],
  },
  {
    key: "refund",
    title: "The refund agent proposes",
    holds: "Reads, plus propose_refund",
    body: "It picks the line the customer described and puts a figure and a confidence on it. This is a proposal in the literal sense: an argument for an action, handed to something that does not have to accept it.",
    cannot: "It cannot pay anything. Proposing is the most it is able to do.",
    readout: [
      { label: "item", value: "1 x Decanter" },
      { label: "amount", value: "EUR 25.00" },
      { label: "certainty", value: "90%, advisory only" },
    ],
  },
  {
    key: "kernel",
    title: "The kernel decides",
    holds: "Everything. No handler runs without it",
    body: "Twelve rules run in a fixed order between the proposal and the action: capability, session and identity binding, ownership, status, payment, the refund window, arithmetic, duplicates, and the ceiling. The amount is recomputed from the record rather than taken from the proposal.",
    cannot: "It cannot be talked round. It reads the record, not the conversation.",
    readout: [
      { label: "R3, R11, R12", value: "passed" },
      { label: "R4 recomputed", value: "EUR 25.00, agrees" },
      { label: "R9 ceiling", value: "above it, so held" },
    ],
  },
  {
    key: "composer",
    title: "The composer writes the reply",
    holds: "No tools, no records",
    body: "It sees the decision and nothing else, so every figure it could write is one the decision carried. R10 then checks the draft against that list and replaces the whole reply if a number appears that no decision produced.",
    cannot: "It cannot invent a figure and have it reach the customer.",
    readout: [
      { label: "reply", value: "Refund raised, with a colleague for approval" },
      { label: "paid out", value: "nothing" },
      { label: "session", value: "waiting on a person" },
    ],
  },
];
