import Link from "next/link";

import { RobbyAvatar } from "./robby-avatar";

/**
 * The product is named after the assistant, so the mark is the assistant.
 * One face, used at the top of every page and again beside everything it says.
 */
export function BrandMark({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="flex items-center gap-2.5">
      <RobbyAvatar size={26} label={null} />
      <span className="font-display text-lg font-bold">Robby</span>
    </Link>
  );
}
