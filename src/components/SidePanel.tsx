import { Fragment } from "react";
import { PALE, PARTY, PARTY_LABEL, PARTY_PLURAL } from "../lib/colors";
import { apNumber, marginText, pct, timeAgo } from "../lib/format";
import { HOME_STATE, stateName } from "../lib/states";
import { RUNOFF, noVotesYet, raceFill, raceStatus } from "../lib/status";
import type { Geo } from "../lib/geo";
import { side, trend, type History } from "../lib/history";
import { measureShortTitle, OFFICE_NAME, OFFICE_SINGULAR, raceTitle, type Chamber, type PopularVote } from "../lib/summary";
import type { CountySets, Office, Race } from "../lib/types";
import type { Demographics } from "../lib/patterns";
import { biggestShifts, marginLabel, officeShift, type Baseline } from "../lib/shift";
import { CountyMap } from "./CountyMap";
import { CountyPatterns } from "./CountyPatterns";
import { MarginStrip } from "./MarginStrip";
import { RaceCard } from "./RaceCard";

interface Props {
  office: Office;
  state: string | null;
  district: string | null;
  races: Race[];
  chamber: Chamber;
  popularVote: PopularVote;
  counties: CountySets | null; // null until the county files load
  geo: Geo | null; // null until the map shapes load
  history: History;
  demographics: Demographics | null; // null until the Census file loads
  baseline: Baseline | null; // the 2024 presidential vote; null until it loads
  now: number;
  onSelect: (office: Office, state: string | null, district: string | null) => void;
}

export function SidePanel(props: Props) {
  const { office, state, district } = props;
  if (district) return office === "B" ? <MeasureView {...props} district={district} /> : <DistrictView {...props} district={district} />;
  if (state) return office === "H" ? <HouseStateView {...props} state={state} /> : office === "B" ? <MeasuresStateView {...props} state={state} /> : <StateView {...props} state={state} />;
  return <Overview {...props} />;
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

/** The route for a race's own panel: a district or measure gets its district key, a statewide race none. */
const routeOf = (r: Race) => (r.office === "H" || r.office === "B" ? r.district : null);

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
  const [big, small] =
    noVotesYet(race)
      ? ["—", "no votes yet"]
      : status === "won"
      ? race.unopposed
        ? ["Won", "unopposed"]
        : [measure ? (race.winner === "Y" ? "Passed" : "Failed") : race.flip ? "Flip" : "Won", when ?? `by ${marginText(race.margin)}`]
      : status === "runoff"
        ? ["Runoff", "no majority"]
        : status === "decided"
          ? [`${race.partyDecided} seat`, `${Math.round(race.pctIn)}% in`]
          : [race.margin < 0.1 ? "<0.1" : `+${marginText(race.margin)}`, `${Math.round(race.pctIn)}% in`];
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

const COUNTING_LISTED = 40;

function Overview({ office, chamber, popularVote, races, counties, demographics, baseline, history, now, onSelect }: Props) {
  const counting = chamber.uncalled.filter((r) => !r.runoff);
  const listed = counting.slice(0, COUNTING_LISTED); // mid-replay, hundreds are uncalled; the table has them all
  const pick = (r: Race) => onSelect(office, r.state, routeOf(r));
  const measures = office === "B";
  const failed = measures ? races.filter((r) => r.office === "B" && r.winner === "N") : [];
  return (
    <div className="panel">
      {office === "H" && <PopularVoteBlock vote={popularVote} />}
      {office === "H" && (
        <section className="margins" aria-labelledby="margins-title">
          <h2 id="margins-title" className="panel__title">
            How close the House was
          </h2>
          <p className="panel__note">
            Each dot is one district by its margin, Democratic wins to the left and Republican to the right; pale dots are not yet called. Wisconsin’s eight are outlined.
          </p>
          <MarginStrip races={races} onSelect={(r) => onSelect("H", r.state, r.district)} />
        </section>
      )}
      <HomeGlance races={races} onSelect={onSelect} />
      <h2 className="panel__title">{measures ? "Measures" : `${OFFICE_NAME[office] === "Governors" ? "Governor" : OFFICE_NAME[office]} races`} still being counted</h2>
      {counting.length ? (
        <>
          <p className="panel__note">Closest first. Leads are in percentage points.</p>
          <ul className="race-rows">
            {listed.map((r) => (
              <RaceRow key={r.id} race={r} points={history[String(r.id)]} onClick={() => pick(r)} />
            ))}
          </ul>
          {counting.length > listed.length && <p className="panel__note">And {counting.length - listed.length} more; every race is in the table below.</p>}
        </>
      ) : (
        <p className="panel__note">Every {measures ? "measure" : `${OFFICE_SINGULAR[office].toLowerCase()} race`} has been called.</p>
      )}
      {measures && failed.length > 0 && (
        <>
          <h2 className="panel__title">Measures that failed</h2>
          <ul className="race-rows">
            {failed.map((r) => (
              <RaceRow key={r.id} race={r} onClick={() => pick(r)} />
            ))}
          </ul>
        </>
      )}
      {chamber.latestCalls.length > 0 && (
        <>
          <h2 className="panel__title">Latest calls</h2>
          <p className="panel__note">Newest first. Times are civicAPI’s; some early calls carry no time and are not listed.</p>
          <ul className="race-rows">
            {chamber.latestCalls.map((r) => (
              <RaceRow key={r.id} race={r} when={timeAgo(r.calledAt as string, now)} onClick={() => pick(r)} />
            ))}
          </ul>
        </>
      )}
      {chamber.runoffs.length > 0 && (
        <>
          <h2 className="panel__title">Headed to runoffs</h2>
          <p className="panel__note">No candidate won a majority, so the top two meet again.</p>
          <ul className="race-rows">
            {chamber.runoffs.map((r) => (
              <RaceRow key={r.id} race={r} onClick={() => pick(r)} />
            ))}
          </ul>
        </>
      )}
      {office !== "H" && !measures && (
        <>
          <h2 className="panel__title">Seats that changed parties</h2>
          {chamber.flips.length ? (
            <ul className="race-rows">
              {chamber.flips.map((r) => (
                <RaceRow key={r.id} race={r} onClick={() => pick(r)} />
              ))}
            </ul>
          ) : (
            <p className="panel__note">No seats have changed parties among called races.</p>
          )}
        </>
      )}
      {office !== "H" && !measures && baseline && <ShiftBlock office={office} races={races.filter((r) => r.office === office)} baseline={baseline} onSelect={pick} />}
      {office !== "H" && !measures && counties && demographics && (
        <CountyPatterns
          races={races.filter((r) => r.office === office)}
          counties={office === "S" ? counties.S : counties.G}
          demographics={demographics}
          baseline={baseline}
          scope={`Across the ${races.filter((r) => r.office === office).length} ${office === "S" ? "Senate" : "governor"} races`}
        />
      )}
      {office === "H" && (
        <p className="panel__note panel__note--foot">
          Several states redrew their districts in 2025 and 2026, so seat-by-seat flips are not shown. Pick a hexagon or a state to see its races.
        </p>
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

/** The office's races against the 2024 presidential vote in their states, and the biggest moves each way. */
function ShiftBlock({ office, races, baseline, onSelect }: { office: Office; races: Race[]; baseline: Baseline; onSelect: (r: Race) => void }) {
  const all = officeShift(races, baseline);
  if (!all) return null;
  const s = all.shift.shift;
  return (
    <section className="shift-block" aria-labelledby="shift-title">
      <h2 id="shift-title" className="panel__title">
        Compared with 2024
      </h2>
      <p className="panel__lede">
        Across the {all.races} {office === "S" ? "Senate" : "governor"} races where a Democrat and a Republican finished first and second, the vote ran{" "}
        <strong style={{ color: s > 0 ? PARTY.D : PARTY.R }}>
          {Math.abs(s).toFixed(1)} points more {s > 0 ? "Democratic" : "Republican"}
        </strong>{" "}
        than the 2024 presidential vote in the same states ({marginLabel(all.shift.then)} then, {marginLabel(all.shift.now)} now).
      </p>
      {(["D", "R"] as const).map((p) => {
        const list = biggestShifts(races, baseline, p, 3);
        if (!list.length) return null;
        return (
          <Fragment key={p}>
            <h3 className="panel__subtitle">Biggest moves toward {PARTY_PLURAL[p]}</h3>
            <ul className="race-rows">
              {list.map(({ race, shift }) => (
                <li key={race.id}>
                  <button type="button" className="race-row" onClick={() => onSelect(race)}>
                    <span className="race-row__swatch" style={{ background: raceFill(race) }} />
                    <span className="race-row__where">{shortTitle(race)}</span>
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
      <p className="panel__note">
        Democratic minus Republican share of every vote, this race against the 2024 presidential vote in the state, in points. Races with an
        independent in the top two are left out.
      </p>
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

function Back({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" className="back" onClick={onClick}>
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <path d="M10 3L5 8l5 5" />
      </svg>
      {label}
    </button>
  );
}

function StateView({ office, state, races, counties, geo, history, demographics, baseline, onSelect }: Props & { state: string }) {
  const race = races.find((r) => r.office === office && r.state === state);
  const others = races.filter((r) => r.state === state && r.office !== office && r.office !== "H");
  const house = races.filter((r) => r.state === state && r.office === "H");
  const countyData = counties ? (office === "S" ? counties.S : counties.G) : null;
  return (
    <div className="panel">
      <Back label={`All ${OFFICE_NAME[office].toLowerCase()} races`} onClick={() => onSelect(office, null, null)} />
      {race ? (
        <>
          <RaceCard race={race} heading="h2" points={history[String(race.id)]} baseline={baseline} />
          {geo && countyData && <CountyMap race={race} counties={countyData} geo={geo} />}
          {countyData && demographics && <CountyPatterns races={[race]} counties={countyData} demographics={demographics} baseline={baseline} scope={raceTitle(race)} />}
        </>
      ) : (
        <h2 className="panel__title panel__title--state">
          {stateName(state)} has no {OFFICE_SINGULAR[office].toLowerCase()} race this year
        </h2>
      )}
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

function HouseStateView({ state, races, onSelect }: Props & { state: string }) {
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
      {raceStatus(race) === "leading" && (
        <p className="panel__note">
          {PARTY_LABEL[race.leader]} {race.cands[0]?.name} leads by {race.marginVotes.toLocaleString("en-US")} votes.
        </p>
      )}
    </div>
  );
}
