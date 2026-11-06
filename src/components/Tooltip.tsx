import { PARTY } from "../lib/colors";
import { countyColumns, readCounty } from "../lib/data";
import { pct, votes } from "../lib/format";
import { stateName } from "../lib/states";
import { statusText } from "../lib/status";
import { OFFICE_SINGULAR } from "../lib/summary";
import type { CountyResults, Race } from "../lib/types";

export type HoverTarget =
  | { kind: "state"; state: string }
  | { kind: "county"; state: string; fips: string; name: string }
  | { kind: "district"; district: string };

interface Props {
  target: HoverTarget;
  race: Race | undefined;
  counties: CountyResults | null;
  x: number;
  y: number;
  bounds: { width: number; height: number };
}

const W = 260;

export function Tooltip({ target, race, counties, x, y, bounds }: Props) {
  const left = x + 16 + W > bounds.width ? Math.max(4, x - 16 - W) : x + 16;
  const top = Math.min(Math.max(4, y - 24), Math.max(4, bounds.height - 190));
  return (
    <div className="tooltip" style={{ left, top, width: W }} role="presentation">
      {race ? <TipBody target={target} race={race} counties={counties} /> : <NoRace target={target} />}
    </div>
  );
}

function NoRace({ target }: { target: HoverTarget }) {
  const title = target.kind === "district" ? target.district : stateName(target.state);
  return (
    <>
      <div className="tooltip__title">{title}</div>
      <div className="tooltip__status">No race this year</div>
    </>
  );
}

function TipBody({ target, race, counties }: { target: HoverTarget; race: Race; counties: CountyResults | null }) {
  if (target.kind === "county") {
    const row = counties?.[String(race.id)]?.[target.fips];
    const reading = row ? readCounty(row) : null;
    const cols = countyColumns(race);
    return (
      <>
        <div className="tooltip__title">
          {target.name}, {target.state}
        </div>
        <div className="tooltip__status">
          {reading ? `${Math.round(reading.pctIn)}% reporting` : "No votes reported yet"}
        </div>
        {reading && (
          <ul className="tooltip__rows">
            {cols
              .map((c, i) => ({ c, share: reading.shares[i] ?? 0 }))
              .sort((a, b) => b.share - a.share)
              .map(({ c, share }) => (
                <li key={c.name}>
                  <span className="key" style={{ background: PARTY[c.party] }} />
                  <span className="name">{c.name}</span>
                  <span className="value">{pct(share)}</span>
                </li>
              ))}
          </ul>
        )}
      </>
    );
  }
  const title = race.office === "H" ? `${stateName(race.state)} ${race.num === 0 ? "at-large" : `District ${race.num}`}` : `${stateName(race.state)} ${OFFICE_SINGULAR[race.office]}${race.special ? " (special)" : ""}`;
  return (
    <>
      <div className="tooltip__title">{title}</div>
      <div className="tooltip__status">
        {statusText(race)}
        {!race.winner && !race.runoff && `, ${Math.round(race.pctIn)}% reporting`}
      </div>
      <ul className="tooltip__rows">
        {race.cands
          .filter((c) => c.party !== "O")
          .slice(0, 3)
          .map((c) => (
            <li key={c.name} className={c.winner ? "is-winner" : undefined}>
              <span className="key" style={{ background: PARTY[c.party] }} />
              <span className="name">{c.name}</span>
              <span className="value">{pct(c.pct)}</span>
              <span className="votes">{votes(c.votes)}</span>
            </li>
          ))}
      </ul>
    </>
  );
}
