import type { Race, Results } from "./types";

/** Every call civicAPI timestamped, oldest first. Replay position i = the results after the first i of them. */
export function callOrder(results: Results): Race[] {
  return results.races
    .filter((r): r is Race & { calledAt: string } => r.winner !== null && r.calledAt !== null)
    .sort((a, z) => a.calledAt.localeCompare(z.calledAt));
}

function uncall(r: Race): Race {
  return { ...r, winner: null, flip: null, calledAt: null, cands: r.cands.map((c) => (c.winner ? { ...c, winner: false } : c)) };
}

/**
 * The results as they stood after the first `count` timestamped calls: every later call, and every call civicAPI left
 * without a time, is undone. Leads and vote counts stay as they are today, since the count history starts later.
 */
export function resultsAfter(results: Results, count: number, calls: Race[]): Results {
  if (count >= calls.length) return results;
  const last = count === 0 ? "" : (calls[count - 1] as Race).calledAt;
  return {
    ...results,
    races: results.races.map((r) => (r.winner === null || (r.calledAt !== null && r.calledAt <= (last as string)) ? r : uncall(r))),
  };
}
