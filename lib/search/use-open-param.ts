"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/**
 * Deep-link helper for the list views: when the URL carries `?open=<id>` (e.g. a
 * hit selected in the command palette), open the matching detail modal. Returns a
 * `close` callback that clears the selection AND strips the `open` param so the URL
 * stays clean and the record doesn't re-open on the next param change.
 *
 * `setSelected` is the view's existing modal-state setter.
 */
export function useOpenParam(setSelected: (id: string | null) => void) {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const handled = useRef<string | null>(null);

  useEffect(() => {
    const open = sp.get("open");
    if (open && open !== handled.current) {
      handled.current = open;
      setSelected(open);
    }
    if (!open) handled.current = null;
  }, [sp, setSelected]);

  return function close() {
    setSelected(null);
    if (sp.get("open")) {
      const params = new URLSearchParams(sp.toString());
      params.delete("open");
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname);
    }
  };
}
