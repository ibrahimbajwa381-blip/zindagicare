/** Fired when admin queue work changes so the sidebar can refetch badges immediately. */
export const ADMIN_NAV_COUNTS_EVENT = "zindagi:admin-nav-counts";

export function dispatchAdminNavCountsRefresh() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(ADMIN_NAV_COUNTS_EVENT));
}
