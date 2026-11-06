import { memo, useMemo, useRef } from "react";
import { inkOn } from "../lib/colors";
import { raceFill } from "../lib/status";
import type { HexCell, Race } from "../lib/types";
import type { HoverTarget } from "./Tooltip";

const R = 10; // hex circumradius in SVG units; must match the layout grid's pointy-top geometry
const SQ3 = Math.sqrt(3);
const center = (q: number, r: number): [number, number] => [R * SQ3 * (q + r / 2), R * 1.5 * r];
const corner = (cx: number, cy: number, i: number): [number, number] => {
  const a = (Math.PI / 180) * (60 * i - 30);
  return [cx + R * Math.cos(a), cy + R * Math.sin(a)];
};
// neighbor across the edge from corner i to corner i+1
const EDGE_NEIGHBOR: [number, number][] = [[1, 0], [0, 1], [-1, 1], [-1, 0], [0, -1], [1, -1]];

interface Props {
  hexes: HexCell[];
  racesByDistrict: Map<string, Race>;
  selectedState: string | null;
  selectedDistrict: string | null;
  onHover: (target: HoverTarget | null, event?: React.PointerEvent) => void;
  onSelect: (state: string, district: string | null) => void;
}

export const HexMap = memo(function HexMap({ hexes, racesByDistrict, selectedState, selectedDistrict, onHover, onSelect }: Props) {
  // Hexes are too small to hit reliably with a finger: a tap picks the state, then the panel lists its districts.
  const pointerType = useRef("mouse");
  const geom = useMemo(() => {
    const owner = new Map(hexes.map((h) => [`${h.q},${h.r}`, h.st]));
    const cells = hexes.map((h) => {
      const [cx, cy] = center(h.q, h.r);
      const points = [0, 1, 2, 3, 4, 5].map((i) => corner(cx, cy, i).map((v) => v.toFixed(2)).join(",")).join(" ");
      return { ...h, cx, cy, points };
    });
    let borders = "";
    const stateEdges = new Map<string, string>();
    for (const c of cells) {
      EDGE_NEIGHBOR.forEach(([dq, dr], i) => {
        if (owner.get(`${c.q + dq},${c.r + dr}`) === c.st) return;
        const [a, b] = [corner(c.cx, c.cy, i), corner(c.cx, c.cy, (i + 1) % 6)];
        const seg = `M${a[0].toFixed(2)},${a[1].toFixed(2)}L${b[0].toFixed(2)},${b[1].toFixed(2)}`;
        borders += seg;
        stateEdges.set(c.st, (stateEdges.get(c.st) ?? "") + seg);
      });
    }
    const labels = [...new Set(hexes.map((h) => h.st))].map((st) => {
      const own = cells.filter((c) => c.st === st);
      const x = own.reduce((s, c) => s + c.cx, 0) / own.length;
      const y = own.reduce((s, c) => s + c.cy, 0) / own.length;
      // snap to the member hex nearest the blob's center so the label sits on the state
      const anchor = own.reduce((best, c) => ((c.cx - x) ** 2 + (c.cy - y) ** 2 < (best.cx - x) ** 2 + (best.cy - y) ** 2 ? c : best));
      return { st, x: anchor.cx, y: anchor.cy, d: anchor.d };
    });
    const xs = cells.map((c) => c.cx), ys = cells.map((c) => c.cy);
    const pad = R * 1.6;
    const box = [Math.min(...xs) - pad, Math.min(...ys) - pad, Math.max(...xs) - Math.min(...xs) + 2 * pad, Math.max(...ys) - Math.min(...ys) + 2 * pad];
    return { cells, borders, stateEdges, labels, box };
  }, [hexes]);

  return (
    <svg
      className="hex-map"
      viewBox={geom.box.map((v) => v.toFixed(1)).join(" ")}
      role="group"
      aria-label="House results, one hexagon per district"
      onPointerDown={(e) => (pointerType.current = e.pointerType)}
    >
      <g className="hexes">
        {geom.cells.map((c) => {
          const race = racesByDistrict.get(c.d);
          if (!race) throw new Error(`no race for ${c.d}`);
          const dim = selectedState !== null && selectedState !== c.st;
          return (
            <polygon
              key={c.d}
              points={c.points}
              fill={raceFill(race)}
              className={`hex${dim ? " is-dim" : ""}${selectedDistrict === c.d ? " is-selected" : ""}`}
              onPointerMove={(e) => onHover({ kind: "district", district: c.d }, e)}
              onPointerLeave={() => onHover(null)}
              onClick={() => onSelect(c.st, pointerType.current === "touch" ? null : c.d)}
            />
          );
        })}
      </g>
      <path className="hex-borders" d={geom.borders} />
      {selectedState && <path className="hex-state-outline" d={geom.stateEdges.get(selectedState) ?? ""} />}
      <g className="hex-labels" aria-hidden="true">
        {geom.labels.map((l) => {
          const race = racesByDistrict.get(l.d);
          return (
            <text key={l.st} x={l.x} y={l.y} fill={race ? inkOn(raceFill(race)) : "#1D1B17"}>
              {l.st}
            </text>
          );
        })}
      </g>
      {selectedDistrict && (() => {
        const c = geom.cells.find((x) => x.d === selectedDistrict);
        return c ? (
          <g className="hex-selected">
            <polygon points={c.points} className="hex-selected__outer" />
            <polygon points={c.points} className="hex-selected__inner" />
          </g>
        ) : null;
      })()}
    </svg>
  );
});
