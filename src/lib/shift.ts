import { countyColumns } from "./data";
import type { Race } from "./types";

/** The 2024 presidential vote (pipeline/baseline.py): [Democratic, Republican, all votes] by county FIPS and by state. */
export interface Baseline {
  source: string;
  counties: Record<string, [number, number, number]>;
  states: Record<string, [number, number, number]>;
}

/** Democratic minus Republican share of all votes, in points; null when a side is absent or nothing is counted. */
export function twoPartyMargin(dem: number | null, rep: number | null, total: number): number | null {
  if (dem === null || rep === null || total <= 0) return null;
  return (100 * (dem - rep)) / total;
}

/** A race's Democratic and Republican vote, same-party candidates summed; null for a party with nobody on the ballot. */
export function partyVotes(race: Race): { dem: number | null; rep: number | null } {
  const sum = (p: "D" | "R") => {
    const cs = race.cands.filter((c) => c.party === p);
    return cs.length ? cs.reduce((s, c) => s + c.votes, 0) : null;
  };
  return { dem: sum("D"), rep: sum("R") };
}

/** The same for one county row ([pctIn, votes per county column..., all other votes]). */
export function countyPartyVotes(race: Race, row: number[]): { dem: number | null; rep: number | null; total: number } {
  const cols = countyColumns(race);
  const votes = row.slice(1, -1);
  const sum = (p: "D" | "R") => {
    const idx = cols.map((c, i) => (c.party === p ? i : -1)).filter((i) => i >= 0);
    return idx.length ? idx.reduce((s, i) => s + (votes[i] ?? 0), 0) : null;
  };
  return { dem: sum("D"), rep: sum("R"), total: row.slice(1).reduce((s, v) => s + v, 0) };
}

/** Margins in points, Democratic positive: the 2024 presidential vote, this race, and the difference. */
export interface Shift {
  then: number;
  now: number;
  shift: number;
}

const shiftOf = (now: number | null, then: [number, number, number] | undefined): Shift | null => {
  if (!then || now === null) return null;
  const before = twoPartyMargin(then[0], then[1], then[2]);
  return before === null ? null : { then: before, now, shift: now - before };
};

/** How a race moved against the 2024 presidential vote in its state. */
export function raceShift(race: Race, baseline: Baseline): Shift | null {
  const { dem, rep } = partyVotes(race);
  return shiftOf(twoPartyMargin(dem, rep, race.total), baseline.states[race.state]);
}

/** How one county moved against its 2024 presidential vote. */
export function countyShift(race: Race, row: number[], fips: string, baseline: Baseline): Shift | null {
  const { dem, rep, total } = countyPartyVotes(race, row);
  return shiftOf(twoPartyMargin(dem, rep, total), baseline.counties[fips]);
}

const pts = (n: number) => (Math.abs(n) < 0.05 ? "even" : `${n > 0 ? "D" : "R"} +${Math.abs(n).toFixed(1)}`);

/** "4.2 points more Democratic than the 2024 presidential vote (2024: R +0.9, now D +3.3)". */
export function shiftText(s: Shift): string {
  const detail = `2024: ${pts(s.then)}, now ${pts(s.now)}`;
  if (Math.abs(s.shift) < 0.05) return `In line with the 2024 presidential vote (${detail})`;
  return `${Math.abs(s.shift).toFixed(1)} points more ${s.shift > 0 ? "Democratic" : "Republican"} than the 2024 presidential vote (${detail})`;
}
