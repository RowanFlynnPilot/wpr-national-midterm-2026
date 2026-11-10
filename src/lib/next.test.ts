import { describe, expect, it } from "vitest";
import { RESULTS } from "./fixture";
import { upcoming } from "./next";
import type { KeyDate, Office } from "./types";

const DATES: KeyDate[] = [
  { date: "2026-11-10", state: "MS", text: "Mississippi mail ballots are due." },
  { date: "2026-11-12", state: "LA", offices: ["H"], text: "Louisiana registration closes." },
  { date: "2026-11-18", state: "AK", text: "Alaska runs its tabulation." },
  { date: "2026-11-19", state: "TX", text: "Texas has no race still open in the fixture." },
  { date: "2026-11-28", end: "2026-12-05", state: "LA", offices: ["H"], text: "Louisiana early voting." },
];
const days = (office: Office, now: string) => upcoming(DATES, RESULTS.races, office, Date.parse(now)).map((d) => `${d.state} ${d.date}`);

describe("upcoming", () => {
  it("keeps the dates of states where the office has a race not yet called", () => {
    expect(days("S", "2026-11-09T18:00:00Z")).toEqual(["MS 2026-11-10", "AK 2026-11-18"]);
    expect(days("G", "2026-11-09T18:00:00Z")).toEqual(["AK 2026-11-18"]);
  });

  it("limits a date to the offices it names", () => {
    expect(days("H", "2026-11-09T18:00:00Z")).toEqual(["LA 2026-11-12", "AK 2026-11-18", "LA 2026-11-28"]);
  });

  it("drops a date once its day is over in Central time", () => {
    expect(days("S", "2026-11-11T05:00:00Z")).toEqual(["MS 2026-11-10", "AK 2026-11-18"]);
    expect(days("S", "2026-11-11T06:00:00Z")).toEqual(["AK 2026-11-18"]);
  });

  it("keeps a span until its last day", () => {
    expect(days("H", "2026-12-03T18:00:00Z")).toEqual(["LA 2026-11-28"]);
    expect(days("H", "2026-12-06T06:00:00Z")).toEqual([]);
  });

  it("gives the measures tab none", () => {
    expect(days("B", "2026-11-09T18:00:00Z")).toEqual([]);
  });
});
