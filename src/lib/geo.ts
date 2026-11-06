import { geoPath } from "d3-geo";
import { feature, mesh } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
import { STATES } from "./states";

// public/data/us-albers-10m.json is us-atlas's counties-albers-10m.json (Census cartographic
// boundaries pre-projected to Albers USA in a 975x610 frame), fetched alongside the results
// rather than bundled. Paths need no projection at runtime.
export type Atlas = Topology<{
  counties: GeometryCollection<{ name: string }>;
  states: GeometryCollection<{ name: string }>;
  nation: GeometryCollection;
}>;

export const VIEW = { width: 975, height: 610 };

export interface Shape {
  id: string; // FIPS
  name: string;
  d: string;
  centroid: [number, number];
  bounds: [[number, number], [number, number]];
}

export interface StateShape extends Shape {
  code: string;
}

export interface Geo {
  counties: Shape[];
  states: StateShape[];
  stateBorders: string;
  nation: string;
  countiesByState: Map<string, Shape[]>;
}

const path = geoPath(null);
const CHUNK = 400; // counties per task: 3,200 path strings in one go would block a phone for a quarter second
const yieldToMain = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

type Feature = GeoJSON.Feature<GeoJSON.Geometry, { name: string }>;

function shape(f: Feature): Shape {
  return { id: String(f.id), name: f.properties.name, d: path(f) ?? "", centroid: path.centroid(f), bounds: path.bounds(f) };
}

async function shapes(topo: Atlas, object: GeometryCollection<{ name: string }>): Promise<Shape[]> {
  const feats = feature(topo, object).features;
  const out: Shape[] = [];
  for (let i = 0; i < feats.length; i += CHUNK) {
    out.push(...feats.slice(i, i + CHUNK).map(shape));
    if (i + CHUNK < feats.length) await yieldToMain();
  }
  return out;
}

export async function buildGeo(topo: Atlas): Promise<Geo> {
  const counties = await shapes(topo, topo.objects.counties);
  const states = (await shapes(topo, topo.objects.states))
    .filter((s) => s.id in STATES && s.id !== "11")
    .map((s) => ({ ...s, code: (STATES[s.id] as { code: string }).code }));
  const countiesByState = new Map<string, Shape[]>();
  for (const c of counties) {
    const code = STATES[c.id.slice(0, 2)]?.code;
    if (!code) continue;
    const list = countiesByState.get(code) ?? [];
    list.push(c);
    countiesByState.set(code, list);
  }
  return {
    counties,
    states,
    stateBorders: path(mesh(topo, topo.objects.states, (a, b) => a !== b)) ?? "",
    nation: path(mesh(topo, topo.objects.nation)) ?? "",
    countiesByState,
  };
}

export function stateShape(geo: Geo, code: string): StateShape {
  const s = geo.states.find((x) => x.code === code);
  if (!s) throw new Error(`no shape for ${code}`);
  return s;
}

// Label nudges where a state's centroid falls awkwardly (bays, panhandles, peninsulas).
export const LABEL_NUDGE: Record<string, [number, number]> = {
  FL: [12, 6], LA: [-8, -2], MI: [8, 14], ID: [0, 12], KY: [4, 2], WV: [-2, 4], VA: [6, 2],
  CA: [-6, 0], HI: [6, 6], AK: [0, 6], MN: [-4, 6], NY: [4, 0], OK: [8, -2], TX: [6, 0], NC: [6, 0],
};
