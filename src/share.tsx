// The share images, rendered by scripts/share-image.mjs: share.html is the balance-of-power card; share.html#<race hash>
// is that race's card, with a #card-meta block the script copies into the race's stub page. With no hash the page also
// lists every race's hash (#card-index) so the script knows what to render.
import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { RaceShare } from "./components/RaceShare";
import { ShareCard } from "./components/ShareCard";
import { loadBaseline, loadResults } from "./lib/data";
import { parseHash, raceDistrict, raceFor, toHash } from "./lib/route";
import { PUBLISHER } from "./lib/share";
import type { Baseline } from "./lib/shift";
import type { Results } from "./lib/types";
import "./styles.css";
import "./share.css";

function ShareApp({ results, baseline }: { results: Results; baseline: Baseline | null }) {
  const [hash, setHash] = useState(window.location.hash);
  useEffect(() => {
    const onHash = () => setHash(window.location.hash);
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  if (hash.length > 1) {
    const sel = parseHash(hash);
    const race = raceFor(results.races, sel);
    if (!race) throw new Error(`no race for ${hash}`);
    return <RaceShare race={race} baseline={baseline} hash={toHash(sel)} />;
  }
  const hashes = [...new Set(results.races.map((r) => toHash({ office: r.office, state: r.state, district: raceDistrict(r) })))];
  return (
    <>
      <ShareCard results={results} baseline={baseline} />
      <script id="card-index" type="application/json">
        {JSON.stringify({ hashes, publisher: PUBLISHER.source })}
      </script>
    </>
  );
}

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("missing #root");
const root = createRoot(rootEl);

Promise.all([loadResults(), loadBaseline()])
  .then(([results, baseline]) => root.render(<ShareApp results={results} baseline={baseline} />))
  .catch((err: Error) => root.render(<p className="load-error">{err.message}</p>));
