import { useState } from "react";
import { PALE, PARTY, PARTY_LABEL } from "../lib/colors";
import { apNumber, centralTime, marginText, pct, reportingShare, signedMargin, timeAgo } from "../lib/format";
import { upcoming } from "../lib/next";
import { raceDistrict, raceFor } from "../lib/route";
import { HOME_STATE, stateName } from "../lib/states";
import { RUNOFF, noVotesYet, raceFill, raceStatus, yesShare } from "../lib/status";
import type { Geo } from "../lib/geo";
import { side, trend, type History } from "../lib/history";
import { measureShortTitle, OFFICE_NAME, OFFICE_SINGULAR, type Chamber, type PopularVote } from "../lib/summary";
import type { CountySets, KeyDate, Office, Race } from "../lib/types";
import type { Demographics } from "../lib/patterns";
import type { Baseline } from "../lib/shift";
import { Back } from "./Back";
import { CountyFinder } from "./CountyFinder";
import { CountyMap } from "./CountyMap";
import { CountyView } from "./CountyView";
import { EmbedRace } from "./EmbedRace";
import { KeyDates } from "./KeyDates";
import { MarginStrip } from "./MarginStrip";
import { RaceCard } from "./RaceCard";
import { ShareRace } from "./ShareRace";

interface Props {
  office: Office;
  state: string | null;
  district: string | null;
  county: string | null; // a county FIPS on the Senate, governor and House views: its own page
  races: Race[];
  chamber: Chamber;
  popularVote: PopularVote;
  counties: CountySets | null; // null until the county files load
  geo: Geo | null; // null until the map shapes load
  history: History;
  demographics: Demographics | null; // null until the Census file loads
  baseline: Baseline | null; // the 2024 presidential vote; null until it loads
  now: number;
  onSelect: (office: Office, state: string | null, district: string | null, county?: string) => void;
}

export function SidePanel(props: Props) {
  const { office, state, district, county, races, geo } = props;
  // A county page until the shapes prove the FIPS is not one (the atlas is the county list; the hash only checks the state prefix).
  if (county && state && office !== "B" && (!geo || geo.counties.some((c) => c.id === county))) return <CountyView {...props} office={office} state={state} fips={county} />;
  if (district && raceFor(races, { office, state, district })) return office === "B" ? <MeasureView {...props} district={district} /> : <DistrictView {...props} district={district} />;
  if (state) {
    const list = office === "H" ? <HouseStateView {...props} state={state} /> : office === "B" ? <MeasuresStateView {...props} state={state} /> : <StateView {...props} state={state} />;
    // A link that names a race or county the data does not have (a typo, a truncated link, a renumbered measure) is the
    // reader's input, not the data's: the state's list stands in, and says so. The data itself still fails fast in build.py.
    const missing = county && office !== "B" ? "county" : district ? (office === "B" ? "measure" : "House district") : null;
    if (!missing) return list;
    return (
      <>
        <p className="stale panel__missing" role="status">
          No {missing} matches that link. Showing {stateName(state)} instead.
        </p>
        {list}
      </>
    );
  }
  return <Overview key={office} {...props} />; // keyed so an expanded list folds back when the office changes
}

/**
 * The overview's lists that belong to the map rather than beside it: the latest calls, the runoffs and the seats that
 * changed parties, led by the dates still ahead (none during a replay: App passes no dates then). App lays them under the map on wide screens (the panel had run a screen past the map there) and after
 * the panel when the board is stacked, which is where they read before.
 */
export function OverviewLists({
  office,
  chamber,
  races,
  dates,
  now,
  onSelect,
}: Pick<Props, "office" | "chamber" | "races" | "now" | "onSelect"> & { dates: KeyDate[] }) {
  const pick = (r: Race) => onSelect(office, r.state, raceDistrict(r));
  const flips = office === "S" || office === "G";
  const failed = office === "B" ? races.filter((r) => r.office === "B" && r.winner === "N") : [];
  const next = upcoming(dates, races, office, now);
  if (!next.length && !chamber.latestCalls.length && !chamber.runoffs.length && !flips && !failed.length) return null;
  return (
    <div className="board__under">
      {next.length > 0 && <KeyDates key={office} dates={next} />}
      {chamber.latestCalls.length > 0 && (
        <section className="board__list" aria-labelledby="calls-title">
          <h2 id="calls-title" className="panel__title">
            Latest calls
          </h2>
          <p className="panel__note">Newest first. Times are civicAPI’s; some early calls carry no time and are not listed.</p>
          <ul className="race-rows">
            {chamber.latestCalls.map((r) => (
              <RaceRow key={r.id} race={r} when={timeAgo(r.calledAt as string, now)} onClick={() => pick(r)} />
            ))}
          </ul>
          {now - Date.parse((chamber.latestCalls[0] as Race).calledAt as string) > QUIET_MS && (
            <p className="panel__note panel__note--foot">
              The newest call with a time here is from {centralTime((chamber.latestCalls[0] as Race).calledAt as string)}. The count goes on; the calls are civicAPI’s.
            </p>
          )}
        </section>
      )}
      {chamber.runoffs.length > 0 && (
        <section className="board__list" aria-labelledby="runoffs-title">
          <h2 id="runoffs-title" className="panel__title">
            Headed to runoffs
          </h2>
          <p className="panel__note">No candidate won a majority, so the top two meet again.</p>
          <ul className="race-rows">
            {chamber.runoffs.map((r) => (
              <RaceRow key={r.id} race={r} onClick={() => pick(r)} />
            ))}
          </ul>
        </section>
      )}
      {flips && (
        <section className="board__list" aria-labelledby="flips-title">
          <h2 id="flips-title" className="panel__title">
            Seats that changed parties
          </h2>
          {chamber.flips.length ? (
            <ul className="race-rows">
              {chamber.flips.map((r) => (
                <RaceRow key={r.id} race={r} onClick={() => pick(r)} />
              ))}
            </ul>
          ) : (
            <p className="panel__note">No seats have changed parties among called races.</p>
          )}
        </section>
      )}
      {failed.length > 0 && (
        <section className="board__list" aria-labelledby="failed-title">
          <h2 id="failed-title" className="panel__title">
            Measures that failed
          </h2>
          <ul className="race-rows">
            {failed.map((r) => (
              <RaceRow key={r.id} race={r} onClick={() => pick(r)} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function shortTitle(race: Race): string {
  if (race.office === "H") return race.district ?? race.state;
  return `${stateName(race.state)}${race.special ? " (special)" : ""}`;
}

/** "Question 2 - Prohibit Closing Places of Worship" -> ["Question 2", "Prohibit Closing Places of Worship"]. A label longer than the row's label column (14 characters) or a title without a dash -> [null, null]. */
function splitMeasureTitle(title: string): [string | null, string | null] {
  const m = /^(.{3,14}?)\s[-–:]\s(.+)$/.exec(title);
  return m ? [m[1] as string, m[2] as string] : [null, null];
}

interface RowProps {
  race: Race;
  onClick: () => void;
  showOffice?: boolean;
  when?: string; // replaces the margin detail, for the latest-calls feed
  points?: import("../lib/history").HistoryPoint[]; // the race's count history, for a direction arrow
}

const TREND_GLYPH = { widening: "\u25B2", narrowing: "\u25BC", flipped: "\u21C5" } as const;
const TREND_TEXT = { widening: "lead widening since the last update", narrowing: "lead narrowing since the last update", flipped: "lead changed hands since the last update" } as const;

function RaceRow({ race, onClick, showOffice = false, when, points }: RowProps) {
  const movement = points && !race.winner ? trend(points, side(race)) : null;
  const lead = race.cands[0];
  if (!lead) return null;
  const status = raceStatus(race);
  const measure = race.office === "B";
  const share = reportingShare(race.pctIn, race.total);
  const inText = share ? `${share} in` : "share not given";
  const [big, small] =
    noVotesYet(race)
      ? ["—", "no votes yet"]
      : status === "won"
      ? race.unopposed
        ? ["Won", "unopposed"]
        : [
            measure ? (race.winner === "Y" ? "Passed" : "Failed") : race.flip ? "Flip" : "Won",
            // a measure that failed while Yes led (Florida needs 60%) shows the Yes share: "Failed by 16.4" would read as a No landslide
            when ?? (measure && race.winner !== race.leader ? `Yes ${pct(yesShare(race))}` : `by ${marginText(race.margin)}`),
          ]
      : status === "runoff"
        ? ["Runoff", "no majority"]
        : status === "decided"
          ? [`${race.partyDecided} seat`, inText]
          : [signedMargin(race.margin), inText];
  // "Question 2 - Prohibit Closing..." splits into the label and the subject; a title without a dash stays whole.
  const [measureLabel, measureSubject] = measure ? splitMeasureTitle(measureShortTitle(race)) : [null, null];
  const where = showOffice ? (measureLabel ?? OFFICE_SINGULAR[race.office]) : shortTitle(race);
  const who = measure
    ? (showOffice ? measureSubject : null) ?? measureShortTitle(race)
    : status === "runoff"
      ? race.cands.filter((c) => c.advanced).map((c) => c.name.split(" ").slice(-1)[0]).join(" vs. ") || lead.name
      : lead.name;
  return (
    <li>
      <button type="button" className="race-row" onClick={onClick}>
        <span className="race-row__swatch" style={{ background: raceFill(race) }} />
        <span className="race-row__where">{where}</span>
        <span className={measure ? "race-row__who race-row__who--wrap" : "race-row__who"}>{who}</span>
        <span className="race-row__margin">
          <span>
            {movement && (
              <span className={`trend trend--${movement}`} role="img" aria-label={TREND_TEXT[movement]}>
                {TREND_GLYPH[movement]}
              </span>
            )}
            {big}
          </span>
          <small>{small}</small>
        </span>
      </button>
    </li>
  );
}

/** A day without a call: the latest-calls list then says the count is slow rather than the page stuck. */
const QUIET_MS = 24 * 3600e3;

const COUNTING_LISTED = 8; // the House and measures panels run past their maps even so; a button shows the rest in place

function Overview({ office, chamber, popularVote, races, history, geo, onSelect }: Props) {
  const [showAll, setShowAll] = useState(false);
  const counting = chamber.uncalled.filter((r) => !r.runoff);
  const listed = showAll ? counting : counting.slice(0, COUNTING_LISTED);
  const pick = (r: Race) => onSelect(office, r.state, raceDistrict(r));
  const measures = office === "B";
  // civicAPI is slow to call measures: on Nov. 8, 40 of the 68 it had not called stood at 99.9% reporting.
  const counted = measures ? counting.filter((r) => r.pctIn >= 99).length : 0;
  const homeSeats = races.filter((r) => r.office === "H" && r.state === HOME_STATE).length;
  return (
    <div className="panel">
      <CountyFinder geo={geo} races={races} office={office} onSelect={(o, st, fips) => onSelect(o, st, null, fips)} />
      {office === "H" && <PopularVoteBlock vote={popularVote} />}
      {office === "H" && (
        <section className="margins" aria-labelledby="margins-title">
          <h2 id="margins-title" className="panel__title">
            How close the House was
          </h2>
          <p className="panel__note">
            Each dot is one district by its margin, Democratic wins to the left and Republican to the right; pale dots are not yet called. {stateName(HOME_STATE)}’s{" "}
            {apNumber(homeSeats)} {homeSeats === 1 ? "is" : "are"} outlined.
          </p>
          <MarginStrip races={races} onSelect={(r) => onSelect("H", r.state, r.district)} />
        </section>
      )}
      <HomeGlance races={races} onSelect={onSelect} />
      <h2 className="panel__title">{measures ? "Measures not yet called" : `${OFFICE_NAME[office] === "Governors" ? "Governor" : OFFICE_NAME[office]} races still being counted`}</h2>
      {counting.length ? (
        <>
          <p className="panel__note">
            Closest first. Leads are in percentage points.
            {counted > 0 && ` civicAPI is slow to call measures: ${counted} of these ${counting.length} are at least 99% counted.`}
          </p>
          <ul className="race-rows">
            {listed.map((r) => (
              <RaceRow key={r.id} race={r} points={history[String(r.id)]} onClick={() => pick(r)} />
            ))}
          </ul>
          {counting.length > listed.length && (
            <button type="button" className="show-all" onClick={() => setShowAll(true)}>
              Show all {counting.length} {measures ? "measures" : "races"}
            </button>
          )}
        </>
      ) : (
        <p className="panel__note">Every {measures ? "measure" : `${OFFICE_SINGULAR[office].toLowerCase()} race`} has been called.</p>
      )}
    </div>
  );
}

/** The home state's statewide races and House delegation, one tap from any overview. */
const GLANCE_ORDER: Record<Office, number> = { S: 0, G: 1, B: 2, H: 3 };

function HomeGlance({ races, onSelect }: Pick<Props, "races" | "onSelect">) {
  const statewide = races.filter((r) => r.state === HOME_STATE && r.office !== "H").sort((a, b) => GLANCE_ORDER[a.office] - GLANCE_ORDER[b.office]);
  const house = races.filter((r) => r.state === HOME_STATE && r.office === "H");
  return (
    <section className="glance" aria-labelledby="glance-title">
      <h2 id="glance-title" className="panel__title">
        {stateName(HOME_STATE)} at a glance
      </h2>
      <ul className="race-rows">
        {statewide.map((r) => (
          <RaceRow key={r.id} race={r} showOffice onClick={() => onSelect(r.office, HOME_STATE, null)} />
        ))}
        <li>
          <button type="button" className="race-row race-row--house" onClick={() => onSelect("H", HOME_STATE, null)}>
            <span className="race-row__where">House</span>
            <Delegation races={house} />
          </button>
        </li>
      </ul>
    </section>
  );
}

function PopularVoteBlock({ vote }: { vote: PopularVote }) {
  const other = vote.share.I + vote.share.O;
  return (
    <section className="popvote" aria-labelledby="popvote-title">
      <h2 id="popvote-title" className="panel__title">
        House popular vote
      </h2>
      <div className="popvote__figures">
        <span>
          <strong>{pct(vote.share.D)}</strong> Democrats
        </span>
        <span>
          <strong>{pct(vote.share.R)}</strong> Republicans
        </span>
      </div>
      <div className="popvote__bar" aria-hidden="true">
        <span style={{ width: `${vote.share.D}%`, background: PARTY.D }} />
        <span style={{ width: `${other}%`, background: PALE.O }} />
        <span style={{ width: `${vote.share.R}%`, background: PARTY.R }} />
      </div>
      <p className="panel__note">
        All {vote.total.toLocaleString("en-US")} votes counted so far in House races. Includes {apNumber(vote.noRepublican)} districts with no
        Republican on the ballot and {apNumber(vote.noDemocrat)} with no Democrat; other candidates took {pct(other)}.
      </p>
    </section>
  );
}

function StateView({ office, state, races, counties, geo, history, baseline, onSelect }: Props & { state: string }) {
  const race = races.find((r) => r.office === office && r.state === state);
  const others = races.filter((r) => r.state === state && r.office !== office && r.office !== "H");
  const house = races.filter((r) => r.state === state && r.office === "H");
  const countyData = counties ? (office === "S" ? counties.S : counties.G) : null;
  return (
    <div className="panel">
      <Back label={`All ${office === "S" ? "Senate" : "governor"} races`} onClick={() => onSelect(office, null, null)} />
      {race ? (
        <>
          <RaceCard race={race} heading="h2" points={history[String(race.id)]} baseline={baseline} counties={countyData} />
          <div className="race-actions">
            <ShareRace race={race} />
            <EmbedRace race={race} />
          </div>
          {geo && countyData && <CountyMap race={race} counties={countyData} geo={geo} />}
        </>
      ) : (
        <h2 className="panel__title panel__title--state">
          {stateName(state)} has no {OFFICE_SINGULAR[office].toLowerCase()} race this year
        </h2>
      )}
      <CountyFinder geo={geo} races={races} office={office} onSelect={(o, st, fips) => onSelect(o, st, null, fips)} />
      <h3 className="panel__subtitle">Also on the ballot in {stateName(state)}</h3>
      <ul className="race-rows">
        {others.map((r) => (
          <RaceRow key={r.id} race={r} showOffice onClick={() => onSelect(r.office, state, null)} />
        ))}
        <li>
          <button type="button" className="race-row race-row--house" onClick={() => onSelect("H", state, null)}>
            <span className="race-row__where">House</span>
            <Delegation races={house} />
          </button>
        </li>
      </ul>
    </div>
  );
}

function Delegation({ races }: { races: Race[] }) {
  const seated = (p: "D" | "R" | "I") => races.filter((r) => r.winner === p || r.partyDecided === p).length;
  const leading = (p: "D" | "R" | "I") => races.filter((r) => raceStatus(r) === "leading" && r.leader === p).length;
  const runoffs = races.filter((r) => r.runoff).length;
  const parts = [
    { key: "Dw", w: seated("D"), c: PARTY.D }, { key: "Dl", w: leading("D"), c: PALE.D },
    { key: "Iw", w: seated("I"), c: PARTY.I }, { key: "Il", w: leading("I"), c: PALE.I },
    { key: "Ro", w: runoffs, c: RUNOFF },
    { key: "Rl", w: leading("R"), c: PALE.R }, { key: "Rw", w: seated("R"), c: PARTY.R },
  ].filter((p) => p.w > 0);
  const open = races.filter((r) => raceStatus(r) === "leading" || r.runoff).length; // party not yet certain
  return (
    <span className="delegation">
      <span className="delegation__bar" aria-hidden="true">
        {parts.map((p) => (
          <span key={p.key} style={{ flexGrow: p.w, background: p.c }} />
        ))}
      </span>
      <span className="delegation__text">
        {seated("D")} D, {seated("R")} R{seated("I") ? `, ${seated("I")} other` : ""}
        {open ? `, ${open} still open` : ""}
      </span>
    </span>
  );
}

function HouseStateView({ office, state, races, geo, onSelect }: Props & { state: string }) {
  const house = races.filter((r) => r.office === "H" && r.state === state).sort((a, b) => (a.num ?? 0) - (b.num ?? 0));
  const statewide = races.filter((r) => r.state === state && r.office !== "H");
  return (
    <div className="panel">
      <Back label="All House races" onClick={() => onSelect("H", null, null)} />
      <h2 className="panel__title panel__title--state">{stateName(state)}</h2>
      <p className="panel__lede">
        {apNumber(house.length).replace(/^\w/, (c) => c.toUpperCase())} House seat{house.length === 1 ? "" : "s"}
      </p>
      <Delegation races={house} />
      <ul className="race-rows race-rows--districts">
        {house.map((r) => (
          <RaceRow key={r.id} race={r} onClick={() => onSelect("H", state, r.district)} />
        ))}
      </ul>
      <CountyFinder geo={geo} races={races} office={office} onSelect={(o, st, fips) => onSelect(o, st, null, fips)} />
      {statewide.length > 0 && (
        <>
          <h3 className="panel__subtitle">Also on the ballot in {stateName(state)}</h3>
          <ul className="race-rows">
            {statewide.map((r) => (
              <RaceRow key={r.id} race={r} showOffice onClick={() => onSelect(r.office, state, null)} />
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function MeasuresStateView({ state, races, onSelect }: Props & { state: string }) {
  const list = races.filter((r) => r.office === "B" && r.state === state);
  const others = races.filter((r) => r.state === state && r.office !== "H" && r.office !== "B");
  const house = races.filter((r) => r.state === state && r.office === "H");
  return (
    <div className="panel">
      <Back label="All ballot measures" onClick={() => onSelect("B", null, null)} />
      <h2 className="panel__title panel__title--state">{stateName(state)} ballot measures</h2>
      <p className="panel__lede">
        {apNumber(list.length).replace(/^\w/, (c) => c.toUpperCase())} statewide measure{list.length === 1 ? "" : "s"}
      </p>
      <ul className="race-rows race-rows--measures">
        {list.map((r) => (
          <RaceRow key={r.id} race={r} onClick={() => onSelect("B", state, r.district)} />
        ))}
      </ul>
      <h3 className="panel__subtitle">Also on the ballot in {stateName(state)}</h3>
      <ul className="race-rows">
        {others.map((r) => (
          <RaceRow key={r.id} race={r} showOffice onClick={() => onSelect(r.office, state, null)} />
        ))}
        <li>
          <button type="button" className="race-row race-row--house" onClick={() => onSelect("H", state, null)}>
            <span className="race-row__where">House</span>
            <Delegation races={house} />
          </button>
        </li>
      </ul>
    </div>
  );
}

function MeasureView({ races, district, counties, geo, history, onSelect }: Props & { district: string }) {
  const race = races.find((r) => r.office === "B" && r.district === district);
  if (!race) throw new Error(`unknown measure ${district}`);
  return (
    <div className="panel">
      <Back label={`All ${stateName(race.state)} measures`} onClick={() => onSelect("B", race.state, null)} />
      <RaceCard race={race} heading="h2" points={history[String(race.id)]} />
      <div className="race-actions">
        <ShareRace race={race} />
        <EmbedRace race={race} />
      </div>
      {geo && counties && <CountyMap race={race} counties={counties.B} geo={geo} />}
    </div>
  );
}

function DistrictView({ races, district, history, onSelect }: Props & { district: string }) {
  const race = races.find((r) => r.office === "H" && r.district === district);
  if (!race) throw new Error(`unknown district ${district}`);
  return (
    <div className="panel">
      <Back label={`All ${stateName(race.state)} districts`} onClick={() => onSelect("H", race.state, null)} />
      <RaceCard race={race} heading="h2" points={history[String(race.id)]} />
      <div className="race-actions">
        <ShareRace race={race} />
        <EmbedRace race={race} />
      </div>
      {raceStatus(race) === "leading" && (
        <p className="panel__note">
          {PARTY_LABEL[race.leader]} {race.cands[0]?.name} leads by {race.marginVotes.toLocaleString("en-US")} votes.
        </p>
      )}
    </div>
  );
}
