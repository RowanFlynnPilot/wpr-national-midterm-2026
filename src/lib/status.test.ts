import { describe, expect, it } from "vitest";
import { NO_RESULTS, PALE, PARTY } from "./colors";
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
  it("no votes yet: neutral fill and plain text, never a painted lead", () => {
    const waiting = { ...race("S", "MS"), total: 0, cands: race("S", "MS").cands.map((c) => ({ ...c, votes: 0, pct: 0 })) };
    expect(raceFill(waiting)).toBe(NO_RESULTS);
    expect(statusText(waiting)).toBe("No votes reported yet");
    expect(raceFill(race("H", "FL-10"))).toBe(PARTY.D); // unopposed and called, zero votes printed
  });
});

describe("statusText", () => {
  it("called races", () => {
    expect(statusText(race("S", "AL"))).toBe("Winner called");
    expect(statusText(race("S", "TX"))).toBe("Winner called. Flipped from Republican");
    expect(statusText(race("H", "FL-10"))).toBe("Unopposed");
  });
  it("runoffs name the finalists only once both are settled", () => {
    expect(statusText(race("H", "LA-05"))).toBe('Headed to a Dec. 12 runoff: Patricia "Pat" Moore vs. Gabe Firment');
    expect(statusText(race("H", "LA-06"))).toBe("Headed to a Dec. 12 runoff. No candidate won a majority");
    expect(statusText({ ...race("H", "LA-06"), state: "GA" })).toBe("Headed to a runoff. No candidate won a majority");
  });
  it("uncalled races", () => {
    expect(statusText(race("H", "CA-04"))).toBe("Seat decided: both finalists are Democrats. Winner not called");
    expect(statusText(race("S", "MS"))).toBe("Not called. Democrat leads by 0.2 points");
    expect(statusText(race("S", "AK"))).toBe("Not called. Democrat leads by 0.3 points in first-choice votes");
    expect(statusText({ ...race("S", "MS"), margin: 0.04 })).toBe("Not called. Democrat leads by <0.1 points");
  });
});

describe("ballot measures", () => {
  it("pass or fail on the call, lead by Yes or No before it, and never carry a ranked-choice note", () => {
    expect(statusText(race("B", "WI-179849"))).toBe("Passed");
    expect(statusText(race("B", "MO-87243"))).toBe("Failed");
    expect(statusText(race("B", "CA-150571"))).toBe("Not called. No leads by 2.7 points");
    expect(statusText(race("B", "VA-140000"))).toBe("No votes reported yet");
    expect(raceFill(race("B", "WI-179849"))).toBe(PARTY.Y);
    expect(raceFill(race("B", "CA-150571"))).toBe(PALE.N);
    expect(rcvNote({ ...race("B", "WI-179849"), state: "AK" })).toBeNull();
  });
});

describe("rcvNote", () => {
  it("Alaska and Maine federal races, only while nobody has a majority of first choices", () => {
    expect(rcvNote(race("S", "AK"))).toMatch(/^Alaska uses ranked-choice voting.*around Nov\. 18\.$/);
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
