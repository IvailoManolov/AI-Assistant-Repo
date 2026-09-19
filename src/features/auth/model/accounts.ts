import type { Role } from "./types";

/**
 * Credentials are hardcoded on purpose. This is a demo environment with no
 * database and no real accounts; the sign-in exists to switch between the two
 * roles, not to protect anything.
 */
export const ACCOUNTS: Record<
  string,
  { password: string; role: Role; displayName: string }
> = {
  Admin: { password: "Test123$", role: "admin", displayName: "Operator" },
  User: { password: "Test123$", role: "user", displayName: "Anna Petrova" },
};

export const DEMO_PASSWORD = "Test123$";

export const landingRouteFor = (role: Role) => (role === "admin" ? "/console" : "/shop");
