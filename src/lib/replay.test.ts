import { describe, expect, it } from "vitest";
import { RESULTS } from "./fixture";
import { callOrder, resultsAfter } from "./replay";

describe("replay", () => {
  const calls = callOrder(RESULTS);

  it("orders the timestamped calls oldest first", () => {
    expect(calls.length).toBeGreaterThan(2);
    for (let i = 1; i < calls.length; i++) expect((calls[i - 1]?.calledAt as string) <= (calls[i]?.calledAt as string)).toBe(true);
    expect(calls.every((r) => r.winner !== null)).toBe(true);
  });

  it("undoes every call after the position, and every call without a time", () => {
    const first = calls[0] as (typeof calls)[number];
    const after1 = resultsAfter(RESULTS, 1, calls);
    const stillCalled = after1.races.filter((r) => r.winner !== null);
    expect(stillCalled.map((r) => r.id)).toEqual([first.id]);
    const undone = after1.races.find((r) => r.id === (calls[1] as (typeof calls)[number]).id);
    expect(undone?.winner).toBeNull();
    expect(undone?.flip).toBeNull();
    expect(undone?.cands.some((c) => c.winner)).toBe(false);
    expect(resultsAfter(RESULTS, 0, calls).races.every((r) => r.winner === null)).toBe(true);
  });

  it("is the present at the end, unstamped calls included", () => {
    expect(resultsAfter(RESULTS, calls.length, calls)).toBe(RESULTS);
  });
});
