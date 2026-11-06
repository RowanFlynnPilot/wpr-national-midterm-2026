import { apNumber, centralTime } from "../lib/format";
import { chamber, headline, OFFICE_NAME, secured } from "../lib/summary";
import type { Results } from "../lib/types";
import { SeatBar } from "./SeatBar";

const ORDER = ["S", "H", "G"] as const; // the card shows the three sets of offices, not the measures

/** The 1200×630 Open Graph image: balance of power in all three sets of races. Rendered by scripts/share-image.mjs. */
export function ShareCard({ results }: { results: Results }) {
  const chambers = { S: chamber(results, "S"), H: chamber(results, "H"), G: chamber(results, "G") };
  return (
    <div className="share">
      <header className="share__masthead">
        <span className="wordmark">Wausau Pilot &amp; Review</span>
        <span className="share__section">2026 midterm results</span>
      </header>
      <main className="share__main">
        <h1 className="share__headline">{headline(chambers.H, chambers.S)}</h1>
        <div className="share__chambers">
          {ORDER.map((o) => {
            const c = chambers[o];
            const uncalled = c.uncalled.length;
            return (
              <div className="share__chamber" key={o}>
                <div className="share__row">
                  <span className="share__name">{OFFICE_NAME[o]}</span>
                  <span className="share__note">
                    {uncalled ? `${apNumber(uncalled).replace(/^\w/, (x) => x.toUpperCase())} not called` : "All races called"}
                  </span>
                </div>
                <div className="share__row share__counts">
                  <span className="share__count share__count--d">
                    <strong>{secured(c, "D")}</strong>
                    <small>Democrats</small>
                  </span>
                  <span className="share__count share__count--r">
                    <strong>{secured(c, "R")}</strong>
                    <small>Republicans</small>
                  </span>
                </div>
                <SeatBar chamber={c} />
              </div>
            );
          })}
        </div>
      </main>
      <footer className="share__foot">
        <span>Updated {centralTime(results.updated)}</span>
        <span>wausaupilotandreview.com</span>
      </footer>
    </div>
  );
}
