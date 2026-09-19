/**
 * The headless runner. This is the answer to requirement E8.
 *
 * Runs every supplied example against a fresh runtime and prints the message,
 * the decision trace, the kernel's verdict, the reply and any refund record
 * that came out of it. It calls the same entry point the HTTP route calls, so
 * what a reviewer sees here is what the product does.
 *
 * The clock and the id source are pinned, so two runs produce identical
 * output and a diff between them means something changed.
 *
 *   npm run scenarios                     every scenario, readable
 *   npm run scenarios -- --json           the same, as one JSON document
 *   npm run scenarios -- scenario-02      just that one
 *
 * A refusal, a denial or a hold is a successful run. The system behaving
 * correctly is not a test failure, so the exit code is non-zero only when the
 * runner itself breaks.
 */
import { loadCustomers, loadScenarios } from "../src/mock-env/seed.ts";
import { clearRuntime } from "../src/mock-env/runtime.ts";
import { setClock } from "../src/core/runtime/clock.ts";
import { sequentialIds, setIdSource } from "../src/core/runtime/ids.ts";
import { runSupportRequest } from "../src/core/orchestrator/run.ts";

const args = process.argv.slice(2);
const asJson = args.includes("--json");
const only = args.filter((a) => !a.startsWith("--"));

/** Pinned instant and counter. Determinism is the property being shown. */
const FIXED = new Date("2026-09-19T09:00:00.000Z");
setClock({ now: () => FIXED });
const customerName = (id) => loadCustomers().find((c) => c.customer_id === id)?.name ?? id;

const ESC = String.fromCharCode(27);
const plain = !process.stdout.isTTY;
const wrap = (code, s) => (plain ? s : `${ESC}[${code}m${s}${ESC}[0m`);
const dim = (s) => wrap("2", s);
const bold = (s) => wrap("1", s);
const STATUS_COLOR = { ok: "32", hold: "33", blocked: "31", info: "36", skipped: "90" };
const tint = (status, s) => wrap(STATUS_COLOR[status] ?? "0", s);

function printTree(nodes, depth = 0) {
  for (const node of nodes) {
    const pad = "  ".repeat(depth + 1);
    console.log(`${pad}${tint(node.status, node.status.padEnd(7))} ${node.label}  ${dim(node.detail)}`);
    if (node.children?.length) printTree(node.children, depth + 1);
  }
}

const ask = (scenario, sessionId) =>
  runSupportRequest({
    customerId: scenario.authenticated_customer_id,
    customerName: customerName(scenario.authenticated_customer_id),
    sessionId,
    message: scenario.message,
  });

/**
 * The multi-turn path, which the supplied examples do not cover because each
 * of them is a single message. This is the flow a person actually takes in the
 * chat: name an order, ask for a refund without repeating the reference, and
 * be asked to confirm before anything is raised.
 */
const CONVERSATION = ["order-200", "refund", "yes"];

function report(run) {
  console.log("");
  console.log(`${bold(run.scenario)}  ${dim(run.customerId)}`);
  console.log(dim(`  "${run.message}"`));
  console.log("");
  printTree(run.tree);
  console.log("");
  console.log(`  ${bold("outcome")}  ${tint(run.outcome, run.outcome)}  ${dim(`${run.route} | ${run.summary}`)}`);
  console.log(`  ${bold("reply")}    ${run.reply}`);
  for (const refund of run.refunds) {
    console.log(
      `  ${bold("refund")}   ${refund.id}  ${refund.state}  ` +
        `${refund.currency} ${(refund.amountMinor / 100).toFixed(2)}  ` +
        `${refund.quantity} x ${refund.itemName}  ` +
        dim(`model certainty ${refund.modelCertainty}%`),
    );
    for (const signal of refund.signals) {
      console.log(`  ${dim(`signal   ${signal.code}: ${signal.detail}`)}`);
    }
  }
  console.log(dim(`  ${"-".repeat(72)}`));
}

async function main() {
  const scenarios = loadScenarios().filter((s) => only.length === 0 || only.includes(s.scenario_id));

  if (scenarios.length === 0) {
    console.error(`No scenario matched ${only.join(", ")}.`);
    process.exit(2);
  }

  const runs = [];
  for (const scenario of scenarios) {
    setIdSource(sequentialIds());
    clearRuntime();
    const result = await ask(scenario, `RUN-${scenario.scenario_id}`);
    runs.push({
      ...result,
      scenario: scenario.scenario_id,
      message: scenario.message,
      customerId: scenario.authenticated_customer_id,
    });
  }

  /**
   * One extra pass, not from the supplied set. Replaying a request that
   * already produced a refund is the thing requirement I5 is about, and it is
   * only visible if the runtime is not cleared in between.
   */
  const repeatable =
    only.length === 0
      ? scenarios.find((s) => runs.find((r) => r.scenario === s.scenario_id && r.refunds.length > 0))
      : undefined;

  if (repeatable) {
    setIdSource(sequentialIds());
    clearRuntime();
    const first = await ask(repeatable, "RUN-replay");
    const second = await ask(repeatable, "RUN-replay");
    runs.push({
      ...second,
      scenario: `${repeatable.scenario_id} replayed, ${first.refunds[0]?.id ?? "a refund"} already open`,
      message: repeatable.message,
      customerId: repeatable.authenticated_customer_id,
    });
  }

  /** The multi-turn walkthrough, on one session, with nothing cleared between. */
  if (only.length === 0) {
    setIdSource(sequentialIds());
    clearRuntime();
    for (const message of CONVERSATION) {
      const result = await runSupportRequest({
        customerId: "CUST-001",
        customerName: customerName("CUST-001"),
        sessionId: "RUN-conversation",
        message,
      });
      runs.push({
        ...result,
        scenario: `conversation, turn ${CONVERSATION.indexOf(message) + 1} of ${CONVERSATION.length}`,
        message,
        customerId: "CUST-001",
      });
    }
  }

  if (asJson) {
    console.log(JSON.stringify(runs, null, 2));
    return;
  }

  console.log(bold(`\n${runs.length} run(s) against the supplied seed, fixed clock and id source.`));
  for (const run of runs) report(run);
}

main().catch((error) => {
  console.error("The runner itself failed:");
  console.error(error);
  process.exit(1);
});
