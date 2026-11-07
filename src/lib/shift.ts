import { countyColumns } from "./data";
import type { Party, Race } from "./types";

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

/** The two sides a race is read by: Democrat and Republican, or Yes and No for a measure. */
export const sides = (race: Race): [Party, Party] => (race.office === "B" ? ["Y", "N"] : ["D", "R"]);

/**
 * True when the race's two sides finished first and second. A race reads against the presidential vote, and enters the
 * county patterns, only then: with an independent in the top two (Montana, Nebraska, Idaho, South Dakota, Rhode Island
 * and Wyoming in 2026) the two-party margin says nothing about the electorate's direction.
 */
export function headToHead(race: Race): boolean {
  const [a, b] = race.cands.filter((c) => c.party !== "O");
  const [left, right] = sides(race);
  return !!a && !!b && ((a.party === left && b.party === right) || (a.party === right && b.party === left));
}

/** Statewide races only, head to head: a district has no statewide baseline and a measure no presidential one. */
const comparable = (race: Race) => (race.office === "S" || race.office === "G") && headToHead(race);

/** A race's Democratic and Republican vote, same-party candidates summed; null for a party with nobody on the ballot. */
export function partyVotes(race: Race): { dem: number | null; rep: number | null } {
  const sum = (p: "D" | "R") => {
    const cs = race.cands.filter((c) => c.party === p);
    return cs.length ? cs.reduce((s, c) => s + c.votes, 0) : null;
  };
  return { dem: sum("D"), rep: sum("R") };
}

/** A county row's votes for two sides ([pctIn, votes per county column..., all other votes]); null for a side with no column. */
export function countyVotes(race: Race, row: number[], [left, right]: [Party, Party]): { left: number | null; right: number | null; total: number } {
  const cols = countyColumns(race);
  const votes = row.slice(1, -1);
  const sum = (p: Party) => {
    const idx = cols.map((c, i) => (c.party === p ? i : -1)).filter((i) => i >= 0);
    return idx.length ? idx.reduce((s, i) => s + (votes[i] ?? 0), 0) : null;
  };
  return { left: sum(left), right: sum(right), total: row.slice(1).reduce((s, v) => s + v, 0) };
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

/** How a race moved against the 2024 presidential vote in its state. Statewide offices only: a district has no such baseline. */
export function raceShift(race: Race, baseline: Baseline): Shift | null {
  if (!comparable(race)) return null;
  const { dem, rep } = partyVotes(race);
  return shiftOf(twoPartyMargin(dem, rep, race.total), baseline.states[race.state]);
}

/** How one county moved against its 2024 presidential vote. */
export function countyShift(race: Race, row: number[], fips: string, baseline: Baseline): Shift | null {
  if (!comparable(race)) return null;
  const { left, right, total } = countyVotes(race, row, ["D", "R"]);
  return shiftOf(twoPartyMargin(left, right, total), baseline.counties[fips]);
}

/** The races of an office that have a shift, taken together: their vote against their states' 2024 vote, by votes. */
export function officeShift(races: Race[], baseline: Baseline): { shift: Shift; races: number } | null {
  let dem = 0, rep = 0, total = 0, thenDem = 0, thenRep = 0, thenTotal = 0, n = 0;
  for (const r of races) {
    if (raceShift(r, baseline) === null) continue;
    const pv = partyVotes(r);
    const then = baseline.states[r.state] as [number, number, number];
    dem += pv.dem as number;
    rep += pv.rep as number;
    total += r.total;
    thenDem += then[0];
    thenRep += then[1];
    thenTotal += then[2];
    n += 1;
  }
  const now = twoPartyMargin(dem, rep, total);
  const before = twoPartyMargin(thenDem, thenRep, thenTotal);
  return n && now !== null && before !== null ? { shift: { then: before, now, shift: now - before }, races: n } : null;
}

/** The races that moved furthest toward one party since 2024, biggest move first; only moves in that direction. */
export function biggestShifts(races: Race[], baseline: Baseline, toward: "D" | "R", n: number): { race: Race; shift: Shift }[] {
  const sign = toward === "D" ? 1 : -1;
  return races
    .map((race) => ({ race, shift: raceShift(race, baseline) }))
    .filter((x): x is { race: Race; shift: Shift } => x.shift !== null && x.shift.shift * sign > 0)
    .sort((a, b) => (b.shift.shift - a.shift.shift) * sign)
    .slice(0, n);
}

/** "D +4.2", "R +0.9", "even". */
export const marginLabel = (n: number) => (Math.abs(n) < 0.05 ? "even" : `${n > 0 ? "D" : "R"} +${Math.abs(n).toFixed(1)}`);

/** "4.2 points more Democratic than the 2024 presidential vote (2024: R +0.9, now D +3.3)". */
export function shiftText(s: Shift): string {
  const detail = `2024: ${marginLabel(s.then)}, now ${marginLabel(s.now)}`;
  if (Math.abs(s.shift) < 0.05) return `In line with the 2024 presidential vote (${detail})`;
  return `${Math.abs(s.shift).toFixed(1)} points more ${s.shift > 0 ? "Democratic" : "Republican"} than the 2024 presidential vote (${detail})`;
}
