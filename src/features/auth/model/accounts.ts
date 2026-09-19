import type { Role } from "./types";

/**
 * Credentials are hardcoded on purpose. This is a demo environment with no
 * database and no real accounts; the sign-in exists to switch between the two
 * roles, not to protect anything.
 */
export const ACCOUNTS: Record<
  string,
  { password: string; role: Role; displayName: string; customerId: string | null }
> = {
  Admin: {
    password: "Test123$",
    role: "admin",
    displayName: "Operator",
    customerId: null,
  },
  /**
   * The customer login is bound to a seed customer. Everything the assistant
   * is asked is asked as CUST-001, which is the already-authenticated customer
   * id the exercise hands the system.
   */
  User: {
    password: "Test123$",
    role: "user",
    displayName: "Anna Petrova",
    customerId: "CUST-001",
  },
};

export const DEMO_PASSWORD = "Test123$";

export const landingRouteFor = (role: Role) => (role === "admin" ? "/console" : "/shop");
