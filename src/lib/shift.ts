import { apNumber } from "./format";
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

/** The side a county went to, by its two-party vote; null when a side is absent or nothing is counted or it is tied. */
const sideOf = (dem: number | null, rep: number | null): "D" | "R" | null => (dem === null || rep === null || dem === rep ? null : dem > rep ? "D" : "R");

/** The side a county changed to since the 2024 presidential vote, or null when it did not change or cannot be read. */
export function countyFlip(race: Race, row: number[], fips: string, baseline: Baseline): "D" | "R" | null {
  if (!comparable(race)) return null;
  const then = baseline.counties[fips];
  if (!then || then[2] <= 0) return null;
  const { left, right, total } = countyVotes(race, row, ["D", "R"]);
  if (total <= 0) return null;
  const now = sideOf(left, right);
  const before = sideOf(then[0], then[1]);
  return now && before && now !== before ? now : null;
}

/** The counties of a race that changed sides since 2024, each way, and how many could be compared. */
export interface CountyFlips {
  toD: number;
  toR: number;
  compared: number;
}

/** Counties that changed sides since the 2024 presidential vote, counted as the vote stands (a partial count can still change them). */
export function countyFlips(race: Race, rows: Record<string, number[]>, baseline: Baseline): CountyFlips | null {
  if (!comparable(race)) return null;
  let toD = 0, toR = 0, compared = 0;
  for (const [fips, row] of Object.entries(rows)) {
    const then = baseline.counties[fips];
    if (!then || then[2] <= 0 || countyVotes(race, row, ["D", "R"]).total <= 0) continue;
    compared += 1;
    const flip = countyFlip(race, row, fips, baseline);
    if (flip === "D") toD += 1;
    else if (flip === "R") toR += 1;
  }
  return compared ? { toD, toR, compared } : null;
}

/** "12 of 254 counties changed sides since 2024: 11 to Democrats, 1 to Republicans"; "No county changed sides since 2024". */
export function countyFlipsText(f: CountyFlips): string {
  const n = f.toD + f.toR;
  if (!n) return `None of the ${f.compared} counties with a 2024 figure changed sides`;
  return `${n} of ${f.compared} counties changed sides since 2024${flipWays(f)}`;
}

/** How the counties that changed sides divide, as the end of a sentence: ": 11 to Democrats, 1 to Republicans", ", all to Democrats", ", to Republicans" for one county, nothing when none did. */
export function flipWays(f: CountyFlips): string {
  const n = f.toD + f.toR;
  if (!n) return "";
  if (f.toD && f.toR) return `: ${f.toD} to Democrats, ${f.toR} to Republicans`;
  return `, ${n === 1 ? "" : "all "}to ${f.toD ? "Democrats" : "Republicans"}`;
}

/** A sentence for a race where one party's vote is several candidates' (Alaska's top-four general): the comparison adds them together. */
export function summedNote(race: Race): string | null {
  const count = (p: "D" | "R") => race.cands.filter((c) => c.party === p).length;
  const d = count("D");
  const r = count("R");
  if (d < 2 && r < 2) return null;
  if (d > 1 && r > 1) return "Each party’s candidates are added together for this comparison";
  return `The ${apNumber(Math.max(d, r))} ${d > 1 ? "Democrats" : "Republicans"}’ votes are added together for this comparison`;
}

/** Votes counted so far as a percentage of the state's 2024 presidential vote; statewide races and measures only. */
export function turnoutVs2024(race: Race, baseline: Baseline): number | null {
  if (race.office === "H") return null;
  const then = baseline.states[race.state];
  return then && then[2] > 0 && race.total > 0 ? (100 * race.total) / then[2] : null;
}

/** A county's votes counted so far in a race as a percentage of its 2024 presidential vote; null without a figure or votes. */
export function countyTurnoutVs2024(row: number[], fips: string, baseline: Baseline): number | null {
  const then = baseline.counties[fips];
  const now = row.slice(1).reduce((s, v) => s + v, 0);
  return then && then[2] > 0 && now > 0 ? (100 * now) / then[2] : null;
}

/** A county's 2024 presidential vote as shares of all its votes and a margin, Democratic positive; null without a figure. */
export function county2024(fips: string, baseline: Baseline): { dem: number; rep: number; margin: number } | null {
  const then = baseline.counties[fips];
  if (!then || then[2] <= 0) return null;
  return { dem: (100 * then[0]) / then[2], rep: (100 * then[1]) / then[2], margin: (100 * (then[0] - then[1])) / then[2] };
}

/** The races of an office with a 2024 figure, taken together: votes counted so far against their states' 2024 presidential vote. */
export function officeTurnout(races: Race[], baseline: Baseline): number | null {
  let now = 0, then = 0;
  for (const r of races) {
    const t = baseline.states[r.state];
    if (r.office === "H" || !t || t[2] <= 0 || r.total <= 0) continue;
    now += r.total;
    then += t[2];
  }
  return then ? (100 * now) / then : null;
}

/** A state that elected both a senator and a governor, head to head in both, with the two margins side by side. */
export interface TicketPair {
  state: string;
  senate: Race;
  governor: Race;
  senateMargin: number; // Democratic minus Republican share, points
  governorMargin: number;
  gap: number; // points between the two margins
  split: boolean; // the two races lead or went to different parties
}

const dMinusR = (race: Race): number | null => {
  const { dem, rep } = partyVotes(race);
  return twoPartyMargin(dem, rep, race.total);
};

/** Every state with a Senate and a governor race both read head to head, widest gap between the two first. */
export function ticketPairs(races: Race[]): TicketPair[] {
  const out: TicketPair[] = [];
  for (const governor of races) {
    if (governor.office !== "G") continue;
    const senates = races.filter((r) => r.office === "S" && r.state === governor.state);
    const senate = senates.find((r) => !r.special) ?? senates[0]; // a state with two Senate races pairs its regular one
    if (!senate || !headToHead(senate) || !headToHead(governor)) continue;
    const s = dMinusR(senate);
    const g = dMinusR(governor);
    if (s === null || g === null) continue;
    out.push({ state: governor.state, senate, governor, senateMargin: s, governorMargin: g, gap: Math.abs(s - g), split: Math.sign(s) !== Math.sign(g) });
  }
  return out.sort((a, b) => b.gap - a.gap);
}
