"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Arrives when it is reached.
 *
 * One observer per block, disconnected the moment it has fired: nothing here
 * animates out again, because a section sliding away as you scroll past it is
 * motion that answers no question. Reduced motion is handled in the stylesheet
 * rather than here, so the class still lands and only the movement goes.
 */
export function Reveal({
  children,
  className = "",
  delay = 0,
  as: Tag = "div",
}: {
  children: React.ReactNode;
  className?: string;
  /** Seconds. Used to stagger siblings, never more than a few tenths. */
  delay?: number;
  as?: "div" | "section" | "li";
}) {
  const ref = useRef<HTMLElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setShown(true);
        observer.disconnect();
      },
      { rootMargin: "0px 0px -12% 0px", threshold: 0.15 },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <Tag
      ref={ref as React.Ref<HTMLDivElement & HTMLLIElement>}
      style={delay ? { transitionDelay: `${delay}s` } : undefined}
      className={`reveal ${shown ? "is-in" : ""} ${className}`}
    >
      {children}
    </Tag>
  );
}
