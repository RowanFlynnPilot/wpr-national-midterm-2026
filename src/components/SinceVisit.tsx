import { useMemo, useState } from "react";
import { PARTY } from "../lib/colors";
import { timeAgo } from "../lib/format";
import { raceTitle } from "../lib/summary";
import type { Race, Results } from "../lib/types";
import { calledSince, type Visit } from "../lib/visits";

interface Props {
  visit: Visit;
  results: Results;
  now: number;
  onSelect: (race: Race) => void;
}

const SHOWN = 5;

/** The races called since this browser last had the page open. */
export function SinceVisit({ visit, results, now, onSelect }: Props) {
  const [dismissed, setDismissed] = useState(false);
  const fresh = useMemo(() => calledSince(results, visit), [results, visit]);
  if (dismissed || fresh.length === 0) return null;
  const shown = fresh.slice(0, SHOWN);
  return (
    <section className="since" aria-label="Since your last visit">
      <p className="since__lead">
        <strong>Since you were last here</strong> ({timeAgo(visit.at, now)}): {fresh.length} race{fresh.length === 1 ? "" : "s"} called.
      </p>
      <ul className="since__list">
        {shown.map((r) => {
          const winner = r.cands.find((c) => c.winner);
          const party = r.winner as NonNullable<Race["winner"]>;
          const who = r.office === "B" ? (party === "Y" ? "Passed" : "Failed") : `${winner?.name ?? ""} (${party})${r.flip ? ", flip" : ""}`;
          return (
            <li key={r.id}>
              <button type="button" className="since__race" onClick={() => onSelect(r)}>
                {raceTitle(r)}
                <span className="since__who" style={{ color: PARTY[party] }}>
                  {who}
                </span>
              </button>
            </li>
          );
        })}
        {fresh.length > shown.length && <li className="since__more">and {fresh.length - shown.length} more</li>}
      </ul>
      <button type="button" className="since__close" aria-label="Dismiss" onClick={() => setDismissed(true)}>
        ×
      </button>
    </section>
  );
}
