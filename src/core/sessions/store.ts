/**
 * The session store.
 *
 * A session is a conversation. It opens the moment a customer sends their
 * first message, stays open while they keep talking, and closes itself after
 * five minutes of silence. The operator console reads from here, so a session
 * is visible to the operator from the first message rather than at the end.
 *
 * Sessions are held in the mock environment's runtime collection and written
 * through to the mutable half of data/seed, so the console still has history
 * after a restart. Recorded sessions come from the immutable half and are
 * never written back.
 */
import { clearMutable, readMutable, writeMutable } from "../../mock-env/mutable.ts";
import { deleteRecord, listRecords, putRecord, type RuntimeRecord } from "../../mock-env/runtime.ts";

import { nowIso, nowMs, stamp } from "../runtime/clock.ts";
import { newId } from "../runtime/ids.ts";
import { draftReply } from "../orchestrator/reply.ts";
import { RECORDED_SESSIONS } from "./recorded.ts";
import type { AgentSession, DecisionNode, LogLine, Turn } from "./types.ts";

const COLLECTION = "sessions";
const MUTABLE_FILE = "sessions.json";

/** Silence for this long closes a session and flags it for the operator. */
export const INACTIVITY_MS = 5 * 60 * 1000;

const recordedIds = new Set<string>();
let booted = false;

function boot() {
  if (booted) return;
  booted = true;

  for (const session of RECORDED_SESSIONS()) {
    recordedIds.add(session.id);
    putRecord(COLLECTION, session.id, session as unknown as RuntimeRecord);
  }
  for (const session of readMutable<AgentSession>(MUTABLE_FILE)) {
    putRecord(COLLECTION, session.id, session as unknown as RuntimeRecord);
  }
}

const all = (): AgentSession[] => listRecords(COLLECTION) as unknown as AgentSession[];

const save = (session: AgentSession) =>
  putRecord(COLLECTION, session.id, session as unknown as RuntimeRecord);

/** Only generated sessions are written back. The recorded ones are source data. */
function persist() {
  writeMutable(
    MUTABLE_FILE,
    all().filter((s) => !recordedIds.has(s.id)),
  );
}

const line = (
  sessionId: string,
  level: LogLine["level"],
  scope: string,
  message: string,
): LogLine => ({ at: stamp(), level, scope, message, sessionId });

/**
 * Closes anything that has gone quiet. Runs on read rather than on a timer,
 * so there is no background job to keep alive and no clock drift between what
 * the store believes and what the console is showing.
 */
function sweep() {
  const cutoff = nowMs() - INACTIVITY_MS;
  let changed = false;

  for (const session of all()) {
    if (session.lifecycle !== "active") continue;
    if (Date.parse(session.lastActivityAt) > cutoff) continue;

    save({
      ...session,
      lifecycle: "closed_inactive",
      durationMs: Date.parse(session.lastActivityAt) - Date.parse(session.startedAt),
      logs: [
        ...session.logs,
        line(
          session.id,
          "warn",
          "session",
          "Closed after five minutes without activity. The customer left mid-conversation.",
        ),
      ],
    });
    changed = true;
  }

  if (changed) persist();
}

/** Live sessions have no end yet, so their duration is measured to now. */
const withLiveDuration = (session: AgentSession): AgentSession =>
  session.lifecycle === "active"
    ? { ...session, durationMs: nowMs() - Date.parse(session.startedAt) }
    : session;

export function listSessions(): AgentSession[] {
  boot();
  sweep();
  return all()
    .map(withLiveDuration)
    .sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt));
}

export function getSession(id: string): AgentSession | undefined {
  boot();
  sweep();
  const found = all().find((s) => s.id === id);
  return found ? withLiveDuration(found) : undefined;
}

function openSession(customerId: string, customer: string, message: string): AgentSession {
  const at = nowIso();
  const id = newId("SES");
  return {
    id,
    customer,
    customerId,
    startedAt: at,
    lastActivityAt: at,
    lifecycle: "active",
    durationMs: 0,
    summary: message.length > 72 ? `${message.slice(0, 71)}...` : message,
    outcome: "info",
    turns: [],
    tree: [],
    logs: [
      line(id, "info", "session", `Session opened for ${customerId}.`),
    ],
  };
}

/**
 * Records a customer message, opening a session if there is no live one.
 *
 * Returns as soon as the message is stored, before any reply exists, so the
 * operator console shows the session while the customer is still waiting.
 */
export function receiveMessage({
  customerId,
  customer,
  message,
}: {
  customerId: string;
  customer: string;
  message: string;
}): AgentSession {
  boot();
  sweep();

  const live = all().find((s) => s.customerId === customerId && s.lifecycle === "active");
  const session = live ?? openSession(customerId, customer, message);

  const customerTurn: Turn = {
    id: `${session.id}-t${session.turns.length + 1}`,
    role: "customer",
    at: stamp(),
    text: message,
  };

  const updated: AgentSession = {
    ...session,
    lastActivityAt: nowIso(),
    lifecycle: "active",
    turns: [...session.turns, customerTurn],
    logs: [
      ...session.logs,
      line(session.id, "info", "intake", `Message received (${message.length} chars).`),
    ],
  };

  save(updated);
  persist();
  return withLiveDuration(updated);
}

/**
 * Runs the support pipeline for the last customer message and appends what it
 * decided to say.
 *
 * Split from receiveMessage because the pipeline takes real time, and the
 * session has to be visible to the operator for the whole of it. The decision
 * tree and the log lines the pipeline produced are stored on the session
 * alongside the reply, so there is nothing to correlate afterwards.
 */
export async function appendReply(sessionId: string): Promise<Turn | undefined> {
  boot();
  const session = all().find((s) => s.id === sessionId);
  if (!session) return undefined;

  const asked = [...session.turns].reverse().find((t) => t.role === "customer");
  if (!asked) return undefined;

  const drafted = await draftReply({
    customerId: session.customerId,
    customerName: session.customer,
    sessionId: session.id,
    message: asked.text,
  });

  const reply: Turn = {
    id: `${session.id}-t${session.turns.length + 1}`,
    role: "assistant",
    at: stamp(),
    text: drafted.text,
  };

  /** Re-read: the pipeline ran for a while and the customer may have typed again. */
  const current = all().find((s) => s.id === sessionId) ?? session;

  /**
   * One node per turn, so a conversation reads as a conversation.
   *
   * Without this the tree is every pipeline the session ever ran, concatenated,
   * and by the third message nobody can tell where one decision ended and the
   * next began. The node carries what the customer said, because that is the
   * question the branch under it is answering.
   */
  const turnNumber = current.turns.filter((t) => t.role === "customer").length;
  const turnNode: DecisionNode = {
    id: `${current.id}-turn-${turnNumber}`,
    kind: "intent",
    label: `Turn ${turnNumber}`,
    detail: asked.text.length > 80 ? `${asked.text.slice(0, 79)}...` : asked.text,
    status: drafted.outcome,
    ms: 0,
    children: drafted.tree,
  };

  save({
    ...current,
    lastActivityAt: nowIso(),
    outcome: drafted.outcome,
    summary: drafted.summary,
    turns: [...current.turns, reply],
    tree: [...current.tree, turnNode],
    logs: [...current.logs, ...drafted.logs],
  });
  persist();
  return reply;
}

/**
 * Marks a session handled once the operator has decided the refund it raised.
 *
 * Green, and closed, on a rejection as much as on an approval. The colour is
 * answering "does this need me?", and a refund somebody has looked at and
 * turned down does not. What was decided is on the refund record and in the
 * tree; the session's own standing is simply that it is finished.
 */
export function completeSession(
  sessionId: string,
  note: string,
): AgentSession | undefined {
  boot();
  const session = all().find((s) => s.id === sessionId);
  if (!session) return undefined;

  const completed: AgentSession = {
    ...session,
    outcome: "ok",
    lifecycle: "closed",
    durationMs: Date.parse(session.lastActivityAt) - Date.parse(session.startedAt),
    tree: [
      ...session.tree,
      {
        id: `${session.id}-handled`,
        kind: "outcome",
        label: "Operator decision",
        detail: note,
        status: "ok",
        ms: 0,
      },
    ],
    logs: [...session.logs, line(session.id, "info", "operator", note)],
  };

  save(completed);
  persist();
  return completed;
}

/**
 * Drops every generated session, in memory and on disk together.
 *
 * Both halves matter. Clearing the file alone leaves the process holding the
 * sessions it already had, and the next write puts them straight back.
 *
 * Recorded sessions are seed data, so they are reloaded rather than removed.
 */
export function resetSessions(): { removed: number } {
  boot();
  const removed = all().filter((s) => !recordedIds.has(s.id)).length;

  clearMutable();
  for (const session of all()) deleteRecord(COLLECTION, session.id);

  booted = false;
  recordedIds.clear();
  boot();

  return { removed };
}
