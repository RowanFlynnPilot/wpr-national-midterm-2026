// The compact embed: balance of power and the latest calls, for a homepage module or an article sidebar.
// Every card and row links to the full page (the article that hosts it when the snippet passes ?host=).
import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { SeatBar } from "./components/SeatBar";
import { PARTY } from "./lib/colors";
import { loadResults } from "./lib/data";
import { EMBED_ID, initEmbedHeight } from "./lib/embed";
import { apNumber, centralTime, relativeAge, timeAgo } from "./lib/format";
import { shareUrl } from "./lib/share";
import { chamber, OFFICE_NAME, OFFICE_SLUG, raceTitle, secured, type Chamber } from "./lib/summary";
import type { Office, Race, Results } from "./lib/types";
import "./styles.css";
import "./compact.css";

const ORDER: Office[] = ["S", "H", "G", "B"];
const CALLS = 6;
const REFRESH_MS = 15 * 60 * 1000;

/** The full page, or the article hosting it, at a view hash. */
const fullPage = (hash: string) => shareUrl(window.location.search, hash, new URL("./", window.location.href).href);

function Card({ c }: { c: Chamber }) {
  const measures = c.office === "B";
  const left = measures ? { n: c.won.Y, label: "Passed", color: PARTY.Y } : { n: secured(c, "D"), label: "Democrats", color: PARTY.D };
  const right = measures ? { n: c.won.N, label: "Failed", color: PARTY.N } : { n: secured(c, "R"), label: "Republicans", color: PARTY.R };
  const uncalled = c.uncalled.length;
  return (
    <a className="compact__card" href={fullPage(`#${OFFICE_SLUG[c.office]}`)} target="_top">
      <span className="compact__head">
        <span className="compact__name">{OFFICE_NAME[c.office]}</span>
        <span className="compact__rule">{measures ? `${c.total} statewide` : c.office === "G" ? `${c.total} governors` : `${c.majority} for a majority`}</span>
      </span>
      <span className="compact__counts">
        <span className="compact__count">
          <strong style={{ color: left.color }}>{left.n}</strong> {left.label}
        </span>
        <span className="compact__count compact__count--right">
          <strong style={{ color: right.color }}>{right.n}</strong> {right.label}
        </span>
      </span>
      <SeatBar chamber={c} />
      <span className="compact__foot">{uncalled ? `${apNumber(uncalled).replace(/^\w/, (x) => x.toUpperCase())} not called` : "All called"}</span>
    </a>
  );
}

function raceHash(r: Race): string {
  const tail = r.office === "H" || r.office === "B" ? `-${(r.district as string).split("-")[1]?.toLowerCase()}` : "";
  return `#${OFFICE_SLUG[r.office]}-${r.state.toLowerCase()}${tail}`;
}

function Compact({ initial }: { initial: Results }) {
  const [results, setResults] = useState(initial);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const tick = window.setInterval(() => setNow(Date.now()), 60_000);
    const refresh = window.setInterval(() => loadResults().then((r) => r.fetched !== results.fetched && setResults(r), () => undefined), REFRESH_MS);
    return () => {
      window.clearInterval(tick);
      window.clearInterval(refresh);
    };
  }, [results.fetched]);

  const chambers = ORDER.map((o) => chamber(results, o));
  const calls = results.races
    .filter((r): r is Race & { calledAt: string } => r.calledAt !== null)
    .sort((a, z) => z.calledAt.localeCompare(a.calledAt))
    .slice(0, CALLS);
  const ago = relativeAge(results.updated, now);

  return (
    <div className="compact">
      <header className="compact__masthead">
        <img className="compact__badge" src="./brand/wpr-typewriter-badge.png" alt="" width={32} height={32} decoding="async" />
        <span className="compact__kicker">2026 midterm election results</span>
        <span className="compact__updated">
          Updated <time dateTime={results.updated}>{centralTime(results.updated)}</time>
          {ago && <span className="kicker__ago"> · {ago}</span>}
        </span>
      </header>
      <div className="compact__cards">
        {chambers.map((c) => (
          <Card key={c.office} c={c} />
        ))}
      </div>
      {calls.length > 0 && (
        <section className="compact__calls" aria-labelledby="compact-calls">
          <h2 id="compact-calls" className="compact__title">
            Latest calls
          </h2>
          <ul className="compact__list">
            {calls.map((r) => (
              <li key={r.id}>
                <a href={fullPage(raceHash(r))} target="_top">
                  <span className="compact__swatch" style={{ background: PARTY[r.winner as keyof typeof PARTY] }} />
                  <span className="compact__race">{raceTitle(r)}</span>
                  <span className="compact__who">{r.office === "B" ? (r.winner === "Y" ? "Passed" : "Failed") : r.cands[0]?.name}</span>
                  <span className="compact__when">{timeAgo(r.calledAt, now)}</span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}
      <a className="compact__more" href={fullPage("#senate")} target="_top">
        Every race, every state, every county →
      </a>
    </div>
  );
}

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("missing #root");
const root = createRoot(rootEl);

initEmbedHeight(`${EMBED_ID}-compact`);
root.render(<p className="loading">Loading results…</p>);
loadResults()
  .then((results) =>
    root.render(
      <StrictMode>
        <Compact initial={results} />
      </StrictMode>,
    ),
  )
  .catch((err: Error) => root.render(<p className="load-error">The results could not be loaded. {err.message}</p>));
