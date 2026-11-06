import { memo, useMemo } from "react";
import { NO_RACE, NO_RESULTS, inkOn, marginColor } from "../lib/colors";
import { countyColumns, readCounty } from "../lib/data";
import { LABEL_NUDGE, VIEW, type Geo } from "../lib/geo";
import { SMALL_STATES, STATES } from "../lib/states";
import { raceFill } from "../lib/status";
import type { CountyResults, Race } from "../lib/types";
import type { HoverTarget } from "./Tooltip";

export type MapMode = "states" | "counties";

interface Props {
  geo: Geo;
  mode: MapMode;
  racesByState: Map<string, Race>;
  counties: CountyResults;
  selected: string | null;
  onHover: (target: HoverTarget | null, event?: React.PointerEvent) => void;
  onSelect: (state: string) => void;
}

function stateFill(race: Race | undefined): string {
  return race ? raceFill(race) : NO_RACE;
}

const CHIP_X = 930;
const CHIP_Y0 = 198;
const CHIP_STEP = 22;

export const NationalMap = memo(function NationalMap({ geo, mode, racesByState, counties, selected, onHover, onSelect }: Props) {
  const countyFills = useMemo(() => {
    if (mode !== "counties") return null;
    const fills = new Map<string, string>();
    for (const race of racesByState.values()) {
      const rows = counties[String(race.id)];
      if (!rows) throw new Error(`no county results for race ${race.id}`);
      const cols = countyColumns(race);
      for (const [fips, row] of Object.entries(rows)) {
        const reading = readCounty(row);
        const col = reading ? cols[reading.leaderIndex] : undefined;
        fills.set(fips, reading && col ? marginColor(col.party, reading.margin) : NO_RESULTS);
      }
    }
    return fills;
  }, [mode, racesByState, counties]);

  const selectedShape = selected ? geo.states.find((s) => s.code === selected) : undefined;

  return (
    <svg className="national-map" viewBox={`0 0 ${VIEW.width} ${VIEW.height}`} role="group" aria-label="Map of results by state">
      {mode === "counties" && countyFills && (
        <g className="counties" aria-hidden="true">
          {geo.counties.map((c) => {
            const fill = countyFills.get(c.id);
            const code = STATES[c.id.slice(0, 2)]?.code;
            return (
              <path
                key={c.id}
                d={c.d}
                fill={fill ?? NO_RACE}
                onPointerMove={(e) => (fill && code ? onHover({ kind: "county", state: code, fips: c.id, name: c.name }, e) : onHover(null))}
                onPointerLeave={() => onHover(null)}
                onClick={() => code && racesByState.has(code) && onSelect(code)}
              />
            );
          })}
        </g>
      )}

      <g className={`states states--${mode}`}>
        {geo.states.map((s) => {
          const race = racesByState.get(s.code);
          const label = race ? `${s.name}: ${race.winner ? "won by" : "led by"} ${race.cands[0]?.name}` : `${s.name}: no race this year`;
          return (
            <path
              key={s.id}
              d={s.d}
              className={race ? "state has-race" : "state"}
              fill={mode === "states" ? stateFill(race) : "transparent"}
              tabIndex={race ? 0 : -1}
              role={race ? "button" : undefined}
              aria-label={label}
              onPointerMove={(e) => (mode === "states" ? onHover({ kind: "state", state: s.code }, e) : undefined)}
              onPointerLeave={() => mode === "states" && onHover(null)}
              onClick={() => race && onSelect(s.code)}
              onKeyDown={(e) => race && (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onSelect(s.code))}
            />
          );
        })}
      </g>

      <path className="state-borders" d={geo.stateBorders} />
      <path className="nation" d={geo.nation} />

      {mode === "states" && (
        <g className="state-labels" aria-hidden="true">
          {geo.states.filter((s) => !SMALL_STATES.includes(s.code)).map((s) => {
            const race = racesByState.get(s.code);
            const [dx, dy] = LABEL_NUDGE[s.code] ?? [0, 0];
            const [x, y] = [s.centroid[0] + dx, s.centroid[1] + dy];
            return (
              <g key={s.id}>
                <text x={x} y={y} fill={inkOn(stateFill(race))} className={s.code === "VT" || s.code === "NH" ? "small" : undefined}>
                  {s.code}
                </text>
                {race?.flip && <circle className="flip-dot" cx={x} cy={y + 8} r={3} />}
              </g>
            );
          })}
        </g>
      )}

      <g className="chips">
        {SMALL_STATES.map((code, i) => {
          const s = geo.states.find((x) => x.code === code);
          if (!s) return null;
          const race = racesByState.get(code);
          const fill = stateFill(race);
          const y = CHIP_Y0 + i * CHIP_STEP;
          return (
            <g
              key={code}
              className={race ? "chip has-race" : "chip"}
              tabIndex={race ? 0 : -1}
              role={race ? "button" : undefined}
              aria-label={race ? `${s.name}: ${race.winner ? "won by" : "led by"} ${race.cands[0]?.name}` : `${s.name}: no race this year`}
              onPointerMove={(e) => onHover(race ? { kind: "state", state: code } : null, e)}
              onPointerLeave={() => onHover(null)}
              onClick={() => race && onSelect(code)}
              onKeyDown={(e) => race && (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onSelect(code))}
            >
              <line x1={s.centroid[0]} y1={s.centroid[1]} x2={CHIP_X} y2={y} />
              <rect x={CHIP_X} y={y - 8} width={28} height={16} rx={3} fill={fill} />
              <text x={CHIP_X + 14} y={y + 0.5} fill={inkOn(fill)}>
                {code}
              </text>
              {race?.flip && mode === "states" && <circle className="flip-dot" cx={CHIP_X + 34} cy={y} r={3} />}
            </g>
          );
        })}
      </g>

      {selectedShape && <path className="selected-outline" d={selectedShape.d} />}
    </svg>
  );
});

