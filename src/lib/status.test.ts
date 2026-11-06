import { describe, expect, it } from "vitest";
import { PALE, PARTY } from "./colors";
import { race } from "./fixture";
import { RUNOFF, raceFill, raceStatus, rcvNote, statusText } from "./status";

describe("raceStatus", () => {
  it("won: civicAPI winner, with or without a call timestamp", () => {
    expect(raceStatus(race("S", "AL"))).toBe("won");
    expect(race("H", "NY-21").calledAt).toBeNull();
    expect(raceStatus(race("H", "NY-21"))).toBe("won");
  });
  it("runoff: a candidate advanced (LA-05) or no majority under Louisiana's House rule (LA-06)", () => {
    expect(race("H", "LA-05").cands.filter((c) => c.advanced)).toHaveLength(2);
    expect(raceStatus(race("H", "LA-05"))).toBe("runoff");
    expect(race("H", "LA-06").cands.some((c) => c.advanced)).toBe(false);
    expect(raceStatus(race("H", "LA-06"))).toBe("runoff");
  });
  it("decided: both finalists from one party", () => {
    expect(raceStatus(race("H", "CA-04"))).toBe("decided");
    expect(raceStatus(race("H", "CA-40"))).toBe("decided");
  });
  it("leading: everything else", () => {
    expect(raceStatus(race("S", "AK"))).toBe("leading");
    expect(raceStatus(race("H", "TN-04"))).toBe("leading");
  });
  it("unopposed races are won, even with zero votes reported (Florida does not print them)", () => {
    const fl10 = race("H", "FL-10");
    expect(fl10.unopposed).toBe(true);
    expect(fl10.total).toBe(0);
    expect(raceStatus(fl10)).toBe("won");
  });
});

describe("raceFill", () => {
  it("full party color once the seat's party is certain", () => {
    expect(raceFill(race("S", "TX"))).toBe(PARTY.D);
    expect(raceFill(race("S", "AL"))).toBe(PARTY.R);
    expect(raceFill(race("H", "CA-04"))).toBe(PARTY.D);
    expect(raceFill(race("H", "CA-40"))).toBe(PARTY.R);
  });
  it("pale while only leading, gray for runoffs", () => {
    expect(raceFill(race("S", "AK"))).toBe(PALE.D);
    expect(raceFill(race("H", "AK-AL"))).toBe(PALE.R);
    expect(raceFill(race("H", "LA-05"))).toBe(RUNOFF);
  });
});

describe("statusText", () => {
  it("called races", () => {
    expect(statusText(race("S", "AL"))).toBe("Winner called");
    expect(statusText(race("S", "TX"))).toBe("Winner called. Flipped from Republican");
    expect(statusText(race("H", "FL-10"))).toBe("Unopposed");
  });
  it("runoffs name the finalists only once both are settled", () => {
    expect(statusText(race("H", "LA-05"))).toBe('Headed to a runoff: Patricia "Pat" Moore vs. Gabe Firment');
    expect(statusText(race("H", "LA-06"))).toBe("Headed to a runoff. No candidate won a majority");
  });
  it("uncalled races", () => {
    expect(statusText(race("H", "CA-04"))).toBe("Not called. Both finalists are Democrats");
    expect(statusText(race("S", "MS"))).toBe("Not called. Democrat leads by 0.2 points");
    expect(statusText(race("S", "AK"))).toBe("Not called. Democrat leads by 0.3 points in first-choice votes");
    expect(statusText({ ...race("S", "MS"), margin: 0.04 })).toBe("Not called. Democrat leads by <0.1 points");
  });
});

describe("rcvNote", () => {
  it("Alaska and Maine federal races, only while nobody has a majority of first choices", () => {
    expect(rcvNote(race("S", "AK"))).toMatch(/^Alaska uses ranked-choice voting/);
    expect(rcvNote(race("G", "AK"))).toMatch(/^Alaska uses ranked-choice voting/);
    expect(rcvNote(race("H", "AK-AL"))).not.toBeNull();
    const maineClose = { ...race("S", "ME"), cands: race("S", "ME").cands.map((c, i) => ({ ...c, pct: i === 0 ? 49 : c.pct })) };
    expect(rcvNote(maineClose)).toMatch(/^Maine, in federal races,/);
  });
  it("silent once the leader tops 50%, outside Alaska and Maine, and for Maine's governor", () => {
    expect(race("S", "ME").cands[0]?.pct).toBeGreaterThan(50);
    expect(rcvNote(race("S", "ME"))).toBeNull();
    expect(rcvNote(race("S", "MS"))).toBeNull();
    const maineGovernor = { ...race("S", "ME"), office: "G" as const, cands: race("S", "ME").cands.map((c) => ({ ...c, pct: 45 })) };
    expect(rcvNote(maineGovernor)).toBeNull();
  });
});
