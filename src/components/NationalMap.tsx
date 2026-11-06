import { memo, useMemo, useState } from "react";
import { NO_RACE, NO_RESULTS, inkOn, marginColor } from "../lib/colors";
import { countyColumns, readCounty } from "../lib/data";
import { LABEL_NUDGE, VIEW, type Geo, type StateShape } from "../lib/geo";

import { SMALL_STATES, STATES } from "../lib/states";
import { raceFill, statusText } from "../lib/status";
import { raceTitle } from "../lib/summary";
import type { CountyResults, Race } from "../lib/types";
import { focusPoint, type HoverHandler } from "./Tooltip";

export type MapMode = "states" | "counties";

interface Props {
  geo: Geo;
  mode: MapMode;
  racesByState: Map<string, Race>;
  counties: CountyResults;
  selected: string | null;
  onHover: HoverHandler;
  onSelect: (state: string) => void;
  onClear: () => void;
}

function stateFill(race: Race | undefined): string {
  return race ? raceFill(race) : NO_RACE;
}

/** Accessible name for a state with a race; states without one are decorative (the tooltip still names them on hover). */
function stateLabel(race: Race | undefined): string | undefined {
  return race ? `${raceTitle(race)}: ${statusText(race)}` : undefined;
}

const CHIP_X = 930;
const CHIP_Y0 = 198;
const CHIP_STEP = 22;
const MAX_ZOOM = 7;

/** CSS transform that fits a state's bounds in the frame, for the counties view. */
function zoomTransform(s: StateShape): string {
  const [[x0, y0], [x1, y1]] = s.bounds;
  const k = Math.min(MAX_ZOOM, (VIEW.width / (x1 - x0)) * 0.84, (VIEW.height / (y1 - y0)) * 0.84);
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  return `translate(${VIEW.width / 2}px, ${VIEW.height / 2}px) scale(${k}) translate(${-cx}px, ${-cy}px)`;
}

export const NationalMap = memo(function NationalMap({ geo, mode, racesByState, counties, selected, onHover, onSelect, onClear }: Props) {
  const [focused, setFocused] = useState<string | null>(null);

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
  const focusedShape = focused ? geo.states.find((s) => s.code === focused) : undefined;
  const zoomed = mode === "counties" && selectedShape ? selectedShape : undefined;

  const focusHandlers = (code: string, race: Race | undefined) => ({
    onFocus: (e: React.FocusEvent<SVGElement>) => {
      if (!e.currentTarget.matches(":focus-visible")) return;
      setFocused(code);
      onHover(race ? { kind: "state", state: code } : null, focusPoint(e.currentTarget));
    },
    onBlur: () => {
      setFocused(null);
      onHover(null);
    },
    onKeyDown: (e: React.KeyboardEvent) => {
      if (race && (e.key === "Enter" || e.key === " ")) {
        e.preventDefault();
        onSelect(code);
      }
    },
  });

  return (
    <>
      <svg
        className="national-map"
        viewBox={`0 0 ${VIEW.width} ${VIEW.height}`}
        role="group"
        aria-label={mode === "counties" ? "Map of county results" : "Map of results by state"}
      >
        <g className="map-zoom" style={{ transform: zoomed ? zoomTransform(zoomed) : "none" }}>
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
                    vectorEffect="non-scaling-stroke"
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
              return (
                <path
                  key={s.id}
                  d={s.d}
                  className={race ? "state has-race" : "state"}
                  fill={mode === "states" ? stateFill(race) : "transparent"}
                  tabIndex={race ? 0 : -1}
                  role={race ? "button" : undefined}
                  aria-label={stateLabel(race)}
                  aria-pressed={race ? selected === s.code : undefined}
                  onPointerMove={(e) => (mode === "states" ? onHover({ kind: "state", state: s.code }, e) : undefined)}
                  onPointerLeave={() => mode === "states" && onHover(null)}
                  onClick={() => race && onSelect(s.code)}
                  {...focusHandlers(s.code, race)}
                />
              );
            })}
          </g>

          <path className="state-borders" d={geo.stateBorders} vectorEffect="non-scaling-stroke" />
          <path className="nation" d={geo.nation} vectorEffect="non-scaling-stroke" />
          {selectedShape && <path className="selected-outline" d={selectedShape.d} vectorEffect="non-scaling-stroke" />}
          {focusedShape && <path className="focus-outline" d={focusedShape.d} vectorEffect="non-scaling-stroke" />}
        </g>

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

        {!zoomed && (
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
                  aria-label={stateLabel(race)}
                  aria-pressed={race ? selected === code : undefined}
                  onPointerMove={(e) => onHover(race ? { kind: "state", state: code } : null, e)}
                  onPointerLeave={() => onHover(null)}
                  onClick={() => race && onSelect(code)}
                  {...focusHandlers(code, race)}
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
        )}
      </svg>
      {zoomed && (
        <button type="button" className="map-back" onClick={onClear}>
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M10 3L5 8l5 5" />
          </svg>
          All states
        </button>
      )}
    </>
  );
});
