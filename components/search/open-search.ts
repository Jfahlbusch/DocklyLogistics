"use client";

/** Custom DOM event the command palette listens for. Lets any component open the
 *  palette without prop-drilling or a shared store. */
export const SEARCH_OPEN_EVENT = "app:search:open";

export function openSearch() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(SEARCH_OPEN_EVENT));
  }
}
