import { useEffect, useState } from "react";
import { afterPaint, loadCounties, loadResults } from "./data";
import type { CountySets, Results } from "./types";

/** Refetch the results this often while the tab is open; the data run deploys hourly. */
export const REFRESH_MS = 15 * 60 * 1000;
/** A tab that becomes visible again refetches only if its data is at least this old. */
export const MIN_GAP_MS = 5 * 60 * 1000;

export interface LiveState {
  results: Results;
  counties: CountySets | null; // null until the county files land, which happens after the first paint
  refreshing: boolean;
  error: string | null; // the last refresh failed; the data shown is still the previous good set
}

/** Keeps the results current: county files follow the first paint; a timer and tab visibility trigger refreshes. */
export function useLive(initial: Results): LiveState {
  const [state, setState] = useState<LiveState>({ results: initial, counties: null, refreshing: false, error: null });

  useEffect(() => {
    let busy = false;
    let last = Date.now();
    let haveCounties = false;
    afterPaint().then(loadCounties).then(
      (counties) => {
        haveCounties = true;
        setState((s) => ({ ...s, counties }));
      },
      (err: Error) => setState((s) => ({ ...s, error: err.message })),
    );
    const refresh = () => {
      if (busy || document.visibilityState !== "visible" || Date.now() - last < MIN_GAP_MS) return;
      busy = true;
      setState((s) => ({ ...s, refreshing: true }));
      Promise.all([loadResults(), haveCounties ? loadCounties() : null]).then(
        ([results, counties]) => {
          busy = false;
          last = Date.now();
          setState((s) => {
            const same = results.fetched === s.results.fetched;
            return { results: same ? s.results : results, counties: same ? s.counties : (counties ?? s.counties), refreshing: false, error: null };
          });
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
