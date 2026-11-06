import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChamberTabs } from "./components/ChamberTabs";
import { CopyLink } from "./components/CopyLink";
import { HexMap } from "./components/HexMap";
import { Legend } from "./components/Legend";
import { NationalMap, type MapMode } from "./components/NationalMap";
import { RaceTable } from "./components/RaceTable";
import { SidePanel } from "./components/SidePanel";
import { Tooltip, type HoverHandler, type HoverTarget } from "./components/Tooltip";
import { countyColumns, loadAtlas, readCounty, type Data } from "./lib/data";
import { centralTime, relativeAge } from "./lib/format";
import type { Geo } from "./lib/geo";
import { useLive } from "./lib/live";
import { isStale } from "./lib/share";
import { noVotesYet } from "./lib/status";
import { HOME_STATE, stateName } from "./lib/states";
import { chamber, dek, headline, housePopularVote, OFFICE_NAME, OFFICE_SLUG, raceTitle } from "./lib/summary";
import type { Office, Race, Selection } from "./lib/types";

const OFFICE_BY_SLUG: Record<string, Office> = { senate: "S", house: "H", governors: "G" };

function parseHash(hash: string): Selection {
  const [slug = "", st, dist] = hash.replace(/^#/, "").toLowerCase().split("-");
  const office = OFFICE_BY_SLUG[slug] ?? "S";
  const state = st && /^[a-z]{2}$/.test(st) ? st.toUpperCase() : null;
  const district = office === "H" && state && dist ? `${state}-${dist.toUpperCase()}` : null;
  return { office, state, district };
}

function toHash({ office, state, district }: Selection): string {
  return [OFFICE_SLUG[office], state?.toLowerCase(), district?.split("-")[1]?.toLowerCase()].filter(Boolean).join("-");
}

interface Hover {
  target: HoverTarget;
  x: number;
  y: number;
}

/** Holds the map's space while the shapes load, so nothing below it moves. */
function MapPending({ error }: { error: string | null }) {
  return (
    <div className="map-pending" role={error ? "alert" : "status"}>
      {error ? `The map could not be loaded. ${error}` : "Loading the map…"}
    </div>
  );
}

export function App({ data }: { data: Data }) {
  const { hexes } = data;
  // The map shapes are the largest file. Fetching them from an effect, after the first paint,
  // keeps the headline, tabs, panel and table from ever waiting on them; the maps fill in after.
  const [geo, setGeo] = useState<Geo | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    loadAtlas().then(
      (g) => !cancelled && setGeo(g),
      (err: Error) => !cancelled && setGeoError(err.message),
    );
    return () => {
      cancelled = true;
    };
  }, []);
  const { live, refreshing, error } = useLive(data);
  const { results, counties } = live;
  const [sel, setSel] = useState<Selection>(() => parseHash(window.location.hash));
  const [mode, setMode] = useState<MapMode>("states");
  const [hover, setHover] = useState<Hover | null>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const onHash = () => setSel(parseHash(window.location.hash));
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  // Escape steps back out: district -> state -> overview.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setSel((s) => {
        if (!s.state) return s;
        const next = s.district ? { ...s, district: null } : { ...s, state: null };
        window.location.hash = toHash(next);
        return next;
      });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // A tab left open should notice when the hourly data run has stalled.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const select = useCallback((next: Selection, scroll = true) => {
    setSel(next);
    const hash = toHash(next);
    if (window.location.hash.slice(1) !== hash) window.location.hash = hash;
    if (scroll && window.matchMedia("(max-width: 959px)").matches) {
      requestAnimationFrame(() => panelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    }
  }, []);

  const chambers = useMemo(
    () => ({ S: chamber(results, "S"), H: chamber(results, "H"), G: chamber(results, "G") }),
    [results],
  );

  const popularVote = useMemo(() => housePopularVote(results), [results]);
  const officeRaces = useMemo(() => results.races.filter((r) => r.office === sel.office), [results, sel.office]);
  const racesByState = useMemo(
    () => new Map(officeRaces.filter((r) => r.office !== "H").map((r) => [r.state, r])),
    [officeRaces],
  );
  const racesByDistrict = useMemo(
    () => new Map(results.races.filter((r) => r.office === "H").map((r) => [r.district as string, r])),
    [results],
  );
  const officeCounties = sel.office === "S" ? counties.S : sel.office === "G" ? counties.G : null;

  const hasIndependent = useMemo(() => {
    if (sel.office === "H" || mode === "states") return officeRaces.some((r) => (r.winner ?? r.leader) === "I");
    return [...racesByState.values()].some((race) => {
      const cols = countyColumns(race);
      return Object.values(officeCounties?.[String(race.id)] ?? {}).some((row) => {
        const reading = readCounty(row);
        return reading ? cols[reading.leaderIndex]?.party === "I" : false;
      });
    });
  }, [sel.office, mode, officeRaces, racesByState, officeCounties]);

  const onHover = useCallback<HoverHandler>((target, at) => {
    // Touch taps select instead; a tooltip left behind by a tap would never get its pointerleave.
    if (!target || !at || at.pointerType === "touch" || !frameRef.current) return setHover(null);
    const rect = frameRef.current.getBoundingClientRect();
    setHover({ target, x: at.clientX - rect.left, y: at.clientY - rect.top });
  }, []);

  const hoverRace: Race | undefined = hover
    ? hover.target.kind === "district"
      ? racesByDistrict.get(hover.target.district)
      : racesByState.get(hover.target.state)
    : undefined;

  const onStateSelect = useCallback((state: string) => select({ office: sel.office, state, district: null }), [select, sel.office]);
  const onStateClear = useCallback(() => select({ office: sel.office, state: null, district: null }, false), [select, sel.office]);
  const onHexSelect = useCallback((state: string, district: string | null) => select({ office: "H", state, district }), [select]);
  const jumpStates = useMemo(() => [...new Set(officeRaces.map((r) => r.state))].sort((a, b) => stateName(a).localeCompare(stateName(b))), [officeRaces]);

  const selectedRace = sel.district ? racesByDistrict.get(sel.district) : sel.state ? racesByState.get(sel.state) : undefined;
  const announce = selectedRace
    ? raceTitle(selectedRace)
    : sel.state
      ? `${stateName(sel.state)} ${sel.office === "H" ? "House districts" : "has no race this year"}`
      : `${OFFICE_NAME[sel.office]} overview`;

  const raceNoun = `${racesByState.size} ${sel.office === "S" ? "Senate" : "governor"} races`;
  const mapCaption =
    sel.office === "H"
      ? "Each hexagon is one House district, placed near where its voters live"
      : mode === "states"
        ? `${OFFICE_NAME[sel.office]} results by state`
        : mode === "counties"
          ? `County results in the ${raceNoun}`
          : `Where votes are still being counted in the ${raceNoun}`;
  const c = chambers[sel.office];
  const tally = `Democrats have won ${c.won.D}, Republicans ${c.won.R}${c.won.I ? `, independents ${c.won.I}` : ""}; ${c.uncalled.length} not called.`;
  const mapDescription = `${mapCaption}. ${tally}`;
  const hasNoVotes = officeRaces.some(noVotesYet);

  return (
    <div className={refreshing ? "app is-refreshing" : "app"} aria-busy={refreshing}>
      <a className="skip" href="#board">
        Skip to the results
      </a>
      <header className="masthead">
        <span className="wordmark">Wausau Pilot &amp; Review</span>
        <span className="masthead__section">Midterm results</span>
        <span className="masthead__meta">
          Updated <time dateTime={results.updated}>{centralTime(results.updated)}</time>
          {relativeAge(results.updated, now) && <span className="masthead__ago"> · {relativeAge(results.updated, now)}</span>}
        </span>
      </header>

      {error ? (
        <p className="stale stale--error" role="alert">
          The results could not be refreshed ({error}). Showing the results fetched {centralTime(results.fetched)}.
        </p>
      ) : (
        isStale(results.fetched, now) && (
          <p className="stale" role="status">
            These results may be out of date. They were last fetched {centralTime(results.fetched)} and are normally refreshed every hour.
          </p>
        )
      )}

      <main>
      <section className="hero">
        <h1>{headline(chambers.H, chambers.S)}</h1>
        <p className="hero__dek">{dek(chambers.H, chambers.S, chambers.G)}</p>
      </section>

      <ChamberTabs chambers={chambers} office={sel.office} onChange={(office) => select({ office, state: sel.state, district: null }, false)} />

      <section className="board" id="board">
        <div className="board__map">
          <div className="map-toolbar">
            <p className="map-caption">{mapCaption}</p>
            <div className="map-controls">
            <button
              type="button"
              className="home-chip"
              aria-pressed={sel.state === HOME_STATE && !sel.district}
              onClick={() => select({ office: sel.office, state: HOME_STATE, district: null })}
            >
              {stateName(HOME_STATE)}
            </button>
            <label className="state-jump">
              <span className="visually-hidden">Jump to a state</span>
              <select value={sel.state ?? ""} onChange={(e) => select({ office: sel.office, state: e.target.value || null, district: null })}>
                <option value="">{sel.state ? "All states" : "Jump to a state"}</option>
                {jumpStates.map((st) => (
                  <option key={st} value={st}>
                    {stateName(st)}
                  </option>
                ))}
              </select>
            </label>
            {sel.office !== "H" && (
              <div className="segmented" role="radiogroup" aria-label="Map detail">
                {([["states", "States"], ["counties", "Counties"], ["remaining", "Still counting"]] as const).map(([m, label]) => (
                  <button key={m} type="button" role="radio" aria-checked={mode === m} className={mode === m ? "is-on" : undefined} onClick={() => setMode(m)}>
                    {label}
                  </button>
                ))}
              </div>
            )}
            <CopyLink hash={toHash(sel)} />
            </div>
          </div>
          <div className="map-frame" ref={frameRef} onPointerLeave={() => setHover(null)}>
            {sel.office === "H" ? (
              <HexMap
                hexes={hexes}
                racesByDistrict={racesByDistrict}
                selectedState={sel.state}
                selectedDistrict={sel.district}
                description={mapDescription}
                onHover={onHover}
                onSelect={onHexSelect}
              />
            ) : geo ? (
              <NationalMap
                geo={geo}
                mode={mode}
                description={mapDescription}
                racesByState={racesByState}
                counties={officeCounties ?? {}}
                selected={sel.state}
                onHover={onHover}
                onSelect={onStateSelect}
                onClear={onStateClear}
              />
            ) : (
              <MapPending error={geoError} />
            )}
            {hover && frameRef.current && (
              <Tooltip
                target={hover.target}
                race={hoverRace}
                counties={officeCounties}
                x={hover.x}
                y={hover.y}
                bounds={{ width: frameRef.current.clientWidth, height: frameRef.current.clientHeight }}
              />
            )}
          </div>
          <Legend office={sel.office} mode={mode} hasIndependent={hasIndependent} hasRunoff={c.runoffs.length > 0} hasNoVotes={hasNoVotes} />
        </div>
        <p className="visually-hidden" role="status">
          Showing {announce}
        </p>
        <aside className="board__panel" ref={panelRef}>
          <SidePanel
            office={sel.office}
            state={sel.state}
            district={sel.district}
            races={results.races}
            chamber={chambers[sel.office]}
            popularVote={popularVote}
            counties={counties}
            geo={geo}
            now={now}
            onSelect={(office, state, district) => select({ office, state, district })}
          />
        </aside>
      </section>

      <RaceTable
        office={sel.office}
        races={results.races}
        onSelect={(r) => select({ office: r.office, state: r.state, district: r.office === "H" ? r.district : null })}
      />

      </main>

      <footer className="sources">
        <p>
          Results and race calls from <a href="https://civicapi.org">civicAPI</a>, which may call races at different times than
          the Associated Press and other decision desks. Results are unofficial until states certify them.
        </p>
        <p>
          “Before” counts are the parties’ seats going into Election Day; for the House, the 2024 election result. Independents
          Angus King and Bernie Sanders are counted with the Senate Democrats they caucus with. Where both finalists are from the
          same party, the seat counts for that party before a winner is called. Louisiana House races without a majority go to a
          Dec. 12 runoff. On the House map, district positions within each state are approximate. Map boundaries from the U.S.
          Census Bureau via us-atlas. Candidate photos are official congressional portraits or come from Wikimedia Commons
          contributors (<a href="./credits.html">photo credits</a>).
        </p>
      </footer>
    </div>
  );
}
