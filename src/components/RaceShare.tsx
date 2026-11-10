import { PARTY } from "../lib/colors";
import { centralTime, pct, reportingShare, reportingText, votes } from "../lib/format";
import { raceShift, shiftText, type Baseline } from "../lib/shift";
import { stateName } from "../lib/states";
import { statusParts, statusText } from "../lib/status";
import { measureShortTitle, raceTitle } from "../lib/summary";
import type { Candidate, Race } from "../lib/types";

const ROWS = 4; // candidates shown; the rest of a crowded ballot is in the app

/** What the stub page for this card says about it: the title, a one-line description and the image's alt text. */
export function cardMeta(race: Race, hash: string): { hash: string; title: string; description: string; alt: string } {
  const [a, b] = race.cands.filter((c) => c.party !== "O");
  const lead = a ? `${a.name} ${pct(a.pct)}` : "";
  const share = reportingShare(race.pctIn, race.total);
  const reporting = share ? `; ${share} reporting.` : ".";
  const standing = race.total === 0 ? "" : b ? ` ${lead}, ${b.name} ${pct(b.pct)}${reporting}` : ` ${lead}${reporting}`;
  const status = statusText(race);
  return {
    hash,
    title: `${raceTitle(race)}: 2026 result`,
    description: `${status}${/[.!?]$/.test(status) ? "" : "."}${standing} From Wausau Pilot & Review's results page, updated several times a day.`,
    alt: `${raceTitle(race)}: ${status}`,
  };
}

/** One race as a 1200×630 card: the title, where it stands, up to four candidates with photos, shares and votes. Rendered by scripts/share-image.mjs. */
export function RaceShare({ race, baseline, hash }: { race: Race; baseline: Baseline | null; hash: string }) {
  const measure = race.office === "B";
  const noVotes = race.total === 0; // an unopposed race Florida did not print, or nothing counted yet
  const rows = race.cands.filter((c) => c.party !== "O" || c.pct >= 0.5).slice(0, ROWS);
  const leadVotes = rows[0]?.votes ?? 0;
  const title = measure ? measureShortTitle(race) : raceTitle(race);
  const kind = measure ? `${stateName(race.state)} ballot measure` : race.office === "H" ? "U.S. House" : race.office === "S" ? "U.S. Senate" : "Governor's race";
  const kicker = `Nov. 3, 2026 · ${kind}${race.special ? " · Special election" : ""}`;
  const line = statusParts(race).join(" · ");
  const shift = baseline ? raceShift(race, baseline) : null;
  const meta = cardMeta(race, hash);
  return (
    <div className="share share-race" data-hash={hash}>
      <header className="share__masthead">
        <img className="share__badge" src="./brand/wpr-typewriter-badge.png" alt="" width={56} height={56} />
        <img className="share__wordmark" src="./brand/wpr-wordmark.png" alt="Wausau Pilot & Review" width={640} height={82} />
        <span className="share__section">2026 midterm results</span>
      </header>
      <main className="share__main">
        <p className="share-race__kicker">{kicker}</p>
        <h1 className={title.length > 48 ? "share-race__title share-race__title--long" : "share-race__title"}>{title}</h1>
        <p className="share-race__status">{line}</p>
        <ul className="share-race__cands">
          {rows.map((c) => (
            <Row key={c.name} c={c} leadVotes={leadVotes} noVotes={noVotes} />
          ))}
        </ul>
        {shift && <p className="share-race__shift">{shiftText(shift)}</p>}
      </main>
      <footer className="share__foot">
        <span>
          {noVotes ? "No votes reported" : `${reportingText(race.pctIn, race.total)} · ${votes(race.total)} votes`} · Updated {centralTime(race.updated)}
        </span>
        <span>wausaupilotandreview.com</span>
      </footer>
      <script id="card-meta" type="application/json">
        {JSON.stringify(meta)}
      </script>
    </div>
  );
}

function Row({ c, leadVotes, noVotes }: { c: Candidate; leadVotes: number; noVotes: boolean }) {
  const color = PARTY[c.party];
  return (
    <li>
      {c.photo ? (
        <img className="share-race__photo" src={`./headshots/${c.photo}`} alt="" width={64} height={64} />
      ) : (
        <span className="share-race__initial" style={{ background: color }} aria-hidden="true">
          {c.name.split(" ").slice(-1)[0]?.[0] ?? ""}
        </span>
      )}
      <span className="share-race__who">
        {c.winner && (
          <svg className="check" viewBox="0 0 16 16" aria-label="Winner">
            <path d="M3.5 8.5l3 3 6-7" />
          </svg>
        )}
        {c.name}
        <small>{c.partyName}</small>
      </span>
      {!noVotes && (
        <>
          <span className="share-race__bar" aria-hidden="true">
            <span style={{ width: `${leadVotes ? (100 * c.votes) / leadVotes : 0}%`, background: color }} />
          </span>
          <span className="share-race__pct">{pct(c.pct)}</span>
          <span className="share-race__votes">{votes(c.votes)}</span>
        </>
      )}
    </li>
  );
}
