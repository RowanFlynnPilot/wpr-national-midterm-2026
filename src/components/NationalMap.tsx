import { memo, useMemo, useState } from "react";
import { NO_RACE, NO_RESULTS, inkOn, marginColor, measureCountColor, remainingColor, shiftColor } from "../lib/colors";
import { countyShift, type Baseline } from "../lib/shift";
import { countyColumns, readCounty } from "../lib/data";
import { LABEL_NUDGE, VIEW, type Geo, type Shape, type StateShape } from "../lib/geo";

import { HOME_STATE, SMALL_STATES, STATES } from "../lib/states";
import { inSpotlight, isFresh, raceFill, statusText, type LegendKey } from "../lib/status";
import { raceTitle } from "../lib/summary";
import type { CountyResults, Race } from "../lib/types";
import { focusPoint, type HoverHandler } from "./Tooltip";

/** states: one fill per race; counties: county margins; remaining: how much of each county's vote is still out;
 *  measures: how many statewide ballot measures each state has. */
export type MapMode = "states" | "counties" | "remaining" | "shift" | "measures";

interface Props {
  geo: Geo;
  mode: MapMode;
  baseline: Baseline | null; // the 2024 presidential vote, for the shift mode; null until it loads
  description: string; // the map's accessible name, with the tallies
  racesByState: Map<string, Race>;
  measureCounts: Map<string, number>; // measures mode: statewide measures per state
  spotlight: LegendKey | null; // a pressed key entry: every other state dims
  now: number;
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
const LABEL_GAP = 40; // minimum distance between county labels, in screen pixels

/** Scale that fits a state's bounds in the frame, for the counties view. */
function zoomScale(s: StateShape): number {
  const [[x0, y0], [x1, y1]] = s.bounds;
  return Math.min(MAX_ZOOM, (VIEW.width / (x1 - x0)) * 0.84, (VIEW.height / (y1 - y0)) * 0.84);
}

function zoomTransform(s: StateShape): string {
  const [[x0, y0], [x1, y1]] = s.bounds;
  const k = zoomScale(s);
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  return `translate(${VIEW.width / 2}px, ${VIEW.height / 2}px) scale(${k}) translate(${-cx}px, ${-cy}px)`;
}

export const NationalMap = memo(function NationalMap({ geo, mode, baseline, description, racesByState, measureCounts, spotlight, now, counties, selected, onHover, onSelect, onClear }: Props) {
  const [focused, setFocused] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
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
        if (mode === "shift") {
          const s = baseline ? countyShift(race, row, fips, baseline) : null;
          fills.set(fips, s ? shiftColor(s.shift) : NO_RESULTS);
          continue;
        }
        if (mode === "remaining") {
          fills.set(fips, remainingColor(reading?.pctIn ?? 0));
          continue;
        }
        const col = reading ? cols[reading.leaderIndex] : undefined;
        fills.set(fips, reading && col ? marginColor(col.party, reading.margin) : NO_RESULTS);
      }
    }
    return fills;
  }, [mode, racesByState, counties, baseline]);

  const selectedShape = selected ? geo.states.find((s) => s.code === selected) : undefined;
  const homeShape = selected === HOME_STATE ? undefined : geo.states.find((s) => s.code === HOME_STATE);
  const focusedShape = focused ? geo.states.find((s) => s.code === focused) : undefined;
  const zoomed = countyFills && selectedShape ? selectedShape : undefined;
  const hoveredShape = hovered && hovered !== selected ? geo.states.find((s) => s.code === hovered) : undefined;
  // In a zoomed state, name the five biggest counties by votes so the reader has bearings; neighbors that would overlap are skipped.
  const countyLabels = useMemo(() => {
    if (!zoomed) return [];
    const race = racesByState.get(zoomed.code);
    const rows = race ? counties[String(race.id)] : undefined;
    if (!rows) return [];
    const apart = LABEL_GAP / zoomScale(zoomed); // screen pixels, in map units
    const picked: Shape[] = [];
    for (const { c } of (geo.countiesByState.get(zoomed.code) ?? [])
      .map((c) => ({ c, total: (rows[c.id] ?? []).slice(1).reduce((s, v) => s + v, 0) }))
      .filter((x) => x.total > 0)
      .sort((a, b) => b.total - a.total)) {
      if (picked.every((p) => Math.hypot(p.centroid[0] - c.centroid[0], p.centroid[1] - c.centroid[1]) > apart)) picked.push(c);
      if (picked.length === 5) break;
    }
    return picked;
  }, [zoomed, racesByState, counties, geo]);

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
              const race = racesByState.get(s.code);
              const out = spotlight !== null && !measures && (!race || !inSpotlight(race, spotlight, now));
              return (
                <path
                  key={s.id}
                  d={s.d}
                  className={`${on ? "state has-race" : "state"}${out ? " is-out" : ""}`}
                  fill={flat ? fill(s.code) : "transparent"}
                  tabIndex={on ? 0 : -1}
                  role={on ? "button" : undefined}
                  aria-label={label(s.code, s.name)}
                  aria-pressed={on ? selected === s.code : undefined}
                  onPointerMove={(e) => {
                    if (!flat) return;
                    if (e.pointerType !== "touch") setHovered(on ? s.code : null); // a finger never sends pointerleave
                    onHover({ kind: "state", state: s.code }, e);
                  }}
                  onPointerLeave={() => {
                    if (!flat) return;
                    setHovered(null);
                    onHover(null);
                  }}
                  onClick={() => on && onSelect(s.code)}
                  {...focusHandlers(s.code)}
                />
              );
            })}
          </g>

          <path className="state-borders" d={geo.stateBorders} vectorEffect="non-scaling-stroke" />
          <path className="nation" d={geo.nation} vectorEffect="non-scaling-stroke" />
          {flat && !measures && (
            <g className="fresh-outlines" aria-hidden="true">
              {geo.states.map((s) => {
                const race = racesByState.get(s.code);
                return race && isFresh(race, now) ? <path key={s.id} d={s.d} vectorEffect="non-scaling-stroke" /> : null;
              })}
            </g>
          )}
          {zoomed && countyLabels.length > 0 && (
            <g className="county-labels" aria-hidden="true">
              {countyLabels.map((c) => (
                <text key={c.id} x={c.centroid[0]} y={c.centroid[1]} style={{ fontSize: `${9 / zoomScale(zoomed)}px` }}>
                  {c.name}
                </text>
              ))}
            </g>
          )}
          {homeShape && <path className="home-outline" d={homeShape.d} vectorEffect="non-scaling-stroke" />}
          {flat && hoveredShape && <path className="hover-outline" d={hoveredShape.d} vectorEffect="non-scaling-stroke" />}
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
