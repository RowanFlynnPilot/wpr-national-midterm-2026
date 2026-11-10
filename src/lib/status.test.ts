import { describe, expect, it } from "vitest";
import { NO_RESULTS, PALE, PARTY } from "./colors";
import { RESULTS, race } from "./fixture";
import { callOrder, resultsAfter } from "./replay";
import { RUNOFF, calledText, raceFill, raceStatus, rcvNote, statusParts, statusText, whyNotCalled } from "./status";

describe("statusParts", () => {
  it("a timed call reads as the time alone, not 'Winner called' and the time", () => {
    expect(calledText(race("S", "AL"))).toBe("Called Nov. 3, 9:42 p.m. CST");
    expect(statusParts(race("S", "AL"))).toEqual(["Called Nov. 3, 9:42 p.m. CST"]);
    expect(statusParts(race("S", "TX"))).toEqual(["Called Nov. 3, 9:42 p.m. CST. Flipped from Republican"]);
  });
  it("a call without a time keeps the words; an uncalled race has no time", () => {
    expect(calledText(race("H", "NY-21"))).toBeNull();
    expect(statusParts(race("H", "NY-21"))).toEqual(["Winner called"]);
    expect(statusParts(race("S", "AK"))).toHaveLength(1);
    expect(statusParts(race("S", "AK"))[0]).toMatch(/^Not called/);
  });
  it("a measure keeps Passed or Failed beside the time", () => {
    const passed = { ...race("S", "AL"), office: "B" as const, winner: "Y" as const };
    expect(statusParts(passed)).toEqual(["Passed", "Called Nov. 3, 9:42 p.m. CST"]);
  });
});

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
    expect(statusText({ ...race("S", "MS"), margin: 0.04 })).toBe("Not called. Democrat leads by less than 0.1 points");
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
  it("a measure that needs more than a majority says so when Yes leads, or led, short of it", () => {
    const rule = { needs: 60, label: "60%", text: "Florida requires 60% of the vote to amend its constitution." };
    const [y, n] = race("B", "WI-179849").cands;
    const yesNo = (yes: number, winner: "Y" | "N" | null) => [
      { ...y!, party: "Y" as const, name: "Yes", pct: yes, winner: winner === "Y" },
      { ...n!, party: "N" as const, name: "No", pct: 100 - yes, winner: winner === "N" },
    ];
    const short = { ...race("B", "CA-150571"), rule, leader: "Y" as const, margin: 16.4, cands: yesNo(58.2, null) };
    expect(statusText(short)).toBe("Not called. Yes leads by 16.4 points but is under the 60% needed");
    expect(statusText({ ...short, rule: null })).toBe("Not called. Yes leads by 16.4 points");
    expect(statusText({ ...short, cands: yesNo(61, null) })).toBe("Not called. Yes leads by 16.4 points");
    const failed = { ...short, winner: "N" as const, cands: yesNo(58.2, "N") };
    expect(statusText(failed)).toBe("Failed: Yes 58.2% fell short of the 60% required");
    expect(statusText({ ...failed, rule: null })).toBe("Failed");
    expect(statusText({ ...failed, leader: "N" as const, cands: yesNo(40.9, "N") })).toBe("Failed");
  });
});

describe("rcvNote", () => {
  it("Alaska and Maine federal races, only while nobody has a majority of first choices", () => {
    expect(rcvNote(race("S", "AK"))).toMatch(/^Alaska uses ranked-choice voting.*on Nov\. 18\.$/);
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

describe("whyNotCalled", () => {
  it("gives the share still out and a lead under a point", () => {
    expect(whyNotCalled(race("S", "MS"))).toMatch(/^Not all of the vote is in: civicAPI shows \d+% reporting\. The lead is [\d,]+ votes, or 0\.\d points\.$/);
  });

  it("leads with ranked choice where no one has a majority of first choices", () => {
    const why = whyNotCalled(race("S", "AK"));
    expect(why).toMatch(/^No candidate has a majority of first-choice votes; if that holds, ranked-choice rounds decide the race\. Not all/);
    expect(why).toMatch(/The first-choice lead is [\d,]+ votes, or 0\.\d points\.$/);
  });

  it("ends a lead under a point with the recount rule the race carries", () => {
    const rule = "Tennessee has no recount on request.";
    expect(whyNotCalled({ ...race("H", "TN-04"), recount: rule })).toMatch(/points\. Tennessee has no recount on request\.$/);
    expect(whyNotCalled({ ...race("H", "AK-AL"), recount: rule })).not.toContain("Tennessee");
  });

  it("names the runoff and its date, and nothing else", () => {
    expect(whyNotCalled(race("H", "LA-06"))).toBe("No candidate won the majority Louisiana requires, so the top two finishers meet in a runoff on Dec. 12.");
  });

  it("says nothing with no reason in hand, for a called race, a measure, or a call a replay has undone", () => {
    expect(whyNotCalled(race("H", "CA-40"))).toBeNull();
    expect(whyNotCalled(race("S", "TX"))).toBeNull();
    expect(whyNotCalled(race("B", "CA-150571"))).toBeNull();
    const before = resultsAfter(RESULTS, 0, callOrder(RESULTS));
    const undone = before.races.filter((r) => r.undone);
    expect(undone.length).toBeGreaterThan(2);
    expect(undone.every((r) => r.winner === null && whyNotCalled(r) === null)).toBe(true);
  });
});
