import { describe, expect, it } from "vitest";
import { race } from "./fixture";
import type { Candidate } from "./types";
import { biggestShifts, countyShift, officeShift, partyVotes, raceShift, shiftText, twoPartyMargin, twoPartyRace, type Baseline } from "./shift";

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
  it("is null for a House district, a state the baseline lacks or a race without both parties", () => {
    expect(raceShift(race("H", "WI-03"), { ...baseline, states: { WI: [1_668_229, 1_697_626, 3_422_918] } })).toBeNull();
    expect(raceShift(tx, { ...baseline, states: {} })).toBeNull();
    const noRep = { ...tx, cands: tx.cands.filter((c) => c.party !== "R") };
    expect(raceShift(noRep, baseline)).toBeNull();
  });
  it("is null when an independent finished in the top two, as in Montana", () => {
    const [a, b, ...rest] = tx.cands as [Candidate, Candidate, ...Candidate[]];
    const independentSecond = { ...tx, cands: [a, { ...b, party: "I" as const, partyName: "Independent" }, ...rest, { ...b, votes: 1, pct: 0.1 }] };
    expect(twoPartyRace(tx)).toBe(true);
    expect(twoPartyRace(independentSecond)).toBe(false);
    expect(raceShift(independentSecond, baseline)).toBeNull();
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

describe("officeShift and biggestShifts", () => {
  const me = race("S", "ME");
  const both: Baseline = { ...baseline, states: { ...baseline.states, ME: [430_000, 380_000, 830_000] } }; // D +6.0
  it("weights the races with a shift by their votes and counts them", () => {
    const all = officeShift([tx, me, race("H", "WI-03")], both);
    expect(all?.races).toBe(2);
    const { dem: d1, rep: r1 } = partyVotes(tx);
    const { dem: d2, rep: r2 } = partyVotes(me);
    const now = (100 * ((d1 as number) + (d2 as number) - (r1 as number) - (r2 as number))) / (tx.total + me.total);
    const then = (100 * (4_835_000 + 430_000 - 6_393_000 - 380_000)) / (11_400_000 + 830_000);
    expect(all?.shift.shift).toBeCloseTo(now - then, 5);
    expect(officeShift([race("H", "WI-03")], both)).toBeNull();
  });
  it("ranks moves toward one party, biggest first", () => {
    const d = biggestShifts([tx, me], both, "D", 3);
    const r = biggestShifts([tx, me], both, "R", 3);
    expect(d.every((x) => x.shift.shift > 0)).toBe(true);
    expect(r.every((x) => x.shift.shift < 0)).toBe(true);
    expect(d.length + r.length).toBe(2);
    expect(d.map((x) => x.shift.shift)).toEqual([...d.map((x) => x.shift.shift)].sort((a, b) => b - a));
  });
});

describe("shiftText", () => {
  it("names the direction and both margins", () => {
    expect(shiftText({ then: -0.9, now: 3.3, shift: 4.2 })).toBe("4.2 points more Democratic than the 2024 presidential vote (2024: R +0.9, now D +3.3)");
    expect(shiftText({ then: 2, now: -1, shift: -3 })).toBe("3.0 points more Republican than the 2024 presidential vote (2024: D +2.0, now R +1.0)");
    expect(shiftText({ then: 2, now: 2.01, shift: 0.01 })).toMatch(/^In line with the 2024 presidential vote/);
  });
});
