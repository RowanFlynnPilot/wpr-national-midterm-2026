import { useState } from "react";
import { PARTY } from "../lib/colors";
import { pct } from "../lib/format";
import { countyPatterns, patternRaces, VARIABLES, type Demographics, type Variable } from "../lib/patterns";
import { sides, type Baseline } from "../lib/shift";
import type { CountyResults, Race } from "../lib/types";

interface Props {
  races: Race[]; // the races whose counties are grouped
  counties: CountyResults;
  demographics: Demographics;
  baseline: Baseline | null; // the 2024 presidential vote, for the shift column; null until it loads
  scope: string; // "Across the 35 Senate races", "Wisconsin Governor"
}

/** The vote summed over counties grouped by one Census variable: how rural and urban, degree-rich and poorer places voted. */
export function CountyPatterns({ races, counties, demographics, baseline, scope }: Props) {
  const [variable, setVariable] = useState<Variable>("density");
  const usable = patternRaces(races, counties);
  if (!usable.length) return null;
  const bins = countyPatterns(usable, counties, demographics, variable, baseline);
  const hasShift = bins.some((b) => b.shift !== null);
  const skipped = races.length - usable.length;
  const [left, right] = sides(usable[0] as Race);
  const name = { D: "D", R: "R", Y: "Yes", N: "No" } as Record<string, string>;
  return (
    <section className="patterns" aria-labelledby="patterns-title">
      <div className="patterns__head">
        <h2 id="patterns-title" className="panel__title">
          How counties voted
        </h2>
        <label className="patterns__pick">
          <span className="visually-hidden">Group counties by</span>
          <select value={variable} onChange={(e) => setVariable(e.target.value as Variable)}>
            {(Object.keys(VARIABLES) as Variable[]).map((v) => (
              <option key={v} value={v}>
                {VARIABLES[v].label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <table className="patterns__table">
        <thead>
          <tr>
            <th scope="col">{VARIABLES[variable].label}</th>
            <th scope="col" className="num">
              Share of vote
            </th>
            <th scope="col">Result</th>
            {hasShift && (
              <th scope="col" className="num">
                vs. 2024
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {bins.map((b) => (
            <tr key={b.label}>
              <th scope="row">
                {b.label}
                <small>
                  {b.counties} count{b.counties === 1 ? "y" : "ies"}
                </small>
              </th>
              <td className="num">{b.counties ? pct(b.shareOfVote) : "—"}</td>
              <td className="patterns__result">
                {b.counties > 0 && (
                  <>
                    <span className="patterns__bar" aria-hidden="true">
                      <span style={{ flexGrow: b.dem, background: PARTY[left] }} />
                      <span style={{ flexGrow: Math.max(0, 100 - b.dem - b.rep) }} />
                      <span style={{ flexGrow: b.rep, background: PARTY[right] }} />
                    </span>
                    <span className="patterns__pcts">
                      <span style={{ color: PARTY[left] }}>
                        {name[left]} {pct(b.dem)}
                      </span>
                      <span style={{ color: PARTY[right] }}>
                        {name[right]} {pct(b.rep)}
                      </span>
                    </span>
                  </>
                )}
              </td>
              {hasShift && (
                <td className="num" style={{ color: b.shift === null ? undefined : b.shift > 0 ? PARTY.D : PARTY.R }}>
                  {b.shift === null ? "—" : `${b.shift > 0 ? "D" : "R"} +${Math.abs(b.shift).toFixed(1)}`}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="panel__note">
        {usable.length === 1 ? `${scope}, every county.` : `${scope}: ${usable.length} where a Democrat and a Republican finished first and second${skipped ? `, ${skipped} with an independent in the top two left out` : ""}.`}{" "}
        {left === "Y" && "Shares are of every vote on the question. "}
        Counties are grouped by Census estimates ({demographics.vintage}) and their votes summed, so these are patterns of places, not a
        survey of voters.
        {hasShift && " “vs. 2024” compares the two-party margin with the 2024 presidential vote in the same counties."}
      </p>
    </section>
  );
}
