import { buildGeo, type Atlas, type Geo } from "./geo";
import type { History } from "./history";
import type { CountyResults, CountySets, HexCell, Race, Results } from "./types";

/** What changes on every data run. */
export interface Live {
  results: Results;
  counties: CountySets;
}

/** Everything the page needs except the map shapes, which arrive separately (see loadAtlas). */
export interface Data extends Live {
  hexes: HexCell[];
}

async function getJson<T>(file: string): Promise<T> {
  const res = await fetch(`./data/${file}`, { cache: "no-cache" });
  if (!res.ok) throw new Error(`Could not load ${file} (HTTP ${res.status})`);
  return (await res.json()) as T;
}

/** The results and county breakdowns; refetched while the page stays open. */
export async function loadLive(): Promise<Live> {
  const [results, S, G, B] = await Promise.all([
    getJson<Results>("results.json"),
    getJson<CountyResults>("counties-S.json"),
    getJson<CountyResults>("counties-G.json"),
    getJson<CountyResults>("counties-B.json"),
  ]);
  return { results, counties: { S, G, B } };
}

export async function loadData(): Promise<Data> {
  const [live, hexes] = await Promise.all([loadLive(), getJson<HexCell[]>("house-hex.json")]);
  return { ...live, hexes };
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
