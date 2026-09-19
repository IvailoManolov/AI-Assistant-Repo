export type Role = "user" | "admin";

export type Session = {
  username: string;
  role: Role;
  displayName: string;
  /** The already-authenticated customer id. Null for the operator. */
  customerId: string | null;
  signedInAt: string;
};

export type SignInResult = { ok: true } | { ok: false; error: string };
