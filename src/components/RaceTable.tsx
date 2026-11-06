import { useMemo, useState } from "react";
import { PARTY } from "../lib/colors";
import { raceFill, raceStatus } from "../lib/status";
import { marginText, pct } from "../lib/format";
import { stateName } from "../lib/states";
import { OFFICE_NAME } from "../lib/summary";
import type { Office, Race } from "../lib/types";

type Filter = "all" | "open" | "flips";
type Sort = "place" | "margin";

interface Props {
  office: Office;
  races: Race[];
  onSelect: (race: Race) => void;
}

const PAGE = 40;

export function RaceTable({ office, races, onSelect }: Props) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<Sort>("place");
  const [showAll, setShowAll] = useState(false);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = races
      .filter((r) => r.office === office)
      .filter((r) => (filter === "open" ? !r.winner : filter === "flips" ? r.flip : true))
      .filter(
        (r) =>
          !q ||
          stateName(r.state).toLowerCase().includes(q) ||
          r.state.toLowerCase() === q ||
          (r.district ?? "").toLowerCase().includes(q) ||
          r.cands.some((c) => c.name.toLowerCase().includes(q)),
      );
    if (sort === "margin") return [...list].sort((a, b) => a.margin - b.margin);
    if (office === "H") return list; // already in district order
    return [...list].sort((a, b) => stateName(a.state).localeCompare(stateName(b.state)));
  }, [races, office, query, filter, sort]);

  const visible = showAll || query ? rows : rows.slice(0, PAGE);
  const filters: [Filter, string][] = office === "H" ? [["all", "All"], ["open", "Not called"]] : [["all", "All"], ["open", "Not called"], ["flips", "Flipped"]];

  return (
    <section className="table-section" aria-labelledby="table-title">
      <div className="table-tools">
        <h2 id="table-title">Every {OFFICE_NAME[office] === "Governors" ? "governor" : OFFICE_NAME[office]} race</h2>
        <div className="table-controls">
          <label className="search">
            <span className="visually-hidden">Search by state or candidate</span>
            <input type="search" placeholder="Search a state or candidate" value={query} onChange={(e) => setQuery(e.target.value)} />
          </label>
          <div className="segmented" role="radiogroup" aria-label="Filter races">
            {filters.map(([f, label]) => (
              <button key={f} type="button" role="radio" aria-checked={filter === f} className={filter === f ? "is-on" : undefined} onClick={() => setFilter(f)}>
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="table-wrap">
        <table className="races">
          <thead>
            <tr>
              <th scope="col">
                <button type="button" className={sort === "place" ? "sort is-on" : "sort"} onClick={() => setSort("place")}>
                  {office === "H" ? "District" : "State"}
                </button>
              </th>
              <th scope="col">Leading candidate</th>
              <th scope="col">Runner-up</th>
              <th scope="col" className="num">
                <button type="button" className={sort === "margin" ? "sort is-on" : "sort"} onClick={() => setSort("margin")}>
                  Margin
                </button>
              </th>
              <th scope="col" className="num">Reporting</th>
              <th scope="col">Status</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => {
              const [a, b] = r.cands.filter((c) => c.party !== "O");
              return (
                <tr key={r.id} onClick={() => onSelect(r)}>
                  <th scope="row">
                    <button type="button" className="row-link" onClick={(e) => (e.stopPropagation(), onSelect(r))}>
                      {office === "H" ? r.district : `${stateName(r.state)}${r.special ? " (special)" : ""}`}
                    </button>
                  </th>
                  <td>{a && <Cand name={a.name} party={a.party} value={a.pct} strong={a.winner} />}</td>
                  <td>{b && <Cand name={b.name} party={b.party} value={b.pct} strong={false} />}</td>
                  <td className="num">{r.unopposed ? "Unopposed" : marginText(r.margin)}</td>
                  <td className="num">{Math.round(r.pctIn)}%</td>
                  <td>
                    <span className={`pill pill--${r.winner ? "won" : "open"}`} style={{ ["--c" as string]: raceFill(r) }}>
                      {pillText(r)}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!visible.length && <p className="empty">No races match “{query}”. Try a state name, postal code or candidate’s last name.</p>}
      </div>
      {!showAll && !query && rows.length > PAGE && (
        <button type="button" className="show-all" onClick={() => setShowAll(true)}>
          Show all {rows.length} races
        </button>
      )}
    </section>
  );
}

function pillText(r: Race): string {
  switch (raceStatus(r)) {
    case "won":
      return r.flip ? `${r.winner} flip` : `${r.winner} win`;
    case "runoff":
      return "Runoff";
    case "decided":
      return `${r.partyDecided} seat, not called`;
    case "leading":
      return "Not called";
  }
}

function Cand({ name, party, value, strong }: { name: string; party: Race["leader"]; value: number; strong: boolean }) {
  return (
    <span className={strong ? "cand-cell is-winner" : "cand-cell"}>
      <span className="key" style={{ background: PARTY[party] }} />
      <span className="cand-cell__name">{name}</span>
      <span className="cand-cell__pct">{pct(value)}</span>
    </span>
  );
}
