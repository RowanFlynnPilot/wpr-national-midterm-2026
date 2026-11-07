import { countyPartyVotes, twoPartyRace, type Baseline } from "./shift";
import type { CountyResults, Race } from "./types";

/** County demographics (pipeline/demographics.py): [population, collegePct, medianIncome | null, whiteNhPct, density]. */
export interface Demographics {
  vintage: string;
  counties: Record<string, [number, number, number | null, number, number]>;
}

export type Variable = "density" | "college" | "income" | "white";

interface VariableSpec {
  label: string; // the menu entry
  index: 1 | 2 | 3 | 4; // position in a demographics row
  edges: [number, number, number]; // three cut points: four bins
  bin: (edge: number) => string; // how an edge reads in a bin label
}

export const VARIABLES: Record<Variable, VariableSpec> = {
  density: { label: "People per square mile", index: 4, edges: [25, 100, 500], bin: (n) => String(n) },
  college: { label: "Adults with a bachelor's degree", index: 1, edges: [20, 30, 40], bin: (n) => `${n}%` },
  income: { label: "Median household income", index: 2, edges: [50000, 65000, 80000], bin: (n) => `$${n / 1000}K` },
  white: { label: "White, non-Hispanic share", index: 3, edges: [50, 75, 90], bin: (n) => `${n}%` },
};

/** The four bins' labels: "Under 25", "25–100", "100–500", "500 or more". */
export function binLabels(variable: Variable): string[] {
  const { edges, bin } = VARIABLES[variable];
  const [a, b, c] = edges;
  return [`Under ${bin(a)}`, `${bin(a)}–${bin(b)}`, `${bin(b)}–${bin(c)}`, `${bin(c)} or more`];
}

export interface Bin {
  label: string;
  counties: number;
  votes: number; // all votes counted in the bin's counties
  shareOfVote: number; // percent of the votes in every bin
  dem: number; // percent of the bin's votes
  rep: number;
  shift: number | null; // points against the 2024 presidential vote, over the counties with a baseline
}

/**
 * The vote in every county of the given races, grouped by one Census variable. Give it `patternRaces`: a race counts
 * only with a Democrat and a Republican first and second; a county only when it has votes and the variable.
 */
export function countyPatterns(races: Race[], counties: CountyResults, demographics: Demographics, variable: Variable, baseline: Baseline | null): Bin[] {
  const { index, edges } = VARIABLES[variable];
  const sums = binLabels(variable).map((label) => ({ label, counties: 0, votes: 0, dem: 0, rep: 0, withBase: { dem: 0, rep: 0, total: 0, then: [0, 0, 0] as [number, number, number] } }));
  for (const race of races) {
    const rows = counties[String(race.id)];
    if (!rows) throw new Error(`no county results for race ${race.id}`);
    for (const [fips, row] of Object.entries(rows)) {
      const { dem, rep, total } = countyPartyVotes(race, row);
      const value = demographics.counties[fips]?.[index];
      if (dem === null || rep === null || total <= 0 || value === null || value === undefined) continue;
      const i = edges.findIndex((e) => value < e);
      const bin = sums[i === -1 ? sums.length - 1 : i] as (typeof sums)[number];
      bin.counties += 1;
      bin.votes += total;
      bin.dem += dem;
      bin.rep += rep;
      const then = baseline?.counties[fips];
      if (then) {
        bin.withBase.dem += dem;
        bin.withBase.rep += rep;
        bin.withBase.total += total;
        bin.withBase.then = [bin.withBase.then[0] + then[0], bin.withBase.then[1] + then[1], bin.withBase.then[2] + then[2]];
      }
    }
  }
  const all = sums.reduce((s, b) => s + b.votes, 0);
  return sums.map((b) => {
    const wb = b.withBase;
    const [thenDem, thenRep, thenTotal] = wb.then;
    const shift = wb.total > 0 && thenTotal > 0 ? (100 * (wb.dem - wb.rep)) / wb.total - (100 * (thenDem - thenRep)) / thenTotal : null;
    return {
      label: b.label,
      counties: b.counties,
      votes: b.votes,
      shareOfVote: all ? (100 * b.votes) / all : 0,
      dem: b.votes ? (100 * b.dem) / b.votes : 0,
      rep: b.votes ? (100 * b.rep) / b.votes : 0,
      shift,
    };
  });
}

/** Races that can enter the patterns: county rows loaded, and a Democrat and a Republican first and second. */
export function patternRaces(races: Race[], counties: CountyResults): Race[] {
  return races.filter((r) => counties[String(r.id)] && twoPartyRace(r));
}
