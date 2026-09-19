/**
 * The runtime seam, now connected.
 *
 * Every customer message ends up here. It used to return one honest sentence
 * because there was no pipeline behind it; it now runs the real one. The
 * session lifecycle, the logging and the console around it did not have to
 * change, which was the point of keeping the seam in one function.
 */
import type { DecisionNode, DecisionStatus, LogLine } from "../sessions/types.ts";
import type { RefundRecord } from "../refunds/types.ts";
import { runSupportRequest } from "./run.ts";

export type DraftedReply = {
  text: string;
  outcome: DecisionStatus;
  summary: string;
  tree: DecisionNode[];
  logs: LogLine[];
  refunds: RefundRecord[];
};

export async function draftReply(input: {
  customerId: string;
  customerName: string;
  sessionId: string;
  message: string;
}): Promise<DraftedReply> {
  const result = await runSupportRequest(input);
  return {
    text: result.reply,
    outcome: result.outcome,
    summary: result.summary,
    tree: result.tree,
    logs: result.logs,
    refunds: result.refunds,
  };
}
