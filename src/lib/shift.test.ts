import { describe, expect, it } from "vitest";
import { race } from "./fixture";
import { countyShift, partyVotes, raceShift, shiftText, twoPartyMargin, type Baseline } from "./shift";

const tx = race("S", "TX");
const baseline: Baseline = {
  source: "test",
  states: { TX: [4_835_000, 6_393_000, 11_400_000] }, // R +13.7
  counties: { "48453": [300_000, 150_000, 470_000] }, // Travis: D +31.9
};

describe("twoPartyMargin", () => {
  it("is Democratic minus Republican share of every vote, in points", () => {
    expect(twoPartyMargin(60, 40, 100)).toBeCloseTo(20);
    expect(twoPartyMargin(45, 50, 110)).toBeCloseTo(-4.545, 2);
  });
  it("is null without both parties or without votes", () => {
    expect(twoPartyMargin(null, 40, 100)).toBeNull();
    expect(twoPartyMargin(10, 5, 0)).toBeNull();
  });
});

describe("raceShift", () => {
  it("compares the race's two-party margin with the state's 2024 presidential vote", () => {
    const { dem, rep } = partyVotes(tx);
    expect(dem).not.toBeNull();
    expect(rep).not.toBeNull();
    const s = raceShift(tx, baseline);
    expect(s).not.toBeNull();
    expect(s?.then).toBeCloseTo(-13.67, 1);
    expect(s?.now).toBeCloseTo((100 * ((dem as number) - (rep as number))) / tx.total, 5);
    expect(s?.shift).toBeCloseTo((s?.now as number) - (s?.then as number), 5);
  });
  it("is null for a state the baseline lacks or a race without both parties", () => {
    expect(raceShift(tx, { ...baseline, states: {} })).toBeNull();
    const noRep = { ...tx, cands: tx.cands.filter((c) => c.party !== "R") };
    expect(raceShift(noRep, baseline)).toBeNull();
  });
});

describe("countyShift", () => {
  it("reads the county's D and R columns against its 2024 vote", () => {
    // Travis County row: [pctIn, votes for cands[0..2], other]
    const cols = tx.cands.filter((c) => c.party !== "O").slice(0, 3);
    const row = [100, ...cols.map((c) => (c.party === "D" ? 350_000 : c.party === "R" ? 140_000 : 5_000)), 2_000];
    const s = countyShift(tx, row, "48453", baseline);
    expect(s).not.toBeNull();
    expect(s?.then).toBeCloseTo(31.9, 1);
    expect(countyShift(tx, row, "48999", baseline)).toBeNull();
  });
});

describe("shiftText", () => {
  it("names the direction and both margins", () => {
    expect(shiftText({ then: -0.9, now: 3.3, shift: 4.2 })).toBe("4.2 points more Democratic than the 2024 presidential vote (2024: R +0.9, now D +3.3)");
    expect(shiftText({ then: 2, now: -1, shift: -3 })).toBe("3.0 points more Republican than the 2024 presidential vote (2024: D +2.0, now R +1.0)");
    expect(shiftText({ then: 2, now: 2.01, shift: 0.01 })).toMatch(/^In line with the 2024 presidential vote/);
  });
});
