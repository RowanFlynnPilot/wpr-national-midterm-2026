import { memo, useMemo, useState } from "react";
import { NO_RACE, NO_RESULTS, inkOn, marginColor, measureCountColor, remainingColor } from "../lib/colors";
import { countyColumns, readCounty } from "../lib/data";
import { LABEL_NUDGE, VIEW, type Geo, type StateShape } from "../lib/geo";

import { HOME_STATE, SMALL_STATES, STATES } from "../lib/states";
import { raceFill, statusText } from "../lib/status";
import { raceTitle } from "../lib/summary";
import type { CountyResults, Race } from "../lib/types";
import { focusPoint, type HoverHandler } from "./Tooltip";

/** states: one fill per race; counties: county margins; remaining: how much of each county's vote is still out;
 *  measures: how many statewide ballot measures each state has. */
export type MapMode = "states" | "counties" | "remaining" | "measures";

interface Props {
  geo: Geo;
  mode: MapMode;
  description: string; // the map's accessible name, with the tallies
  racesByState: Map<string, Race>;
  measureCounts: Map<string, number>; // measures mode: statewide measures per state
  counties: CountyResults;
  selected: string | null;
  onHover: HoverHandler;
  onSelect: (state: string) => void;
  onClear: () => void;
}

function stateFill(race: Race | undefined): string {
  return race ? raceFill(race) : NO_RACE;
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

export const NationalMap = memo(function NationalMap({ geo, mode, description, racesByState, measureCounts, counties, selected, onHover, onSelect, onClear }: Props) {
  const [focused, setFocused] = useState<string | null>(null);
  const measures = mode === "measures";
  const has = (code: string) => (measures ? measureCounts.has(code) : racesByState.has(code));
  const fill = (code: string) => (measures ? (measureCounts.has(code) ? measureCountColor(measureCounts.get(code) as number) : NO_RACE) : stateFill(racesByState.get(code)));
  /** Accessible name for a state with something on the ballot; the rest are decorative (the tooltip still names them on hover). */
  const label = (code: string, name: string) => {
    if (measures) {
      const n = measureCounts.get(code);
      return n ? `${name}: ${n} statewide ballot measure${n === 1 ? "" : "s"}` : undefined;
    }
    const race = racesByState.get(code);
    return race ? `${raceTitle(race)}: ${statusText(race)}` : undefined;
  };

  const countyFills = useMemo(() => {
    if (mode === "states" || mode === "measures") return null;
    const fills = new Map<string, string>();
    for (const race of racesByState.values()) {
      const rows = counties[String(race.id)];
      if (!rows) throw new Error(`no county results for race ${race.id}`);
      const cols = countyColumns(race);
      for (const [fips, row] of Object.entries(rows)) {
        const reading = readCounty(row);
        if (mode === "remaining") {
          fills.set(fips, remainingColor(reading?.pctIn ?? 0));
          continue;
        }
        const col = reading ? cols[reading.leaderIndex] : undefined;
        fills.set(fips, reading && col ? marginColor(col.party, reading.margin) : NO_RESULTS);
      }
    }
    return fills;
  }, [mode, racesByState, counties]);

  const selectedShape = selected ? geo.states.find((s) => s.code === selected) : undefined;
  const homeShape = selected === HOME_STATE ? undefined : geo.states.find((s) => s.code === HOME_STATE);
  const focusedShape = focused ? geo.states.find((s) => s.code === focused) : undefined;
  const zoomed = countyFills && selectedShape ? selectedShape : undefined;

  const focusHandlers = (code: string) => ({
    onFocus: (e: React.FocusEvent<SVGElement>) => {
      if (!e.currentTarget.matches(":focus-visible")) return;
      setFocused(code);
      onHover(has(code) ? { kind: "state", state: code } : null, focusPoint(e.currentTarget));
    },
    onBlur: () => {
      setFocused(null);
      onHover(null);
    },
    onKeyDown: (e: React.KeyboardEvent) => {
      if (has(code) && (e.key === "Enter" || e.key === " ")) {
        e.preventDefault();
        onSelect(code);
      }
    },
  });
  const flat = mode === "states" || measures; // one fill per state, labels on

  return (
    <>
      <svg
        className="national-map"
        viewBox={`0 0 ${VIEW.width} ${VIEW.height}`}
        role="group"
        aria-label={description}
      >
        <g className="map-zoom" style={{ transform: zoomed ? zoomTransform(zoomed) : "none" }}>
          {countyFills && (
            <g className="counties" aria-hidden="true">
              {geo.counties.map((c) => {
                const fill = countyFills.get(c.id);
                const code = STATES[c.id.slice(0, 2)]?.code;
                return (
                  <path
                    key={c.id}
                    d={c.d}
                    fill={fill ?? NO_RACE}
                    className={zoomed && code !== zoomed.code ? "is-out" : undefined}
                    vectorEffect="non-scaling-stroke"
                    onPointerMove={(e) => (fill && code ? onHover({ kind: "county", state: code, fips: c.id, name: c.name }, e) : onHover(null))}
                    onPointerLeave={() => onHover(null)}
                    onClick={() => code && racesByState.has(code) && onSelect(code)}
                  />
                );
              })}
            </g>
          )}

          <g className={`states states--${flat ? "states" : "counties"}`}>
            {geo.states.map((s) => {
              const on = has(s.code);
              return (
                <path
                  key={s.id}
                  d={s.d}
                  className={on ? "state has-race" : "state"}
                  fill={flat ? fill(s.code) : "transparent"}
                  tabIndex={on ? 0 : -1}
                  role={on ? "button" : undefined}
                  aria-label={label(s.code, s.name)}
                  aria-pressed={on ? selected === s.code : undefined}
                  onPointerMove={(e) => (flat ? onHover({ kind: "state", state: s.code }, e) : undefined)}
                  onPointerLeave={() => flat && onHover(null)}
                  onClick={() => on && onSelect(s.code)}
                  {...focusHandlers(s.code)}
                />
              );
            })}
          </g>

          <path className="state-borders" d={geo.stateBorders} vectorEffect="non-scaling-stroke" />
          <path className="nation" d={geo.nation} vectorEffect="non-scaling-stroke" />
          {homeShape && <path className="home-outline" d={homeShape.d} vectorEffect="non-scaling-stroke" />}
          {selectedShape && <path className="selected-outline" d={selectedShape.d} vectorEffect="non-scaling-stroke" />}
          {focusedShape && <path className="focus-outline" d={focusedShape.d} vectorEffect="non-scaling-stroke" />}
        </g>

        {flat && (
          <g className="state-labels" aria-hidden="true">
            {geo.states.filter((s) => !SMALL_STATES.includes(s.code)).map((s) => {
              const race = racesByState.get(s.code);
              const [dx, dy] = LABEL_NUDGE[s.code] ?? [0, 0];
              const [x, y] = [s.centroid[0] + dx, s.centroid[1] + dy];
              return (
                <g key={s.id}>
                  <text x={x} y={y} fill={inkOn(fill(s.code))} className={s.code === "VT" || s.code === "NH" ? "small" : undefined}>
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
              const on = has(code);
              const chipFill = fill(code);
              const y = CHIP_Y0 + i * CHIP_STEP;
              return (
                <g
                  key={code}
                  className={on ? "chip has-race" : "chip"}
                  tabIndex={on ? 0 : -1}
                  role={on ? "button" : undefined}
                  aria-label={label(code, s.name)}
                  aria-pressed={on ? selected === code : undefined}
                  onPointerMove={(e) => onHover(on ? { kind: "state", state: code } : null, e)}
                  onPointerLeave={() => onHover(null)}
                  onClick={() => on && onSelect(code)}
                  {...focusHandlers(code)}
                >
                  <line x1={s.centroid[0]} y1={s.centroid[1]} x2={CHIP_X} y2={y} />
                  <rect x={CHIP_X} y={y - 8} width={28} height={16} rx={3} fill={chipFill} />
                  <text x={CHIP_X + 14} y={y + 0.5} fill={inkOn(chipFill)}>
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
