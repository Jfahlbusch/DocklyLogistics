"use client";

import { useEffect, useRef, useState } from "react";

export type SearchItem = { id: string; title: string; subtitle?: string; href: string };
export type SearchGroup = { key: string; label: string; items: SearchItem[] };

const MIN_LEN = 2;
const DEBOUNCE_MS = 250;

/**
 * Debounced, cached client search hook (dependency-free — the app has no react-query).
 * Behaviour mirrors the blueprint: fetch only at >= 2 chars, debounce keystrokes,
 * cache by query, keep the previous results visible while the next load is in flight,
 * and cancel stale requests via AbortController.
 */
export function useGlobalSearch(rawQuery: string) {
  const query = rawQuery.trim();
  const [groups, setGroups] = useState<SearchGroup[]>([]);
  const [isFetching, setIsFetching] = useState(false);
  const cache = useRef<Map<string, SearchGroup[]>>(new Map());
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (query.length < MIN_LEN) {
      // Below threshold: drop content hits (navigation targets are handled by the UI).
      setGroups([]);
      setIsFetching(false);
      return;
    }

    const cached = cache.current.get(query);
    if (cached) {
      setGroups(cached);
      setIsFetching(false);
      return;
    }

    const timer = setTimeout(() => {
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;
      setIsFetching(true);

      fetch(`/api/v1/search?q=${encodeURIComponent(query)}`, { signal: ac.signal })
        .then((r) => (r.ok ? r.json() : { data: { groups: [] } }))
        .then((j) => {
          const g: SearchGroup[] = j?.data?.groups ?? [];
          cache.current.set(query, g);
          setGroups(g);
        })
        .catch((e: unknown) => {
          if (!(e instanceof DOMException && e.name === "AbortError")) setGroups([]);
        })
        .finally(() => {
          if (abortRef.current === ac) setIsFetching(false);
        });
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [query]);

  return { groups, isFetching, enabled: query.length >= MIN_LEN };
}
