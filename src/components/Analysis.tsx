import { Fragment, memo } from "react";
import { useInView } from "../lib/inView";
import { PARTY, PARTY_PLURAL } from "../lib/colors";
import type { Geo } from "../lib/geo";
import type { Demographics } from "../lib/patterns";
import { biggestShifts, headToHead, marginLabel, officeShift, raceShift, shiftText, type Baseline } from "../lib/shift";
import { stateName } from "../lib/states";
import { raceFill } from "../lib/status";
import { measureShortTitle, raceTitle } from "../lib/summary";
import type { CountySets, Office, Race } from "../lib/types";
import { CountyPatterns } from "./CountyPatterns";
import { ShiftScatter } from "./ShiftScatter";

interface Props {
  office: Office;
  state: string | null;
  district: string | null;
  races: Race[];
  counties: CountySets | null;
  demographics: Demographics | null;
  baseline: Baseline | null;
  geo: Geo | null;
  onSelect: (race: Race) => void;
}

/**
 * The full-width band under the board: the move since 2024 and the county patterns for the selected office, or for the
 * selected statewide race or measure. It follows the selection; the side panel keeps the quick lists. House races have
 * no band: a district has no 2024 baseline and no county rows of its own.
 */
export const Analysis = memo(function Analysis(props: Props) {
  // The band sits below the board; its dots and tables render once the reader approaches, so the load is not charged for them.
  const [ref, inView] = useInView<HTMLDivElement>();
  return (
    <div ref={ref} className="analysis-slot">
      {inView && <AnalysisBand {...props} />}
    </div>
  );
});

function AnalysisBand({ office, state, district, races, counties, demographics, baseline, geo, onSelect }: Props) {
  if (office === "H") return null;
  const set = counties ? counties[office] : null;
  if (office === "B") {
    const race = district ? races.find((r) => r.office === "B" && r.district === district) : undefined;
    if (!race || !set || !demographics) return null;
    return (
      <section className="analysis" aria-labelledby="analysis-title">
        <h2 id="analysis-title" className="analysis__title">
          {measureShortTitle(race)}, county by county
        </h2>
        <div className="analysis__grid analysis__grid--one">
          <CountyPatterns races={[race]} counties={set} demographics={demographics} baseline={null} scope={measureShortTitle(race)} />
        </div>
      </section>
    );
  }
  const officeRaces = races.filter((r) => r.office === office);
  const race = state ? officeRaces.find((r) => r.state === state) : undefined;
  if (state && !race) return null;
  const scope = race ? [race] : officeRaces;
  const noun = office === "S" ? "Senate" : "governor";
  if (!baseline && !(set && demographics)) return null;
  return (
    <section className="analysis" aria-labelledby="analysis-title">
      <h2 id="analysis-title" className="analysis__title">
        {race ? `${raceTitle(race)} in depth` : `The ${noun} vote in depth`}
      </h2>
      <div className="analysis__grid">
        <div className="analysis__col">
          {baseline && (race ? <RaceShift race={race} baseline={baseline} /> : <ShiftBlock office={office} races={officeRaces} baseline={baseline} onSelect={onSelect} />)}
          {baseline && set && demographics && <ShiftScatter races={scope} counties={set} demographics={demographics} baseline={baseline} geo={geo} />}
        </div>
        <div className="analysis__col">
          {set && demographics && (
            <CountyPatterns races={scope} counties={set} demographics={demographics} baseline={baseline} scope={race ? raceTitle(race) : `Across the ${officeRaces.length} ${noun} races`} />
          )}
        </div>
      </div>
    </section>
  );
}

/** One statewide race against the 2024 presidential vote in its state. */
function RaceShift({ race, baseline }: { race: Race; baseline: Baseline }) {
  const s = raceShift(race, baseline);
  return (
    <>
      <h3 className="panel__title">Compared with 2024</h3>
      <p className="panel__lede">
        {s
          ? shiftText(s)
          : headToHead(race)
            ? `No 2024 figures for ${stateName(race.state)}.`
            : "No comparison with the 2024 presidential vote: an independent finished in the top two."}
      </p>
    </>
  );
}

/** The office's races against the 2024 presidential vote in their states, and the biggest moves each way. */
function ShiftBlock({ office, races, baseline, onSelect }: { office: Office; races: Race[]; baseline: Baseline; onSelect: (r: Race) => void }) {
  const all = officeShift(races, baseline);
  if (!all) return null;
  const s = all.shift.shift;
  return (
    <div className="shift-block">
      <h3 className="panel__title">Compared with 2024</h3>
      <p className="panel__lede">
        Across the {all.races} {office === "S" ? "Senate" : "governor"} races where a Democrat and a Republican finished first and second, the vote ran{" "}
        <strong style={{ color: s > 0 ? PARTY.D : PARTY.R }}>
          {Math.abs(s).toFixed(1)} points more {s > 0 ? "Democratic" : "Republican"}
        </strong>{" "}
        than the 2024 presidential vote in the same states ({marginLabel(all.shift.then)} then, {marginLabel(all.shift.now)} now).
      </p>
      <div className="shift-block__moves">
        {(["D", "R"] as const).map((p) => {
          const list = biggestShifts(races, baseline, p, 3);
          if (!list.length) return null;
          return (
            <Fragment key={p}>
              <h4 className="panel__subtitle">Biggest moves toward {PARTY_PLURAL[p]}</h4>
              <ul className="race-rows">
                {list.map(({ race, shift }) => (
                  <li key={race.id}>
                    <button type="button" className="race-row" onClick={() => onSelect(race)}>
                      <span className="race-row__swatch" style={{ background: raceFill(race) }} />
                      <span className="race-row__where">{`${stateName(race.state)}${race.special ? " (special)" : ""}`}</span>
                      <span className="race-row__who">{race.cands[0]?.name}</span>
                      <span className="race-row__margin">
                        <span style={{ color: PARTY[p] }}>{marginLabel(shift.shift)}</span>
                        <small>2024: {marginLabel(shift.then)}</small>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </Fragment>
          );
        })}
      </div>
      <p className="panel__note">
        Democratic minus Republican share of every vote, each race against the 2024 presidential vote in its state, in points. Races with an
        independent in the top two are left out.
      </p>
    </div>
  );
}
