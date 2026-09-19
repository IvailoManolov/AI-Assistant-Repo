export type Role = "user" | "admin";

export type Session = {
  username: string;
  role: Role;
  displayName: string;
  signedInAt: string;
};

export type SignInResult = { ok: true } | { ok: false; error: string };
