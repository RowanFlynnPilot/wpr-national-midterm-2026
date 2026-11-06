import { geoPath } from "d3-geo";
import { feature, mesh } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
import us from "us-atlas/counties-albers-10m.json";
import { STATES } from "./states";

// us-atlas ships Census cartographic boundaries pre-projected to Albers USA in a 975x610 frame,
// so paths need no projection at runtime.
const topo = us as unknown as Topology<{
  counties: GeometryCollection<{ name: string }>;
  states: GeometryCollection<{ name: string }>;
  nation: GeometryCollection;
}>;
const path = geoPath(null);

export const VIEW = { width: 975, height: 610 };

export interface Shape {
  id: string; // FIPS
  name: string;
  d: string;
  centroid: [number, number];
  bounds: [[number, number], [number, number]];
}

function shapes(object: GeometryCollection<{ name: string }>): Shape[] {
  return feature(topo, object).features.map((f) => ({
    id: String(f.id),
    name: f.properties.name,
    d: path(f) ?? "",
    centroid: path.centroid(f),
    bounds: path.bounds(f),
  }));
}

export const COUNTIES: Shape[] = shapes(topo.objects.counties);
export const STATE_SHAPES: (Shape & { code: string })[] = shapes(topo.objects.states)
  .filter((s) => s.id in STATES && s.id !== "11")
  .map((s) => ({ ...s, code: (STATES[s.id] as { code: string }).code }));

export const STATE_BORDERS = path(mesh(topo, topo.objects.states, (a, b) => a !== b)) ?? "";
export const NATION = path(mesh(topo, topo.objects.nation)) ?? "";

export const COUNTIES_BY_STATE: Map<string, Shape[]> = new Map();
for (const c of COUNTIES) {
  const code = STATES[c.id.slice(0, 2)]?.code;
  if (!code) continue;
  const list = COUNTIES_BY_STATE.get(code) ?? [];
  list.push(c);
  COUNTIES_BY_STATE.set(code, list);
}

export function stateShape(code: string) {
  const s = STATE_SHAPES.find((x) => x.code === code);
  if (!s) throw new Error(`no shape for ${code}`);
  return s;
}

// Label nudges where a state's centroid falls awkwardly (bays, panhandles, peninsulas).
export const LABEL_NUDGE: Record<string, [number, number]> = {
  FL: [12, 6], LA: [-8, -2], MI: [8, 14], ID: [0, 12], KY: [4, 2], WV: [-2, 4], VA: [6, 2],
  CA: [-6, 0], HI: [6, 6], AK: [0, 6], MN: [-4, 6], NY: [4, 0], OK: [8, -2], TX: [6, 0], NC: [6, 0],
};
