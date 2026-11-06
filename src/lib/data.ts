import { buildGeo, type Atlas, type Geo } from "./geo";
import type { History } from "./history";
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

/** County breakdowns for the Senate, governor and measure maps: a third of the page's data, needed only once a county map shows. */
export async function loadCounties(): Promise<CountySets> {
  const [S, G, B] = await Promise.all([getJson<CountyResults>("counties-S.json"), getJson<CountyResults>("counties-G.json"), getJson<CountyResults>("counties-B.json")]);
  return { S, G, B };
}

export async function loadData(): Promise<Data> {
  const [results, hexes] = await Promise.all([loadResults(), getJson<HexCell[]>("house-hex.json")]);
  return { results, hexes };
}

/** How each uncalled race's margin has moved over the last week (pipeline/history.py). Small; fetched after first paint. */
export async function loadHistory(): Promise<History> {
  return getJson<History>("history.json");
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
