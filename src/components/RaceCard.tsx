import { PARTY } from "../lib/colors";
import { centralTime, pct, votes } from "../lib/format";
import type { HistoryPoint } from "../lib/history";
import { countyFlips, countyFlipsText, headToHead, raceShift, shiftText, turnoutVs2024, type Baseline } from "../lib/shift";
import { calledText, rcvNote, statusParts } from "../lib/status";
import { Sparkline } from "./Sparkline";
import { raceTitle } from "../lib/summary";
import type { CountyResults, Race } from "../lib/types";

export function RaceCard({
  race,
  heading = "h3",
  points,
  baseline = null,
  counties = null,
}: {
  race: Race;
  heading?: "h1" | "h2" | "h3";
  points?: HistoryPoint[];
  baseline?: Baseline | null;
  counties?: CountyResults | null; // the office's county rows, for the count of counties that changed sides since 2024
}) {
  const H = heading;
  const shift = baseline ? raceShift(race, baseline) : null;
  const turnout = baseline ? turnoutVs2024(race, baseline) : null;
  const rows = counties?.[String(race.id)];
  const flips = baseline && rows ? countyFlips(race, rows, baseline) : null;
  const noVotes = race.total === 0;
  const leadVotes = race.cands[0]?.votes ?? 0;
  const note = rcvNote(race);
  return (
    <article className="race-card">
      <header className="race-card__head">
        <H>{raceTitle(race)}</H>
        <p className={race.winner ? "status" : "status status--open"}>
          {race.flip && race.winner && race.prior ? (
            <>
              <span className="flip-tag" style={{ borderColor: PARTY[race.winner] }}>
                Flipped from {race.prior === "D" ? "Democrat" : "Republican"}
              </span>
              {calledText(race) && <span>{calledText(race)}</span>}
            </>
          ) : (
            statusParts(race).map((part) => <span key={part}>{part}</span>)
          )}
        </p>
      </header>
      <ol className="cands">
        {race.cands
          .filter((c) => c.party !== "O" || c.pct >= 0.5)
          .map((c) => (
            <li key={c.name} className={c.winner ? "cand is-winner" : "cand"}>
              {c.photo && <img className="cand__photo" src={`./headshots/${c.photo}`} width={44} height={44} alt="" loading="lazy" decoding="async" />}
              <div className="cand__line">
                <span className="cand__name">
                  {c.winner && (
                    <svg className="check" viewBox="0 0 16 16" aria-label="Winner">
                      <path d="M3.5 8.5l3 3 6-7" />
                    </svg>
                  )}
                  {c.name}
                  {c.advanced && <span className="advanced">Runoff</span>}
                </span>
                {!noVotes && <span className="cand__pct">{pct(c.pct)}</span>}
              </div>
              <div className="cand__meta">
                <span>{c.partyName}</span>
                {!noVotes && <span className="cand__votes">{votes(c.votes)}</span>}
              </div>
              {!noVotes && (
                <div className="cand__bar" aria-hidden="true">
                  <span style={{ width: `${leadVotes ? (100 * c.votes) / leadVotes : 0}%`, background: PARTY[c.party] }} />
                </div>
              )}
            </li>
          ))}
      </ol>
      {noVotes ? (
        <p className="race-card__note">This candidate ran unopposed, and the state reports no votes for the race.</p>
      ) : (
        <footer className="race-card__foot">
          <span>{Math.round(race.pctIn)}% reporting</span>
          <span>{votes(race.total)} votes</span>
          <span>Updated {centralTime(race.updated, false)}</span>
        </footer>
      )}
      {shift && <p className="race-card__shift">{shiftText(shift)}</p>}
      {baseline && !shift && (race.office === "S" || race.office === "G") && !headToHead(race) && (
        <p className="race-card__shift">No comparison with the 2024 presidential vote: an independent finished in the top two.</p>
      )}
      {!noVotes && (turnout !== null || flips) && (
        <p className="race-card__shift">
          {turnout !== null && `Votes counted so far come to ${Math.round(turnout)}% of the state's 2024 presidential vote.`}
          {turnout !== null && flips && " "}
          {flips && `${countyFlipsText(flips)}.`}
        </p>
      )}
      {points && points.length >= 2 && <Sparkline race={race} points={points} />}
      {note && <p className="race-card__note">{note}</p>}
    </article>
  );
}
