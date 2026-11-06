import { PARTY } from "../lib/colors";
import { centralTime, pct, votes } from "../lib/format";
import { rcvNote, statusText } from "../lib/status";
import { raceTitle } from "../lib/summary";
import type { Race } from "../lib/types";

export function RaceCard({ race, heading = "h3" }: { race: Race; heading?: "h2" | "h3" }) {
  const H = heading;
  const noVotes = race.total === 0;
  const leadVotes = race.cands[0]?.votes ?? 0;
  const note = rcvNote(race);
  return (
    <article className="race-card">
      <header className="race-card__head">
        <H>{raceTitle(race)}</H>
        <p className={race.winner ? "status" : "status status--open"}>
          {race.flip && race.winner && race.prior ? (
            <span className="flip-tag" style={{ borderColor: PARTY[race.winner] }}>
              Flipped from {race.prior === "D" ? "Democrat" : "Republican"}
            </span>
          ) : (
            <span>{statusText(race)}</span>
          )}
          {race.calledAt && <span>Called {centralTime(race.calledAt)}</span>}
        </p>
      </header>
      <ol className="cands">
        {race.cands
          .filter((c) => c.party !== "O" || c.pct >= 0.5)
          .map((c) => (
            <li key={c.name} className={c.winner ? "cand is-winner" : "cand"}>
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
        </footer>
      )}
      {note && <p className="race-card__note">{note}</p>}
    </article>
  );
}
