import { ShoppingBag, SlidersHorizontal, type LucideIcon } from "lucide-react";

import { DEMO_PASSWORD } from "./accounts";

/**
 * The two accounts, described for a person choosing between them.
 *
 * Separate from ACCOUNTS, which is the credential table. What a card says
 * about a role is presentation, and putting it next to the passwords would
 * mean the sign-in screen and the auth check shared a file for no reason.
 */
export type DemoAccount = {
  username: string;
  displayName: string;
  /** What this person is, in their own terms. */
  standing: string;
  initials: string;
  icon: LucideIcon;
  /** The three things this role can do, shortest first. */
  can: string[];
  password: string;
  /** Tokens, so a card can be tinted without a conditional in the markup. */
  accent: { ring: string; wash: string; ink: string };
};

export const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    username: "User",
    displayName: "Anna Petrova",
    standing: "Customer, CUST-001",
    initials: "AP",
    icon: ShoppingBag,
    can: ["Spend a €50 wallet", "Ask Robby about an order", "Request a refund"],
    password: DEMO_PASSWORD,
    accent: { ring: "ring-coral", wash: "bg-coral-soft", ink: "text-coral-deep" },
  },
  {
    username: "Admin",
    displayName: "Operator",
    standing: "Support desk",
    initials: "OP",
    icon: SlidersHorizontal,
    can: ["Replay every session", "Approve or reject refunds", "See all orders"],
    password: DEMO_PASSWORD,
    accent: { ring: "ring-cobalt", wash: "bg-cobalt-soft", ink: "text-cobalt" },
  },
];
