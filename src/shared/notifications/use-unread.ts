"use client";

import { useCallback, useMemo, useState } from "react";

/**
 * Tracks which items a person has not looked at yet.
 *
 * Deliberately has no effects: everything is marked seen from an event
 * handler, so there is no render pass where the count is briefly wrong and no
 * dependence on when an effect happens to run.
 *
 * Whatever is present on the first render counts as already seen. A surface
 * that starts with a backlog therefore opens quiet, and only what arrives
 * afterwards raises a badge.
 */
export function useUnread<T>(items: readonly T[], idOf: (item: T) => string) {
  const [seen, setSeen] = useState<ReadonlySet<string>>(() => new Set(items.map(idOf)));

  const unreadIds = useMemo(
    () => items.map(idOf).filter((id) => !seen.has(id)),
    [items, idOf, seen],
  );

  const markSeen = useCallback((id: string) => {
    setSeen((prev) => (prev.has(id) ? prev : new Set(prev).add(id)));
  }, []);

  /** Marks everything present right now. Later arrivals are unread again. */
  const markAllSeen = useCallback(() => {
    setSeen(new Set(items.map(idOf)));
  }, [items, idOf]);

  return { count: unreadIds.length, unreadIds, markSeen, markAllSeen };
}
