import { PALE, PARTY, PARTY_LABEL } from "../lib/colors";
import { apNumber, marginText, pct, timeAgo } from "../lib/format";
import { HOME_STATE, stateName } from "../lib/states";
import { RUNOFF, raceFill, raceStatus } from "../lib/status";
import type { Geo } from "../lib/geo";
import { OFFICE_NAME, OFFICE_SINGULAR, type Chamber, type PopularVote } from "../lib/summary";
import type { CountyResults, Office, Race } from "../lib/types";
import { CountyMap } from "./CountyMap";
import { RaceCard } from "./RaceCard";

interface Props {
  office: Office;
  state: string | null;
  district: string | null;
  races: Race[];
  chamber: Chamber;
  popularVote: PopularVote;
  counties: { S: CountyResults; G: CountyResults };
  geo: Geo | null; // null until the map shapes load
  now: number;
  onSelect: (office: Office, state: string | null, district: string | null) => void;
}

export function SidePanel(props: Props) {
  const { office, state, district } = props;
  if (district) return <DistrictView {...props} district={district} />;
  if (state) return office === "H" ? <HouseStateView {...props} state={state} /> : <StateView {...props} state={state} />;
  return <Overview {...props} />;
}

function shortTitle(race: Race): string {
  if (race.office === "H") return race.district ?? race.state;
  return `${stateName(race.state)}${race.special ? " (special)" : ""}`;
}

interface RowProps {
  race: Race;
  onClick: () => void;
  showOffice?: boolean;
  when?: string; // replaces the margin detail, for the latest-calls feed
}

function RaceRow({ race, onClick, showOffice = false, when }: RowProps) {
  const lead = race.cands[0];
  if (!lead) return null;
  const status = raceStatus(race);
  const [big, small] =
    status === "won"
      ? race.unopposed
        ? ["Won", "unopposed"]
        : [race.flip ? "Flip" : "Won", when ?? `by ${marginText(race.margin)}`]
      : status === "runoff"
        ? ["Runoff", "no majority"]
        : status === "decided"
          ? [`${race.partyDecided} seat`, `${Math.round(race.pctIn)}% in`]
          : [race.margin < 0.1 ? "<0.1" : `+${marginText(race.margin)}`, `${Math.round(race.pctIn)}% in`];
  const who = status === "runoff" ? race.cands.filter((c) => c.advanced).map((c) => c.name.split(" ").slice(-1)[0]).join(" vs. ") || lead.name : lead.name;
  return (
    <li>
      <button type="button" className="race-row" onClick={onClick}>
        <span className="race-row__swatch" style={{ background: raceFill(race) }} />
        <span className="race-row__where">{showOffice ? OFFICE_SINGULAR[race.office] : shortTitle(race)}</span>
        <span className="race-row__who">{who}</span>
        <span className="race-row__margin">
          {big}
          <small>{small}</small>
        </span>
      </button>
    </li>
  );
}

function Overview({ office, chamber, popularVote, races, now, onSelect }: Props) {
  const counting = chamber.uncalled.filter((r) => !r.runoff);
  const pick = (r: Race) => onSelect(office, r.state, office === "H" ? r.district : null);
  return (
    <div className="panel">
      {office === "H" && <PopularVoteBlock vote={popularVote} />}
      <HomeGlance races={races} onSelect={onSelect} />
      <h2 className="panel__title">{OFFICE_NAME[office] === "Governors" ? "Governor" : OFFICE_NAME[office]} races still being counted</h2>
      {counting.length ? (
        <>
          <p className="panel__note">Closest first. Leads are in percentage points.</p>
          <ul className="race-rows">
            {counting.map((r) => (
              <RaceRow key={r.id} race={r} onClick={() => pick(r)} />
            ))}
          </ul>
        </>
      ) : (
        <p className="panel__note">Every {OFFICE_SINGULAR[office].toLowerCase()} race has been called.</p>
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
      {office !== "H" && (
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
      {office === "H" && (
        <p className="panel__note panel__note--foot">
          Several states redrew their districts in 2025 and 2026, so seat-by-seat flips are not shown. Pick a hexagon or a state to see its races.
        </p>
      )}
    </div>
  );
}

/** The home state's statewide races and House delegation, one tap from any overview. */
function HomeGlance({ races, onSelect }: Pick<Props, "races" | "onSelect">) {
  const statewide = races.filter((r) => r.state === HOME_STATE && r.office !== "H");
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

function StateView({ office, state, races, counties, geo, onSelect }: Props & { state: string }) {
  const race = races.find((r) => r.office === office && r.state === state);
  const others = races.filter((r) => r.state === state && r.office !== office && r.office !== "H");
  const house = races.filter((r) => r.state === state && r.office === "H");
  const countyData = office === "S" ? counties.S : counties.G;
  return (
    <div className="panel">
      <Back label={`All ${OFFICE_NAME[office].toLowerCase()} races`} onClick={() => onSelect(office, null, null)} />
      {race ? (
        <>
          <RaceCard race={race} heading="h2" />
          {geo && <CountyMap race={race} counties={countyData} geo={geo} />}
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

function DistrictView({ races, district, onSelect }: Props & { district: string }) {
  const race = races.find((r) => r.district === district);
  if (!race) throw new Error(`unknown district ${district}`);
  return (
    <div className="panel">
      <Back label={`All ${stateName(race.state)} districts`} onClick={() => onSelect("H", race.state, null)} />
      <RaceCard race={race} heading="h2" />
      {raceStatus(race) === "leading" && (
        <p className="panel__note">
          {PARTY_LABEL[race.leader]} {race.cands[0]?.name} leads by {race.marginVotes.toLocaleString("en-US")} votes.
        </p>
      )}
    </div>
  );
}
