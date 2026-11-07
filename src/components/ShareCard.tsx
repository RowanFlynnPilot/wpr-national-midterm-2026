import { apNumber, centralTime } from "../lib/format";
import { officeShift, type Baseline } from "../lib/shift";
import { chamber, headline, OFFICE_NAME, secured } from "../lib/summary";
import type { Results } from "../lib/types";
import { SeatArc } from "./SeatArc";

const ORDER = ["S", "H", "G"] as const; // the card shows the three sets of offices, not the measures

/** The 1200×630 Open Graph image: balance of power in all three sets of races. Rendered by scripts/share-image.mjs. */
export function ShareCard({ results, baseline }: { results: Results; baseline: Baseline | null }) {
  const chambers = { S: chamber(results, "S"), H: chamber(results, "H"), G: chamber(results, "G") };
  const measures = chamber(results, "B");
  const senateShift = baseline ? officeShift(results.races.filter((r) => r.office === "S"), baseline) : null;
  return (
    <div className="share">
      <header className="share__masthead">
        <img className="share__badge" src="./brand/wpr-typewriter-badge.png" alt="" width={56} height={56} />
        <img className="share__wordmark" src="./brand/wpr-wordmark.png" alt="Wausau Pilot & Review" width={640} height={82} />
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
                <SeatArc chamber={c} />
              </div>
            );
          })}
        </div>
      </main>
      {(measures.total > 0 || senateShift) && (
        <p className="share__measures">
          {measures.total > 0 && (
            <span>
              {measures.total} statewide ballot measures: {measures.won.Y} passed · {measures.won.N} failed · {measures.uncalled.length} not called
            </span>
          )}
          {senateShift && (
            <span>
              Senate vote {Math.abs(senateShift.shift.shift).toFixed(1)} points more {senateShift.shift.shift > 0 ? "Democratic" : "Republican"} than the 2024 presidential vote
            </span>
          )}
        </p>
      )}
      <footer className="share__foot">
        <span>Updated {centralTime(results.updated)}</span>
        <span>wausaupilotandreview.com</span>
      </footer>
    </div>
  );
}
