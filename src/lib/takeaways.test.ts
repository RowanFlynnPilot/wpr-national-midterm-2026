import { describe, expect, it } from "vitest";
import { RESULTS } from "./fixture";
import { chamber } from "./summary";
import { takeaways } from "./takeaways";
import type { Office } from "./types";

const chambers = Object.fromEntries((["S", "H", "G", "B"] as Office[]).map((o) => [o, chamber(RESULTS, o)])) as Record<Office, ReturnType<typeof chamber>>;

describe("takeaways", () => {
  it("leads with the closest statewide race still being counted and links every item to a view", () => {
    const list = takeaways(RESULTS, chambers, null);
    expect(list.length).toBeGreaterThanOrEqual(3);
    expect(list.length).toBeLessThanOrEqual(6);
    const open = RESULTS.races.filter((r) => (r.office === "S" || r.office === "G") && !r.winner && !r.runoff && r.total > 0).sort((a, b) => a.margin - b.margin)[0];
    expect(open).toBeDefined();
    expect(list[0]?.text).toContain("closest race still being counted");
    expect(list[0]?.to).toEqual({ office: open?.office, state: open?.state, district: null });
    for (const t of list) {
      expect(t.text.length).toBeGreaterThan(20);
      expect(["S", "H", "G", "B"]).toContain(t.to.office);
    }
  });

  it("adds the move since 2024 once a baseline is given", () => {
    const states = Object.fromEntries(RESULTS.races.filter((r) => r.office === "S").map((r) => [r.state, [1_000_000, 1_100_000, 2_200_000] as [number, number, number]]));
    const withBase = takeaways(RESULTS, chambers, { source: "t", states, counties: {} });
    const without = takeaways(RESULTS, chambers, null);
    expect(withBase.some((t) => t.text.includes("than the 2024 presidential vote"))).toBe(true);
    expect(without.some((t) => t.text.includes("than the 2024 presidential vote"))).toBe(false);
  });
});
