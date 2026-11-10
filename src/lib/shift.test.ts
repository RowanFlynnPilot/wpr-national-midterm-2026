import { describe, expect, it } from "vitest";
import { race, RESULTS } from "./fixture";
import type { Candidate } from "./types";
import { biggestShifts, county2024, countyFlip, countyFlips, countyFlipsText, countyShift, countyTurnoutVs2024, flipWays, officeShift, officeTurnout, partyVotes, raceShift, shiftText, summedNote, ticketPairs, turnoutVs2024, twoPartyMargin, headToHead, type Baseline } from "./shift";

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
  it("is null for a measure, which has no presidential baseline", () => {
    const measure = race("B", "WI-179849");
    expect(headToHead(measure)).toBe(true);
    expect(raceShift(measure, { ...baseline, states: { WI: [1_668_229, 1_697_626, 3_422_918] } })).toBeNull();
    expect(countyShift(measure, [100, 500, 400, 0], "55025", { ...baseline, counties: { "55025": [273_995, 85_454, 365_929] } })).toBeNull();
  });
  it("is null when an independent finished in the top two, as in Montana", () => {
    const [a, b, ...rest] = tx.cands as [Candidate, Candidate, ...Candidate[]];
    const independentSecond = { ...tx, cands: [a, { ...b, party: "I" as const, partyName: "Independent" }, ...rest, { ...b, votes: 1, pct: 0.1 }] };
    expect(headToHead(tx)).toBe(true);
    expect(headToHead(independentSecond)).toBe(false);
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

describe("countyFlips", () => {
  // county rows: [pctIn, votes for the race's three county columns (Talarico D, Paxton R, third), all other votes]
  const rows = { "48453": [100, 300, 100, 10, 5], "48001": [100, 100, 300, 0, 0] };
  const base: Baseline = { ...baseline, counties: { "48453": [150_000, 300_000, 470_000], "48001": [1_000, 3_000, 4_100] } };
  it("counts the counties whose side differs from 2024, each way, as the vote stands", () => {
    expect(countyFlip(tx, rows["48453"], "48453", base)).toBe("D"); // Republican in 2024, Democratic now
    expect(countyFlip(tx, rows["48001"], "48001", base)).toBeNull(); // Republican both times
    expect(countyFlips(tx, rows, base)).toEqual({ toD: 1, toR: 0, compared: 2 });
    expect(countyFlipsText({ toD: 1, toR: 0, compared: 2 })).toBe("1 of 2 counties changed sides since 2024, to Democrats");
    expect(countyFlipsText({ toD: 0, toR: 3, compared: 9 })).toBe("3 of 9 counties changed sides since 2024, all to Republicans");
    expect(countyFlipsText({ toD: 11, toR: 1, compared: 72 })).toBe("12 of 72 counties changed sides since 2024: 11 to Democrats, 1 to Republicans");
    expect(flipWays({ toD: 0, toR: 0, compared: 9 })).toBe("");
    expect(countyFlipsText({ toD: 0, toR: 0, compared: 9 })).toBe("None of the 9 counties with a 2024 figure changed sides");
  });
  it("skips counties without a 2024 figure or without votes, and races a district cannot read", () => {
    expect(countyFlips(tx, { "48999": [100, 1, 2, 0, 0] }, base)).toBeNull();
    expect(countyFlips(tx, { "48453": [0, 0, 0, 0, 0] }, base)).toBeNull();
    expect(countyFlips(race("H", "WI-03"), rows, base)).toBeNull();
  });
});

describe("turnout against 2024", () => {
  it("is the votes counted as a share of the state's 2024 presidential vote, statewide only", () => {
    expect(turnoutVs2024(tx, baseline)).toBeCloseTo((100 * tx.total) / 11_400_000, 5);
    expect(turnoutVs2024(race("H", "WI-03"), baseline)).toBeNull();
    expect(turnoutVs2024(tx, { ...baseline, states: {} })).toBeNull();
  });
  it("pools an office's races against their states, skipping those without a figure", () => {
    const ak = race("S", "AK");
    const base: Baseline = { ...baseline, states: { ...baseline.states, AK: [100_000, 200_000, 320_000] } };
    expect(officeTurnout([tx, ak, race("S", "ME"), race("H", "WI-03")], base)).toBeCloseTo((100 * (tx.total + ak.total)) / (11_400_000 + 320_000), 5);
  });
});

describe("a county against 2024", () => {
  it("reads the county's 2024 presidential vote as shares and a margin", () => {
    const then = county2024("48453", baseline);
    expect(then?.dem).toBeCloseTo(63.83, 1);
    expect(then?.rep).toBeCloseTo(31.91, 1);
    expect(then?.margin).toBeCloseTo(31.9, 1);
    expect(county2024("00000", baseline)).toBeNull();
  });
  it("is the county's votes counted so far against its 2024 presidential vote", () => {
    expect(countyTurnoutVs2024([98, 200_000, 100_000, 5_000], "48453", baseline)).toBeCloseTo(64.9, 1);
    expect(countyTurnoutVs2024([0, 0, 0, 0], "48453", baseline)).toBeNull();
    expect(countyTurnoutVs2024([98, 200_000, 100_000, 5_000], "00000", baseline)).toBeNull();
  });
});

describe("ticketPairs", () => {
  it("pairs each state's Senate and governor race, widest gap first, and flags the ones that split", () => {
    const pairs = ticketPairs(RESULTS.races);
    expect(pairs.map((p) => p.state)).toEqual(expect.arrayContaining(["TX", "AL"]));
    expect(pairs.some((p) => p.state === "FL")).toBe(false); // no governor race in the fixture
    for (let i = 1; i < pairs.length; i++) expect((pairs[i - 1] as { gap: number }).gap).toBeGreaterThanOrEqual((pairs[i] as { gap: number }).gap);
    for (const p of pairs) {
      expect(p.gap).toBeCloseTo(Math.abs(p.senateMargin - p.governorMargin), 5);
      expect(p.split).toBe(Math.sign(p.senateMargin) !== Math.sign(p.governorMargin));
    }
  });
});

describe("summedNote", () => {
  const cand = (party: Candidate["party"], id: number): Candidate => ({ ...(tx.cands[0] as Candidate), id, party });
  it("is silent when each party has one candidate", () => {
    expect(summedNote(tx)).toBeNull();
  });
  it("says whose votes are added together when a party has several candidates", () => {
    expect(summedNote({ ...tx, cands: [cand("D", 1), cand("R", 2), cand("R", 3), cand("R", 4)] })).toBe("The three Republicans’ votes are added together for this comparison");
    expect(summedNote({ ...tx, cands: [cand("D", 1), cand("D", 2), cand("R", 3)] })).toBe("The two Democrats’ votes are added together for this comparison");
    expect(summedNote({ ...tx, cands: [cand("D", 1), cand("D", 2), cand("R", 3), cand("R", 4)] })).toBe("Each party’s candidates are added together for this comparison");
  });
});
