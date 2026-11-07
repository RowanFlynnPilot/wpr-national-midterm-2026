import { describe, expect, it } from "vitest";
import { race } from "./fixture";
import { binLabels, countyPatterns, patternRaces, type Demographics } from "./patterns";
import type { Candidate, CountyResults } from "./types";

const tx = race("S", "TX");
const cols = tx.cands.filter((c) => c.party !== "O").slice(0, 3);
const row = (dem: number, rep: number) => [100, ...cols.map((c) => (c.party === "D" ? dem : c.party === "R" ? rep : 10)), 5];
const counties: CountyResults = { [String(tx.id)]: { "48453": row(300, 100), "48001": row(20, 80), "48002": row(10, 90) } };
const demographics: Demographics = {
  vintage: "test",
  counties: { "48453": [1000, 55, 80000, 50, 1200], "48001": [100, 15, 45000, 70, 20], "48002": [100, 12, null, 90, 10] },
};

describe("countyPatterns", () => {
  it("sums the vote within each bin and reports shares", () => {
    const bins = countyPatterns([tx], counties, demographics, "density", null);
    expect(bins.map((b) => b.label)).toEqual(binLabels("density"));
    const rural = bins[0] as (typeof bins)[number];
    const urban = bins[3] as (typeof bins)[number];
    expect(rural.counties).toBe(2);
    expect(urban.counties).toBe(1);
    expect(rural.dem).toBeCloseTo((100 * 30) / 230, 5);
    expect(rural.rep).toBeCloseTo((100 * 170) / 230, 5);
    expect(urban.shareOfVote + rural.shareOfVote).toBeCloseTo(100, 5);
    expect(rural.shift).toBeNull();
  });
  it("leaves out a county without the variable", () => {
    const bins = countyPatterns([tx], counties, demographics, "income", null);
    expect(bins.reduce((s, b) => s + b.counties, 0)).toBe(2); // 48002 has no median income
  });
  it("shifts against the 2024 vote over the counties that have one", () => {
    const baseline = { source: "t", states: {}, counties: { "48453": [250, 150, 420] as [number, number, number] } };
    const bins = countyPatterns([tx], counties, demographics, "density", baseline);
    const urban = bins[3] as (typeof bins)[number];
    const now = (100 * (300 - 100)) / (300 + 100 + 10 + 5);
    const then = (100 * (250 - 150)) / 420;
    expect(urban.shift).toBeCloseTo(now - then, 5);
    expect((bins[0] as (typeof bins)[number]).shift).toBeNull();
  });
});

describe("countyPatterns on a measure", () => {
  it("reads Yes and No", () => {
    const m = race("B", "WI-179849");
    const yesNo: CountyResults = { [String(m.id)]: { "55025": [100, 600, 400, 0], "55073": [100, 300, 700, 0] } };
    const demo: Demographics = { vintage: "t", counties: { "55025": [1, 50, 1, 50, 464], "55073": [1, 20, 1, 80, 300] } };
    const bins = countyPatterns([m], yesNo, demo, "density", null);
    const urban = bins[2] as (typeof bins)[number]; // 100–500 per square mile holds both
    expect(urban.counties).toBe(2);
    expect(urban.dem).toBeCloseTo(45, 5); // Yes
    expect(urban.rep).toBeCloseTo(55, 5); // No
  });
});

describe("patternRaces", () => {
  it("keeps races with county rows and both major parties", () => {
    expect(patternRaces([tx], counties)).toEqual([tx]);
    expect(patternRaces([tx], {})).toEqual([]);
    expect(patternRaces([{ ...tx, cands: tx.cands.filter((c) => c.party !== "D") }], counties)).toEqual([]);
    const [a, b, ...rest] = tx.cands as [Candidate, Candidate, ...Candidate[]];
    expect(patternRaces([{ ...tx, cands: [a, { ...b, party: "I" }, ...rest] }], counties)).toEqual([]); // an independent second
  });
});
