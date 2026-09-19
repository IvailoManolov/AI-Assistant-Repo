/**
 * Tool specifications and the grant table.
 *
 * The specs are Anthropic tool-use shaped, because they are handed to the
 * model client as-is. Swapping the mock for a real client changes nothing
 * here.
 *
 * Note what is absent: no tool declares a `customer_id` parameter. Identity
 * is not something the model is asked for, so there is no field for it to
 * fill in. If it supplies one anyway, the kernel overwrites it at stage 2 and
 * logs the attempt. Declaring the field would invite the model to guess.
 */
export type ToolSpec = {
  name: string;
  description: string;
  input_schema: {
    type: "object";
    properties: Record<string, { type: string; description: string; enum?: readonly string[] }>;
    required: string[];
  };
};

export const TOOL_NAMES = ["check_session", "get_orders", "get_order", "propose_refund"] as const;
export type ToolName = (typeof TOOL_NAMES)[number];

export const isToolName = (value: string): value is ToolName =>
  (TOOL_NAMES as readonly string[]).includes(value);

export const TOOL_SPECS: Record<ToolName, ToolSpec> = {
  check_session: {
    name: "check_session",
    description:
      "Confirm that this conversation is still a valid authenticated session, and read what has already been established in it: the order under discussion, and any question you are waiting on an answer to. Takes no arguments.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  get_orders: {
    name: "get_orders",
    description:
      "List the orders on the account you are helping. Takes no arguments: the account is fixed by the system for the duration of the conversation.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  get_order: {
    name: "get_order",
    description:
      "Read one order in full, including its line items and any shipping detail. Returns not_found if the reference does not name an order on this account.",
    input_schema: {
      type: "object",
      properties: {
        order_id: { type: "string", description: "The order reference, for example ORD-200." },
      },
      required: ["order_id"],
    },
  },
  propose_refund: {
    name: "propose_refund",
    description:
      "Propose a refund for one line of one order. This does not pay anything. The proposal is checked against the order record and held for a human operator to approve or reject.",
    input_schema: {
      type: "object",
      properties: {
        order_id: { type: "string", description: "The order the refund is against." },
        item_id: { type: "string", description: "The line item being refunded." },
        quantity: {
          type: "integer",
          description: "How many units of that line to refund. At least 1.",
        },
        amount_minor: {
          type: "integer",
          description:
            "The refund amount in minor units, for example 1490 for EUR 14.90. This is checked against the order record and does not decide the figure.",
        },
        reason_code: {
          type: "string",
          description: "Why the refund is being raised.",
          enum: ["damaged_on_arrival", "return_received", "not_as_described", "unspecified"],
        },
        certainty: {
          type: "integer",
          description:
            "How confident you are that this refund should be granted, 0 to 100. Advisory only: it is shown to the operator and decides nothing.",
        },
      },
      required: ["order_id", "item_id", "quantity", "amount_minor", "reason_code", "certainty"],
    },
  },
};

export const AGENT_NAMES = ["triage", "order", "refund", "composer"] as const;
export type AgentName = (typeof AGENT_NAMES)[number];

/**
 * Least privilege, enforced at stage 1 of the kernel rather than by the
 * agent's prompt. The split also keeps `propose_refund` out of the order
 * agent's context entirely, so it cannot propose one even by accident: that
 * is containment, and the kernel is the part that is security.
 */
export const GRANTS: Record<AgentName, readonly ToolName[]> = {
  triage: [],
  order: ["check_session", "get_orders", "get_order"],
  refund: ["check_session", "get_orders", "get_order", "propose_refund"],
  composer: [],
};

export const toolsFor = (agent: AgentName): ToolSpec[] =>
  GRANTS[agent].map((name) => TOOL_SPECS[name]);
