import { useEffect, useState } from "react";
import { loadLive, type Live } from "./data";

/** Refetch the results this often while the tab is open; the data run deploys hourly. */
export const REFRESH_MS = 15 * 60 * 1000;

export interface LiveState {
  live: Live;
  refreshing: boolean;
  error: string | null; // the last refresh failed; `live` is still the previous good data
}

/** Keeps the results current: refetches on a timer and whenever the tab becomes visible again. */
export function useLive(initial: Live): LiveState {
  const [state, setState] = useState<LiveState>({ live: initial, refreshing: false, error: null });

  useEffect(() => {
    let busy = false;
    const refresh = () => {
      if (busy || document.visibilityState !== "visible") return;
      busy = true;
      setState((s) => ({ ...s, refreshing: true }));
      loadLive().then(
        (live) => {
          busy = false;
          setState((s) => ({ live: live.results.fetched === s.live.results.fetched ? s.live : live, refreshing: false, error: null }));
        },
        (err: Error) => {
          busy = false;
          setState((s) => ({ ...s, refreshing: false, error: err.message }));
        },
      );
    };
    const id = window.setInterval(refresh, REFRESH_MS);
    const onVisible = () => document.visibilityState === "visible" && refresh();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  return state;
}
