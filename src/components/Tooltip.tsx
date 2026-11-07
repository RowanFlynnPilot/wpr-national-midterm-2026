import { PARTY, PARTY_LABEL } from "../lib/colors";
import { countyColumns, readCounty } from "../lib/data";
import { pct, timeAgo, votes } from "../lib/format";
import { countyShift, raceShift, shiftText, type Baseline } from "../lib/shift";
import { stateName } from "../lib/states";
import { statusText } from "../lib/status";
import { raceTitle } from "../lib/summary";
import type { CountyResults, Office, Party, Race } from "../lib/types";

export type HoverTarget =
  | { kind: "state"; state: string }
  | { kind: "county"; state: string; fips: string; name: string }
  | { kind: "district"; district: string };

/** The tooltip also serves the chamber cards, where a seat may have no race: one not on this year's ballot. */
export type TipTarget = HoverTarget | { kind: "seat"; party: Party; office: Office };

/** Where a hover or keyboard focus landed, in viewport coordinates. Pointer events satisfy this directly. */
export interface HoverPoint {
  clientX: number;
  clientY: number;
  pointerType: string; // "mouse" | "touch" | "pen" | "keyboard"
}

export type HoverHandler = (target: HoverTarget | null, at?: HoverPoint) => void;

/** The center of a focused element, for a tooltip that follows keyboard focus. */
export function focusPoint(el: Element): HoverPoint {
  const r = el.getBoundingClientRect();
  return { clientX: r.left + r.width / 2, clientY: r.top + r.height / 2, pointerType: "keyboard" };
}

/** A state's ballot measures, for the measures map. */
export interface MeasureSummary {
  total: number;
  passed: number;
  failed: number;
}

interface Props {
  target: TipTarget;
  race: Race | undefined;
  measures?: MeasureSummary; // set on the measures tab instead of a race
  counties: CountyResults | null;
  baseline: Baseline | null; // the 2024 presidential vote; null until it loads
  now: number;
  x: number;
  y: number;
  bounds: { width: number; height: number };
}

const W = 272;

export function Tooltip({ target, race, measures, counties, baseline, now, x, y, bounds }: Props) {
  const left = x + 16 + W > bounds.width ? Math.max(4, x - 16 - W) : x + 16;
  const top = Math.min(Math.max(4, y - 24), Math.max(4, bounds.height - 210));
  return (
    <div className="tooltip" style={{ left, top, width: W }} role="presentation">
      {race ? <TipBody target={target} race={race} counties={counties} baseline={baseline} now={now} /> : <NoRace target={target} measures={measures} />}
    </div>
  );
}

function NoRace({ target, measures }: { target: TipTarget; measures?: MeasureSummary }) {
  if (target.kind === "seat") {
    return (
      <>
        <div className="tooltip__title">Not on the ballot this year</div>
        <div className="tooltip__status">
          {PARTY_LABEL[target.party]} {target.office === "G" ? "governor" : "senator"}; the seat counts for the party
        </div>
      </>
    );
  }
  const title = target.kind === "district" ? target.district : stateName(target.state);
  if (measures) {
    const open = measures.total - measures.passed - measures.failed;
    return (
      <>
        <div className="tooltip__title">{title}</div>
        <div className="tooltip__status">
          {measures.total} statewide measure{measures.total === 1 ? "" : "s"}: {measures.passed} passed, {measures.failed} failed
          {open ? `, ${open} not called` : ""}
        </div>
      </>
    );
  }
  return (
    <>
      <div className="tooltip__title">{title}</div>
      <div className="tooltip__status">{target.kind === "state" ? "No statewide measures" : "No race this year"}</div>
    </>
  );
}

function TipBody({ target, race, counties, baseline, now }: { target: TipTarget; race: Race; counties: CountyResults | null; baseline: Baseline | null; now: number }) {
  if (target.kind === "county") {
    const row = counties?.[String(race.id)]?.[target.fips];
    const reading = row ? readCounty(row) : null;
    const cols = countyColumns(race);
    const shift = row && baseline ? countyShift(race, row, target.fips, baseline) : null;
    return (
      <>
        <div className="tooltip__title">
          {target.name}, {target.state}
        </div>
        <div className="tooltip__status">
          {reading ? `${Math.round(reading.pctIn)}% reporting` : "No votes reported yet"}
        </div>
        {reading && (
          <ul className="tooltip__rows">
            {cols
              .map((c, i) => ({ c, share: reading.shares[i] ?? 0 }))
              .sort((a, b) => b.share - a.share)
              .map(({ c, share }) => (
                <li key={c.name}>
                  <span className="key" style={{ background: PARTY[c.party] }} />
                  <span className="name">{c.name}</span>
                  <span className="value">{pct(share)}</span>
                  <span className="bar" aria-hidden="true">
                    <span style={{ width: `${share}%`, background: PARTY[c.party] }} />
                  </span>
                </li>
              ))}
          </ul>
        )}
        {shift && <div className="tooltip__shift">{shiftText(shift)}</div>}
      </>
    );
  }
  const shift = baseline ? raceShift(race, baseline) : null;
  const lead = race.cands[0];
  const photo = lead?.photo && lead.party !== "O" ? `./headshots/${lead.photo}` : null;
  const timing = race.winner && race.calledAt ? `Called ${timeAgo(race.calledAt, now)}` : !race.winner && !race.runoff ? `${Math.round(race.pctIn)}% reporting` : null;
  return (
    <>
      <div className={photo ? "tooltip__head tooltip__head--photo" : "tooltip__head"}>
        {photo && <img className="tooltip__photo" src={photo} alt="" width={36} height={36} decoding="async" />}
        <div>
          <div className="tooltip__title">{raceTitle(race)}</div>
          <div className="tooltip__status">
            {statusText(race)}
            {timing && ` · ${timing}`}
          </div>
        </div>
      </div>
      <ul className="tooltip__rows">
        {race.cands
          .filter((c) => c.party !== "O")
          .slice(0, 3)
          .map((c) => (
            <li key={c.name} className={c.winner ? "is-winner" : undefined}>
              <span className="key" style={{ background: PARTY[c.party] }} />
              <span className="name">{c.name}</span>
              <span className="value">{pct(c.pct)}</span>
              <span className="bar" aria-hidden="true">
                <span style={{ width: `${c.pct}%`, background: PARTY[c.party] }} />
              </span>
              <span className="votes">{votes(c.votes)}</span>
            </li>
          ))}
      </ul>
      {shift && <div className="tooltip__shift">{shiftText(shift)}</div>}
    </>
  );
}
