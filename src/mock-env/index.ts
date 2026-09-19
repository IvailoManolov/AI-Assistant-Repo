/**
 * The local interface to the mock commerce environment.
 *
 * A module barrel is the simplest interface that suits a TypeScript runtime,
 * so there is no server, no port, and no client to configure. Import it.
 *
 * This is scaffolding. It exposes the supplied data and a place to put
 * temporary records. It implements no part of the support capability.
 */
export {
  SEED_DIR,
  SEED_FILES,
  readImmutable,
  loadCustomers,
  loadOrders,
  loadProducts,
  loadScenarios,
} from "./seed.ts";

export type {
  SeedCustomer,
  SeedOrder,
  SeedOrderItem,
  SeedProduct,
  SeedScenario,
} from "./seed.ts";

export {
  clearRuntime,
  deleteRecord,
  getRecord,
  listCollections,
  listRecords,
  putRecord,
} from "./runtime.ts";

export type { RuntimeRecord } from "./runtime.ts";

export {
  MUTABLE_DIR,
  clearMutable,
  listMutableFiles,
  readMutable,
  writeMutable,
} from "./mutable.ts";
