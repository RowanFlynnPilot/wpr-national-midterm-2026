import { describe, expect, it } from "vitest";
import { RESULTS, race } from "./fixture";
import { chamber, controller, dek, headline, housePopularVote, secured } from "./summary";

const senate = chamber(RESULTS, "S");
const house = chamber(RESULTS, "H");
const governors = chamber(RESULTS, "G");

describe("chamber", () => {
  it("tallies Senate races into won, leading and seats not up", () => {
    expect(senate.won).toEqual({ D: 2, R: 2, I: 0, O: 0 }); // ME, TX / AL, FL
    expect(senate.leading).toEqual({ D: 2, R: 0, I: 0, O: 0 }); // AK, MS
    expect(senate.decided).toEqual({ D: 0, R: 0, I: 0, O: 0 });
    expect(senate.notUp).toEqual({ D: 34, R: 31, I: 0, O: 0 });
    expect(senate.before).toEqual({ D: 47, R: 53 });
    expect(senate.total).toBe(100);
    expect(senate.majority).toBe(51);
  });
  it("tallies House races, counting same-party finals as decided and runoffs separately", () => {
    expect(house.won).toEqual({ D: 2, R: 1, I: 0, O: 0 }); // FL-10, WI-03 / NY-21
    expect(house.decided).toEqual({ D: 1, R: 1, I: 0, O: 0 }); // CA-04 / CA-40
    expect(house.leading).toEqual({ D: 1, R: 1, I: 0, O: 0 }); // TN-04 / AK-AL
    expect(house.runoffs.map((r) => r.district)).toEqual(["LA-05", "LA-06"]);
    expect(house.notUp).toEqual({ D: 0, R: 0, I: 0, O: 0 });
    expect(house.majority).toBe(218);
  });
  it("tallies governors", () => {
    expect(governors.won).toEqual({ D: 2, R: 1, I: 0, O: 0 }); // NV, TX / AL
    expect(governors.leading).toEqual({ D: 1, R: 0, I: 0, O: 0 }); // AK
    expect(governors.notUp).toEqual({ D: 6, R: 8, I: 0, O: 0 });
    expect(governors.total).toBe(50);
  });
  it("lists uncalled races closest first, including runoffs, and flips among called races", () => {
    expect(senate.uncalled.map((r) => r.state)).toEqual(["MS", "AK"]);
    expect(house.uncalled.map((r) => r.district)).toEqual(["TN-04", "LA-06", "LA-05", "CA-04", "CA-40", "AK-AL"]);
    expect(senate.flips.map((r) => r.state)).toEqual(["ME", "TX"]);
    expect(governors.flips.map((r) => r.state)).toEqual(["NV", "TX"]);
    expect(house.flips).toEqual([]); // House flips are deliberately not tracked
  });
  it("lists the latest calls newest first, skipping calls civicAPI gave no timestamp", () => {
    expect(race("H", "NY-21").calledAt).toBeNull();
    expect(house.latestCalls.map((r) => r.district)).toEqual(["WI-03"]);
    expect(senate.latestCalls.map((r) => r.state)).toEqual(["ME", "AL", "TX", "FL"]); // AL and TX share a timestamp
    const times = senate.latestCalls.map((r) => r.calledAt as string);
    expect(times).toEqual([...times].sort().reverse());
  });
});

describe("secured and controller", () => {
  it("counts seats not up, called, and same-party finals", () => {
    expect(secured(senate, "D")).toBe(36);
    expect(secured(senate, "R")).toBe(33);
    expect(secured(house, "D")).toBe(3);
    expect(secured(house, "R")).toBe(2);
    expect(controller(senate)).toBeNull();
  });
  it("a party controls a chamber once secured seats reach the majority line, leads do not count", () => {
    expect(controller({ ...senate, won: { D: 16, R: 2, I: 0, O: 0 } })).toBeNull(); // 34 + 16 = 50
    expect(controller({ ...senate, won: { D: 17, R: 2, I: 0, O: 0 } })).toBe("D");
    expect(controller({ ...senate, leading: { D: 30, R: 0, I: 0, O: 0 } })).toBeNull();
    expect(controller({ ...house, won: { D: 0, R: 217, I: 0, O: 0 } })).toBe("R"); // 217 + 1 decided
  });
});

describe("headline", () => {
  it("names the winner of each chamber, or that control is undecided", () => {
    expect(headline(house, senate)).toBe("Control of the House is still undecided; control of the Senate is still undecided");
    const dSenate = { ...senate, won: { D: 17, R: 2, I: 0, O: 0 } };
    expect(headline(house, dSenate)).toBe("Control of the House is still undecided; Democrats win the Senate");
    const rHouse = { ...house, won: { D: 0, R: 217, I: 0, O: 0 } };
    expect(headline(rHouse, dSenate)).toBe("Republicans win the House; Democrats win the Senate");
    expect(headline(rHouse, { ...senate, won: { D: 0, R: 20, I: 0, O: 0 } })).toBe("Republicans win the House and the Senate");
  });
});

describe("dek", () => {
  it("reads the seat counts, flips, races still counting and runoffs from the data", () => {
    expect(dek(house, senate, governors)).toBe(
      "Democrats have won 3 House seats to Republicans' 2 and, with the two independents who caucus with them, hold at least 36 Senate seats. " +
        "They flipped two Senate seats and two governor's offices. " +
        "Votes are still being counted in seven races, and two Louisiana House races are headed to runoffs.",
    );
  });
  it("drops the flip sentence when nothing flipped and uses AP number style", () => {
    const noFlips = { ...senate, flips: [] };
    const noGovFlips = { ...governors, flips: [] };
    expect(dek(house, noFlips, noGovFlips)).not.toContain("flipped");
    const rFlip = { ...governors, flips: [{ ...race("G", "TX"), winner: "R" as const }] };
    expect(dek(house, noFlips, rFlip)).toContain("Republicans flipped one governor's office.");
  });
  it("handles every race called, with and without runoffs", () => {
    const done = (c: typeof house) => ({ ...c, uncalled: [], runoffs: [] });
    expect(dek(done(house), done(senate), done(governors))).not.toContain("still being counted");
    const onlyRunoffs = { ...house, uncalled: house.runoffs };
    expect(dek(onlyRunoffs, done(senate), done(governors))).toMatch(/Two Louisiana House races are headed to runoffs\.$/);
  });
});

describe("housePopularVote", () => {
  it("sums every House vote by party and counts one-party ballots", () => {
    const v = housePopularVote(RESULTS);
    const houseRaces = RESULTS.races.filter((r) => r.office === "H");
    expect(v.total).toBe(houseRaces.reduce((s, r) => s + r.total, 0));
    expect(v.share.D + v.share.R + v.share.I + v.share.O).toBeCloseTo(100, 6);
    expect(v.noRepublican).toBe(2); // CA-04 (D vs. D), FL-10 (unopposed)
    expect(v.noDemocrat).toBe(1); // CA-40 (R vs. R)
  });
});
