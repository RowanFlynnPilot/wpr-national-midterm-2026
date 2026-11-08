// One race for an article: race.html#governors-wi (any view hash that names a race). The card, the county map for a
// statewide race or measure, the move since 2024, and a link to the full page. Sized for the host article by the
// embed-height message, refreshed every 15 minutes like the compact embed.
import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { CountyMap } from "./components/CountyMap";
import { RaceCard } from "./components/RaceCard";
import { ShareRace } from "./components/ShareRace";
import { loadAtlas, loadBaseline, loadCountySet, loadHistory, loadResults } from "./lib/data";
import { EMBED_ID, initEmbedHeight } from "./lib/embed";
import { centralTime, relativeAge } from "./lib/format";
import type { Geo } from "./lib/geo";
import type { History } from "./lib/history";
import { parseHash, raceFor, toHash } from "./lib/route";
import { shareUrl } from "./lib/share";
import type { Baseline } from "./lib/shift";
import { raceTitle } from "./lib/summary";
import type { CountyResults, Results, Selection } from "./lib/types";
import "./styles.css";
import "./compact.css";
import "./race.css";

const REFRESH_MS = 15 * 60 * 1000;

function RaceEmbed({ initial, sel }: { initial: Results; sel: Selection }) {
  const [results, setResults] = useState(initial);
  const [counties, setCounties] = useState<CountyResults | null>(null);
  const [geo, setGeo] = useState<Geo | null>(null);
  const [baseline, setBaseline] = useState<Baseline | null>(null);
  const [history, setHistory] = useState<History>({});
  const [now, setNow] = useState(() => Date.now());
  const countyOffice = sel.office === "H" ? null : sel.office; // a House district has no county file
  useEffect(() => {
    if (countyOffice) {
      loadCountySet(countyOffice).then(setCounties);
      loadAtlas().then(setGeo);
    }
    loadBaseline().then(setBaseline);
    loadHistory().then(setHistory, () => undefined);
    const tick = window.setInterval(() => setNow(Date.now()), 60_000);
    const refresh = window.setInterval(() => {
      loadResults().then((r) => {
        if (r.fetched === results.fetched) return;
        setResults(r);
        if (countyOffice) loadCountySet(countyOffice).then(setCounties);
      }, () => undefined);
    }, REFRESH_MS);
    return () => {
      window.clearInterval(tick);
      window.clearInterval(refresh);
    };
  }, [countyOffice, results.fetched]);

  const race = raceFor(results.races, sel);
  if (!race) return <p className="load-error">No race matches this link.</p>;
  const ago = relativeAge(results.updated, now);
  const full = shareUrl(window.location.search, `#${toHash(sel)}`, new URL("./", window.location.href).href);
  return (
    <div className="race-embed">
      <header className="compact__masthead">
        <img className="compact__badge" src="./brand/wpr-typewriter-badge.png" alt="" width={32} height={32} decoding="async" />
        <span className="compact__kicker">2026 midterm election results</span>
        <span className="compact__updated">
          Updated <time dateTime={results.updated}>{centralTime(results.updated)}</time>
          {ago && <span className="kicker__ago"> · {ago}</span>}
        </span>
      </header>
      <RaceCard race={race} heading="h1" points={history[String(race.id)]} baseline={baseline} counties={counties} />
      {countyOffice && counties && geo && <CountyMap race={race} counties={counties} geo={geo} />}
      <div className="race-actions">
        <ShareRace race={race} />
      </div>
      <a className="compact__more" href={full} target="_top">
        Every race, every state, every county →
      </a>
    </div>
  );
}

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("missing #root");
const root = createRoot(rootEl);
const sel = parseHash(window.location.hash);

initEmbedHeight(`${EMBED_ID}-race-${toHash(sel)}`);
root.render(<p className="loading">Loading the race…</p>);
loadResults()
  .then((results) => {
    const race = raceFor(results.races, sel);
    document.title = `${race ? raceTitle(race) : "Race"}: 2026 result — Wausau Pilot & Review`;
    root.render(
      <StrictMode>
        <RaceEmbed initial={results} sel={sel} />
      </StrictMode>,
    );
  })
  .catch((err: Error) => root.render(<p className="load-error">The results could not be loaded. {err.message}</p>));
