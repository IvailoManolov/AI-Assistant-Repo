import Link from "next/link";

export function BrandMark({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="flex items-center gap-2.5">
      <span className="size-3 rounded-full bg-coral" aria-hidden />
      <span className="font-display text-lg font-bold">Kiln</span>
    </Link>
  );
}
