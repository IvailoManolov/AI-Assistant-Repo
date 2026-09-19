"use client";

/**
 * Hover-only tooltip for a small visual marker.
 *
 * It is deliberately not the accessible name of anything: a marker that needs
 * a tooltip should sit inside a control that already states the same fact in
 * its own label, so keyboard and screen reader users never depend on hover.
 */
export function Tooltip({
  label,
  children,
  align = "left",
}: {
  label: string;
  children: React.ReactNode;
  align?: "left" | "center";
}) {
  return (
    <span className="group/tip relative inline-flex">
      {children}
      <span
        role="tooltip"
        aria-hidden
        className={`pointer-events-none absolute top-full z-30 mt-2 w-max max-w-[13rem] rounded-lg bg-ink px-2.5 py-1.5 text-[11.5px] leading-snug font-normal text-cream opacity-0 shadow-lift transition-opacity duration-150 group-hover/tip:opacity-100 ${
          align === "center" ? "left-1/2 -translate-x-1/2" : "left-0"
        }`}
      >
        {label}
      </span>
    </span>
  );
}
