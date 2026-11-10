import { Fragment } from "react";
import { PARTY } from "../lib/colors";
import { countyColumns, readCounty } from "../lib/data";
import { apNumber, pct, reportingText, votes } from "../lib/format";
import type { Geo } from "../lib/geo";
import type { Demographics } from "../lib/patterns";
import { raceDistrict } from "../lib/route";
import { county2024, countyFlip, countyShift, countyTurnoutVs2024, marginLabel, shiftText, type Baseline } from "../lib/shift";
import { stateName } from "../lib/states";
import { measureShortTitle, OFFICE_NAME, OFFICE_SINGULAR } from "../lib/summary";
import type { CountySets, Office, Race } from "../lib/types";
import { Back } from "./Back";

interface Props {
  office: "S" | "G" | "H"; // the view the county sits on
  state: string;
  fips: string;
  races: Race[];
  counties: CountySets | null; // null until the county files load
  geo: Geo | null; // the county's name; null until the atlas loads
  demographics: Demographics | null;
  baseline: Baseline | null; // the 2024 presidential vote
  onSelect: (office: Office, state: string | null, district: string | null) => void;
}

const ORDER: Record<Office, number> = { S: 0, G: 1, H: 2, B: 3 };

/**
 * One county's page: who lives there, how it voted for president in 2024, and its vote in every statewide race, House race
 * and measure this year. A House district is listed when it has a row for the county, so those blocks appear once the
 * county files load; a county in more than one district shows each district's part.
 */
export function CountyView({ office, state, fips, races, counties, geo, demographics, baseline, onSelect }: Props) {
  const shape = geo?.counties.find((c) => c.id === fips);
  if (geo && !shape) throw new Error(`unknown county ${fips}`);
  const list = races
    .filter((r) => r.state === state && (r.office !== "H" || counties?.H[String(r.id)]?.[fips]))
    .sort((a, b) => ORDER[a.office] - ORDER[b.office] || Number(a.special) - Number(b.special) || (a.num ?? 0) - (b.num ?? 0));
  const house = list.filter((r) => r.office === "H");
  const d = demographics?.counties[fips];
  const then = baseline ? county2024(fips, baseline) : null;
  return (
    <div className="panel">
      <Back label={`All of ${stateName(state)}`} onClick={() => onSelect(office, state, null)} />
      <h2 className="panel__title panel__title--state">
        {shape ? shape.name : "County"}, {stateName(state)}
      </h2>
      {d && (
        <p className="county-fact">
          {d[0].toLocaleString("en-US")} people, {Math.round(d[4]).toLocaleString("en-US")} per square mile. {Math.round(d[1])}% of adults hold a bachelor’s degree
          {d[2] !== null && `, the median household income is $${d[2].toLocaleString("en-US")}`} and {Math.round(d[3])}% of residents are white and non-Hispanic
          (Census Bureau estimates).
        </p>
      )}
      {then && (
        <p className="county-fact">
          In the 2024 presidential vote the county went {marginLabel(then.margin)}:{" "}
          {then.rep >= then.dem ? `${pct(then.rep)} Republican, ${pct(then.dem)} Democratic` : `${pct(then.dem)} Democratic, ${pct(then.rep)} Republican`}.
        </p>
      )}
      {list.map((race) => (
        <Fragment key={race.id}>
          {house.length > 1 && race === house[0] && (
            <p className="county-fact county-fact--split">
              {shape ? shape.name : "This county"} is split among {apNumber(house.length)} House districts. Each shows the votes from its part of the county.
            </p>
          )}
          <CountyRace
            race={race}
            row={counties ? counties[race.office][String(race.id)]?.[fips] : undefined}
            loading={!counties}
            fips={fips}
            baseline={race.office === "H" ? null : baseline} // a district has no 2024 figure for its part of a county
            onOpen={() => onSelect(race.office, race.state, raceDistrict(race))}
          />
        </Fragment>
      ))}
      {list.length === 0 && <p className="panel__note">{counties ? `No race in ${stateName(state)} is in these results.` : "Loading county results…"}</p>}
    </div>
  );
}

function CountyRace({ race, row, loading, fips, baseline, onOpen }: { race: Race; row: number[] | undefined; loading: boolean; fips: string; baseline: Baseline | null; onOpen: () => void }) {
  const reading = row ? readCounty(row) : null;
  const cols = countyColumns(race);
  const title =
    race.office === "B"
      ? measureShortTitle(race)
      : race.office === "H"
        ? `House ${race.num === 0 ? "at-large seat" : `District ${race.num}`}`
        : `${OFFICE_SINGULAR[race.office]}${race.special ? " special election" : ""}`;
  const shift = row && baseline ? countyShift(race, row, fips, baseline) : null;
  const flip = row && baseline ? countyFlip(race, row, fips, baseline) : null;
  const turnout = row && baseline ? countyTurnoutVs2024(row, fips, baseline) : null;
  const others = row ? (row[row.length - 1] ?? 0) : 0;
  return (
    <section className="county-race" aria-label={`${OFFICE_NAME[race.office]}: ${title}`}>
      <h3>
        <button type="button" className="row-link" onClick={onOpen}>
          {title}
        </button>
      </h3>
      {loading ? (
        <p className="panel__note">Loading county results…</p>
      ) : !reading || !row ? (
        <p className="panel__note">{race.unopposed && race.total === 0 ? "This candidate ran unopposed, and the state reports no votes for the race." : "No votes reported yet"}</p>
      ) : (
        <>
          <ul className="county-race__rows">
            {cols
              .map((c, i) => ({ c, share: reading.shares[i] ?? 0, n: row[i + 1] ?? 0 }))
              .sort((a, b) => b.share - a.share)
              .map(({ c, share, n }) => (
                <li key={c.name}>
                  <span className="key" style={{ background: PARTY[c.party] }} />
                  <span className="name">{c.name}</span>
                  <span className="votes">{votes(n)}</span>
                  <span className="value">{pct(share)}</span>
                  <span className="bar" aria-hidden="true">
                    <span style={{ width: `${share}%`, background: PARTY[c.party] }} />
                  </span>
                </li>
              ))}
            {others > 0 && (
              <li>
                <span className="key" style={{ background: PARTY.O }} />
                <span className="name">{race.cands.find((c) => c.party === "O")?.name ?? "Others"}</span>
                <span className="votes">{votes(others)}</span>
                <span className="value">{pct((100 * others) / reading.total)}</span>
              </li>
            )}
          </ul>
          <p className="county-race__foot">
            {reportingText(reading.pctIn, reading.total)} · {votes(reading.total)} votes
            {turnout !== null && ` · ${Math.round(turnout)}% of the county’s 2024 presidential vote`}
          </p>
          {shift && (
            <p className="county-race__shift">
              {shiftText(shift)}
              {flip ? ". Changed sides since 2024" : ""}.
            </p>
          )}
        </>
      )}
    </section>
  );
}
