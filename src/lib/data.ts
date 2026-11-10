import { buildGeo, type Atlas, type Geo } from "./geo";
import type { History } from "./history";
import type { Demographics } from "./patterns";
import type { Baseline } from "./shift";
import type { CountyResults, CountySets, HexCell, Race, Results } from "./types";

/** What the first render needs. County breakdowns, the map shapes and the count history follow after the first paint. */
export interface Data {
  results: Results;
  hexes: HexCell[];
}

async function getJson<T>(file: string): Promise<T> {
  const res = await fetch(`./data/${file}`, { cache: "no-cache" });
  if (!res.ok) throw new Error(`Could not load ${file} (HTTP ${res.status})`);
  return (await res.json()) as T;
}

export const loadResults = () => getJson<Results>("results.json");

/** One office's county breakdowns (the single-race embed loads only the file its race needs). */
export const loadCountySet = (office: "S" | "G" | "B" | "H") => getJson<CountyResults>(`counties-${office}.json`);

/** County breakdowns for the Senate, governor and measure maps and, for the county pages, the House: needed only once a county map or page shows. */
export async function loadCounties(): Promise<CountySets> {
  const [S, G, B, H] = await Promise.all([loadCountySet("S"), loadCountySet("G"), loadCountySet("B"), loadCountySet("H")]);
  return { S, G, B, H };
}

export async function loadData(): Promise<Data> {
  const [results, hexes] = await Promise.all([loadResults(), getJson<HexCell[]>("house-hex.json")]);
  return { results, hexes };
}

/**
 * Resolves a moment after the first app frame is on screen. The deferred files (counties, atlas, history) wait on this:
 * an effect runs before that frame is presented, frame callbacks fire before a frame's render, and the browser reports
 * the headline's paint some tens of milliseconds after that, so on a fast connection the files would land first and the
 * largest contentful paint would be charged for them. Two frames and PAINT_MARGIN_MS clear it; the maps wait on a
 * second-long atlas fetch anyway.
 */
export function afterPaint(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(resolve, PAINT_MARGIN_MS))));
}

const PAINT_MARGIN_MS = 150;

/** How each uncalled race's margin has moved over the last week (pipeline/history.py). Small; fetched after first paint. */
export async function loadHistory(): Promise<History> {
  return getJson<History>("history.json");
}

/** County demographics from the Census (pipeline/demographics.py), for the "how counties voted" block. */
export async function loadDemographics(): Promise<Demographics> {
  return getJson<Demographics>("demographics.json");
}

/** The 2024 presidential vote by county and state (pipeline/baseline.py), for the shift layer. */
export async function loadBaseline(): Promise<Baseline> {
  return getJson<Baseline>("baseline-2024.json");
}

/** The county and state shapes: the largest file, so the page renders before it lands. */
export async function loadAtlas(): Promise<Geo> {
  return buildGeo(await getJson<Atlas>("us-albers-10m.json"));
}

/** The party code of each candidate column in a county row (race.cands minus the "Others" bucket). */
export function countyColumns(race: Race) {
  return race.cands.filter((c) => c.party !== "O").slice(0, 3);
}

export interface CountyReading {
  pctIn: number;
  total: number;
  leaderIndex: number; // index into countyColumns(race)
  margin: number; // points between the county's top two
  shares: number[]; // percent for each county column
}

export function readCounty(row: number[]): CountyReading | null {
  const [pctIn = 0, ...rest] = row;
  const main = rest.slice(0, -1);
  const total = rest.reduce((s, v) => s + v, 0);
  if (!total) return null;
  const order = main.map((v, i) => [v, i] as const).sort((a, b) => b[0] - a[0]);
  const shares = main.map((v) => (100 * v) / total);
  const first = order[0] as readonly [number, number];
  const second = order[1]?.[0] ?? 0;
  return { pctIn, total, leaderIndex: first[1], margin: (100 * (first[0] - second)) / total, shares };
}
