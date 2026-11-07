import { useEffect, useMemo, useRef, useState } from "react";
import { PARTY } from "../lib/colors";
import { racesCsv } from "../lib/csv";
import { apNumber, marginText, pct, timeAgo, votes } from "../lib/format";
import { side, trend, type History } from "../lib/history";
import { stateName } from "../lib/states";
import { noVotesYet, raceFill, raceStatus } from "../lib/status";
import { measureShortTitle, OFFICE_NAME, OFFICE_SLUG } from "../lib/summary";
import type { Office, Race } from "../lib/types";
import { RaceCard } from "./RaceCard";

type Filter = "all" | "open" | "flips" | "close";
type Sort = "place" | "leader" | "margin" | "reporting" | "votes" | "called";

interface Props {
  office: Office;
  races: Race[];
  history: History;
  now: number;
  onSelect: (race: Race) => void;
}

const PAGE = 40;
const CLOSE_PTS = 5;

const TREND_GLYPH = { widening: "▲", narrowing: "▼", flipped: "⇅" } as const;
const TREND_TEXT = { widening: "lead widening since the last update", narrowing: "lead narrowing since the last update", flipped: "lead changed hands since the last update" } as const;

export function RaceTable({ office, races, history, now, onSelect }: Props) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<Sort>("place");
  const [showAll, setShowAll] = useState(false);
  const [expanded, setExpanded] = useState<Set<number>>(() => new Set());
  const searchRef = useRef<HTMLInputElement>(null);
  const measures = office === "B";

  // "/" jumps to the search box, as on most results pages, unless the reader is already typing.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "SELECT" || t.tagName === "TEXTAREA")) return;
      e.preventDefault();
      searchRef.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // A new office means a new table: collapse what was open.
  useEffect(() => setExpanded(new Set()), [office]);

  const all = useMemo(() => races.filter((r) => r.office === office), [races, office]);
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = all
      .filter((r) => (filter === "open" ? !r.winner : filter === "flips" ? r.flip : filter === "close" ? r.margin < CLOSE_PTS && !r.unopposed : true))
      .filter(
        (r) =>
          !q ||
          stateName(r.state).toLowerCase().includes(q) ||
          r.state.toLowerCase() === q ||
          (r.office !== "B" && (r.district ?? "").toLowerCase().includes(q)) ||
          (r.title ?? "").toLowerCase().includes(q) ||
          r.cands.some((c) => c.name.toLowerCase().includes(q)),
      );
    const by = {
      place: (a: Race, b: Race) => (office === "H" ? 0 : stateName(a.state).localeCompare(stateName(b.state))),
      leader: (a: Race, b: Race) => (b.cands[0]?.pct ?? 0) - (a.cands[0]?.pct ?? 0),
      margin: (a: Race, b: Race) => a.margin - b.margin,
      reporting: (a: Race, b: Race) => a.pctIn - b.pctIn || a.margin - b.margin,
      votes: (a: Race, b: Race) => b.total - a.total,
      called: (a: Race, b: Race) => (b.calledAt ?? "").localeCompare(a.calledAt ?? ""),
    }[sort];
    return sort === "place" && office === "H" ? list : [...list].sort(by);
  }, [all, office, query, filter, sort]);

  const visible = showAll || query ? rows : rows.slice(0, PAGE);
  const filters: [Filter, string][] = [
    ["all", "All"],
    ["open", "Not called"],
    ...(office === "H" || measures ? [] : [["flips", "Flipped"] as [Filter, string]]),
    ["close", `Within ${CLOSE_PTS} points`],
  ];
  const heading = measures ? "Every statewide ballot measure" : `Every ${OFFICE_NAME[office] === "Governors" ? "governor" : OFFICE_NAME[office]} race`;
  const called = all.filter((r) => r.winner).length;
  const summary = `${all.length} ${measures ? "measures" : "races"} · ${called} called · ${all.length - called} not called`;
  const columns = measures ? 9 : 8;

  const toggle = (id: number) =>
    setExpanded((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const download = () => {
    const blob = new Blob([racesCsv(rows)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `wpr-midterm-2026-${OFFICE_SLUG[office]}${filter === "all" && !query ? "" : "-filtered"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="table-section" aria-labelledby="table-title">
      <div className="table-tools">
        <div>
          <h2 id="table-title">{heading}</h2>
          <p className="table-summary">
            {summary}
            {rows.length !== all.length && ` · showing ${rows.length}`}
          </p>
        </div>
        <div className="table-controls">
          <label className="search">
            <span className="visually-hidden">{measures ? "Search by state or measure" : "Search by state or candidate"}</span>
            <input
              ref={searchRef}
              type="search"
              placeholder={measures ? "Search a state or measure…" : "Search a state or candidate…"}
              autoComplete="off"
              spellCheck={false}
              enterKeyHint="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <div className="segmented" role="radiogroup" aria-label="Filter races">
            {filters.map(([f, label]) => (
              <button key={f} type="button" role="radio" aria-checked={filter === f} className={filter === f ? "is-on" : undefined} onClick={() => setFilter(f)}>
                {label}
              </button>
            ))}
          </div>
          <button type="button" className="csv" onClick={download}>
            Download CSV
          </button>
        </div>
      </div>
      <div className="table-wrap">
        <table className="races">
          <thead>
            <tr>
              <th scope="col" className="expander-col">
                <span className="visually-hidden">Details</span>
              </th>
              <SortHeader label={office === "H" ? "District" : "State"} value="place" sort={sort} onSort={setSort} />
              {measures ? (
                <>
                  <th scope="col">Measure</th>
                  <SortHeader label="Yes" value="leader" sort={sort} onSort={setSort} num />
                  <th scope="col" className="num phone-hide">No</th>
                </>
              ) : (
                <>
                  <SortHeader label="Leading candidate" value="leader" sort={sort} onSort={setSort} />
                  <th scope="col" className="phone-hide">Runner-up</th>
                </>
              )}
              <SortHeader label="Margin" value="margin" sort={sort} onSort={setSort} num />
              <SortHeader label="Reporting" value="reporting" sort={sort} onSort={setSort} num tabletHide />
              <SortHeader label="Votes" value="votes" sort={sort} onSort={setSort} num tabletHide />
              <SortHeader label="Called" value="called" sort={sort} onSort={setSort} tabletHide />
              <th scope="col">Status</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => {
              const [a, b] = r.cands.filter((c) => c.party !== "O");
              const yes = r.cands.find((c) => c.party === "Y"), no = r.cands.find((c) => c.party === "N");
              const open = expanded.has(r.id);
              const points = history[String(r.id)];
              const movement = points && !r.winner ? trend(points, side(r)) : null;
              return [
                <tr key={r.id} className={open ? "is-expanded" : undefined} onClick={() => toggle(r.id)}>
                  <td className="expander-col">
                    <button
                      type="button"
                      className="expander"
                      aria-expanded={open}
                      aria-controls={`race-detail-${r.id}`}
                      aria-label={`${open ? "Hide" : "Show"} details for ${office === "H" ? r.district : stateName(r.state)}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggle(r.id);
                      }}
                    >
                      <svg viewBox="0 0 16 16" aria-hidden="true">
                        <path d="M6 3l5 5-5 5" />
                      </svg>
                    </button>
                  </td>
                  <th scope="row">
                    <button
                      type="button"
                      className="row-link"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelect(r);
                      }}
                    >
                      {office === "H" ? r.district : `${stateName(r.state)}${r.special ? " (special)" : ""}`}
                    </button>
                  </th>
                  {measures ? (
                    <>
                      <td className="measure-cell">{measureShortTitle(r)}</td>
                      <td className="num" style={{ color: PARTY.Y }}>{yes && !noVotesYet(r) ? pct(yes.pct) : "—"}</td>
                      <td className="num phone-hide" style={{ color: PARTY.N }}>{no && !noVotesYet(r) ? pct(no.pct) : "—"}</td>
                    </>
                  ) : (
                    <>
                      <td>{a && <Cand name={a.name} party={a.party} value={a.pct} strong={a.winner} />}</td>
                      <td className="phone-hide">{b && <Cand name={b.name} party={b.party} value={b.pct} strong={false} />}</td>
                    </>
                  )}
                  <td className="num">
                    {movement && (
                      <span className={`trend trend--${movement}`} role="img" aria-label={TREND_TEXT[movement]}>
                        {TREND_GLYPH[movement]}
                      </span>
                    )}
                    {r.unopposed ? "Unopposed" : marginText(r.margin)}
                  </td>
                  <td className="num tablet-hide">{Math.round(r.pctIn)}%</td>
                  <td className="num tablet-hide">{votes(r.total)}</td>
                  <td className="tablet-hide called-cell">{r.calledAt ? timeAgo(r.calledAt, now) : r.winner ? "No time given" : "—"}</td>
                  <td>
                    <span className={`pill pill--${r.winner ? "won" : "open"}`} style={{ ["--c" as string]: raceFill(r) }}>
                      {pillText(r)}
                    </span>
                  </td>
                </tr>,
                open && (
                  <tr key={`${r.id}-detail`} className="detail-row">
                    <td colSpan={columns} id={`race-detail-${r.id}`}>
                      <div className="detail">
                        <RaceCard race={r} heading="h3" points={points} />
                        <button type="button" className="detail__open" onClick={() => onSelect(r)}>
                          Open on the map →
                        </button>
                      </div>
                    </td>
                  </tr>
                ),
              ];
            })}
          </tbody>
        </table>
        {!visible.length && <p className="empty">No {measures ? "measures" : "races"} match “{query}”. Try a state name, postal code or {measures ? "a word from the title" : "candidate’s last name"}.</p>}
      </div>
      {!showAll && !query && rows.length > PAGE && (
        <button type="button" className="show-all" onClick={() => setShowAll(true)}>
          Show all {rows.length} {measures ? "measures" : "races"}
        </button>
      )}
      {!measures && office !== "H" && all.some((r) => r.flip) && (
        <p className="table-note">
          {apNumber(all.filter((r) => r.flip).length).replace(/^\w/, (c) => c.toUpperCase())} seat{all.filter((r) => r.flip).length === 1 ? "" : "s"} changed parties among called races.
        </p>
      )}
    </section>
  );
}

function SortHeader({ label, value, sort, onSort, num = false, phoneHide = false, tabletHide = false }: { label: string; value: Sort; sort: Sort; onSort: (s: Sort) => void; num?: boolean; phoneHide?: boolean; tabletHide?: boolean }) {
  const on = sort === value;
  return (
    <th scope="col" className={[num ? "num" : "", phoneHide ? "phone-hide" : "", tabletHide ? "tablet-hide" : ""].filter(Boolean).join(" ") || undefined} aria-sort={on ? "ascending" : "none"}>
      <button type="button" className={on ? "sort is-on" : "sort"} onClick={() => onSort(value)}>
        {label}
      </button>
    </th>
  );
}

function pillText(r: Race): string {
  if (noVotesYet(r)) return "No votes yet";
  switch (raceStatus(r)) {
    case "won":
      if (r.office === "B") return r.winner === "Y" ? "Passed" : "Failed";
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
