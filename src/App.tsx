import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Analysis } from "./components/Analysis";
import { ChamberTabs } from "./components/ChamberTabs";
import { CopyLink } from "./components/CopyLink";
import { HexMap } from "./components/HexMap";
import { FooterSeal, Masthead } from "./components/Masthead";
import { DemoRibbon, TitleSlot } from "./components/Sponsor";
import { SALES_EMAIL } from "./sponsors";
import { Legend } from "./components/Legend";
import { NationalMap, type MapMode, type ShiftStyle } from "./components/NationalMap";
import { Takeaways } from "./components/Takeaways";
import { takeaways } from "./lib/takeaways";
import { PartyWords } from "./components/PartyWords";
import { RaceTable } from "./components/RaceTable";
import { Replay } from "./components/Replay";
import { SinceVisit } from "./components/SinceVisit";
import { SidePanel } from "./components/SidePanel";
import { Tooltip, type HoverHandler, type HoverTarget, type MeasureSummary } from "./components/Tooltip";
import { afterPaint, countyColumns, loadAtlas, loadBaseline, loadDemographics, loadHistory, readCounty, type Data } from "./lib/data";
import type { Baseline } from "./lib/shift";
import type { Demographics } from "./lib/patterns";
import type { History } from "./lib/history";
import { centralTime, relativeAge } from "./lib/format";
import type { Geo } from "./lib/geo";
import { useLive } from "./lib/live";
import { callOrder, resultsAfter } from "./lib/replay";
import { parseHash, toHash } from "./lib/route";
import { readVisit, writeVisit } from "./lib/visits";
import { isStale } from "./lib/share";
import { isFresh, noVotesYet, type LegendKey } from "./lib/status";
import { HOME_STATE, stateName } from "./lib/states";
import { chamber, dek, headline, housePopularVote, OFFICE_NAME, raceTitle } from "./lib/summary";
import type { Race, Selection } from "./lib/types";

interface Hover {
  target: HoverTarget;
  x: number;
  y: number;
}

/** Holds the map's space while the shapes or county results load, so nothing below it moves. */
function MapPending({ error, what }: { error: string | null; what: "map" | "county results" }) {
  return (
    <div className="map-pending" role={error ? "alert" : "status"}>
      {error ? `The ${what} could not be loaded. ${error}` : `Loading the ${what}…`}
    </div>
  );
}

export function App({ data }: { data: Data }) {
  const { hexes } = data;
  const live = useLive(data.results);
  const { counties, refreshing, error } = live;
  // Replay: position i shows the results after the first i timestamped calls; the clock follows it.
  const calls = useMemo(() => callOrder(live.results), [live.results]);
  const unstamped = useMemo(() => live.results.races.filter((r) => r.winner !== null && r.calledAt === null).length, [live.results]);
  const [replay, setReplay] = useState<number | null>(null);
  const results = useMemo(() => (replay === null ? live.results : resultsAfter(live.results, replay, calls)), [live.results, replay, calls]);
  // What this browser had seen called last time, read before the first write below replaces it.
  const [visit] = useState(readVisit);
  useEffect(() => writeVisit(live.results, Date.now()), [live.results]);
  // The map shapes are the largest file. Fetching them from an effect, after the first paint,
  // keeps the headline, tabs, panel and table from ever waiting on them; the maps fill in after.
  const [geo, setGeo] = useState<Geo | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    afterPaint().then(loadAtlas).then(
      (g) => !cancelled && setGeo(g),
      (err: Error) => !cancelled && setGeoError(err.message),
    );
    return () => {
      cancelled = true;
    };
  }, []);
  const [sel, setSel] = useState<Selection>(() => parseHash(window.location.hash));
  const [mode, setMode] = useState<MapMode>("states");
  const [shiftStyle, setShiftStyle] = useState<ShiftStyle>("arrows");
  const [spotlight, setSpotlight] = useState<LegendKey | null>(null);
  useEffect(() => setSpotlight(null), [sel.office, mode]); // a new map, a fresh key
  useEffect(() => {
    if (mode !== "states") setReplay(null); // county views have no history to replay
  }, [mode]);
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

  // County demographics and the 2024 presidential vote: static, fetched once after first paint. The "how counties
  // voted" block, the shift map mode, the race-card and tooltip lines and the table column wait on them.
  const [demographics, setDemographics] = useState<Demographics | null>(null);
  const [baseline, setBaseline] = useState<Baseline | null>(null);
  useEffect(() => {
    let cancelled = false;
    afterPaint().then(() => {
      loadDemographics().then((d) => !cancelled && setDemographics(d));
      loadBaseline().then((b) => !cancelled && setBaseline(b));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // The count history rides behind the results: fetched after first paint, again after each refresh.
  const [history, setHistory] = useState<History>({});
  useEffect(() => {
    let cancelled = false;
    afterPaint().then(loadHistory).then((h) => !cancelled && setHistory(h), () => undefined);
    return () => {
      cancelled = true;
    };
  }, [results.fetched]);

  // A tab left open should notice when the hourly data run has stalled.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  // The board's clock: the replay position's call time while replaying, else the present.
  const clock =
    replay === null || replay >= calls.length
      ? now
      : replay === 0
        ? Date.parse((calls[0] as Race).calledAt as string) - 1
        : Date.parse((calls[replay - 1] as Race).calledAt as string);

  const select = useCallback((next: Selection, scroll = true) => {
    setSel(next);
    const hash = toHash(next);
    if (window.location.hash.slice(1) !== hash) window.location.hash = hash;
    if (scroll && window.matchMedia("(max-width: 959px)").matches) {
      requestAnimationFrame(() => panelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    }
  }, []);

  const selectRace = useCallback((r: Race) => select({ office: r.office, state: r.state, district: r.office === "H" || r.office === "B" ? r.district : null }), [select]);

  const chambers = useMemo(
    () => ({ S: chamber(results, "S"), H: chamber(results, "H"), G: chamber(results, "G"), B: chamber(results, "B") }),
    [results],
  );
  const toKnow = useMemo(() => takeaways(results, chambers, baseline), [results, chambers, baseline]);

  const popularVote = useMemo(() => housePopularVote(results), [results]);
  const officeRaces = useMemo(() => results.races.filter((r) => r.office === sel.office), [results, sel.office]);
  const racesByState = useMemo(
    () => new Map(officeRaces.filter((r) => r.office !== "H" && r.office !== "B").map((r) => [r.state, r])),
    [officeRaces],
  );
  const racesByDistrict = useMemo(
    () => new Map(results.races.filter((r) => r.office === "H" || r.office === "B").map((r) => [r.district as string, r])),
    [results],
  );
  const measuresByState = useMemo(() => {
    const m = new Map<string, Race[]>();
    for (const r of results.races) if (r.office === "B") m.set(r.state, [...(m.get(r.state) ?? []), r]);
    return m;
  }, [results]);
  const measureCounts = useMemo(() => new Map([...measuresByState].map(([st, list]) => [st, list.length])), [measuresByState]);
  const officeCounties = counties ? (sel.office === "S" ? counties.S : sel.office === "G" ? counties.G : null) : null;

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
  const hoverMeasures: MeasureSummary | undefined =
    hover && sel.office === "B" && hover.target.kind === "state" && measuresByState.has(hover.target.state)
      ? (() => {
          const list = measuresByState.get(hover.target.state) as Race[];
          return { total: list.length, passed: list.filter((r) => r.winner === "Y").length, failed: list.filter((r) => r.winner === "N").length };
        })()
      : undefined;

  const onStateSelect = useCallback((state: string) => select({ office: sel.office, state, district: null }), [select, sel.office]);
  const onStateClear = useCallback(() => select({ office: sel.office, state: null, district: null }, false), [select, sel.office]);
  const onHexSelect = useCallback((state: string, district: string | null) => select({ office: "H", state, district }), [select]);
  const jumpStates = useMemo(() => [...new Set(officeRaces.map((r) => r.state))].sort((a, b) => stateName(a).localeCompare(stateName(b))), [officeRaces]);

  const selectedRace = sel.district ? racesByDistrict.get(sel.district) : sel.state ? racesByState.get(sel.state) : undefined;
  const announce = selectedRace
    ? raceTitle(selectedRace)
    : sel.state
      ? `${stateName(sel.state)} ${sel.office === "H" ? "House districts" : sel.office === "B" ? "ballot measures" : "has no race this year"}`
      : `${OFFICE_NAME[sel.office]} overview`;

  const raceNoun = `${racesByState.size} ${sel.office === "S" ? "Senate" : "governor"} races`;
  const mapCaption =
    sel.office === "H"
      ? "One hexagon per House district, placed near where its voters live"
      : sel.office === "B"
        ? `Statewide ballot measures in ${measureCounts.size} states; darker means more`
        : mode === "states"
        ? `${OFFICE_NAME[sel.office]} results by state`
        : mode === "counties"
          ? `County results in the ${raceNoun}`
          : mode === "shift"
            ? `How each county moved since the 2024 presidential vote in the ${raceNoun}`
            : `Where votes are still being counted in the ${raceNoun}`;
  const c = chambers[sel.office];
  const tally =
    sel.office === "B"
      ? `${c.won.Y} passed, ${c.won.N} failed; ${c.uncalled.length} not called.`
      : `Democrats have won ${c.won.D}, Republicans ${c.won.R}${c.won.I ? `, independents ${c.won.I}` : ""}; ${c.uncalled.length} not called.`;
  const mapDescription = `${mapCaption}. ${tally}`;
  const hasNoVotes = officeRaces.some(noVotesYet);
  const hasFresh = officeRaces.some((r) => isFresh(r, clock));
  const needsCounties = sel.office !== "H" && sel.office !== "B" && mode !== "states";

  // The browser tab names the view, so history, bookmarks and shared tabs read as the race.
  useEffect(() => {
    const base = "2026 Midterm Election Results — Wausau Pilot & Review";
    document.title = sel.state ? `${announce} · ${base}` : base;
  }, [announce, sel.state]);

  return (
    <div className={refreshing ? "app is-refreshing" : "app"} aria-busy={refreshing}>
      <a className="skip" href="#board">
        Skip to the results
      </a>
      <DemoRibbon />
      <Masthead now={now} />

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
        <p className="kicker">
          <span className="kicker__section">2026 midterm election results</span>
          <span className="kicker__updated">
            Updated <time dateTime={results.updated}>{centralTime(results.updated)}</time>
            {relativeAge(results.updated, now) && <span className="kicker__ago"> · {relativeAge(results.updated, now)}</span>}
          </span>
        </p>
        <h1>
          <PartyWords text={headline(chambers.H, chambers.S)} />
        </h1>
        <p className="hero__dek">{dek(chambers.H, chambers.S, chambers.G, chambers.B)}</p>
        <TitleSlot />
      </section>

      <ChamberTabs chambers={chambers} office={sel.office} baseline={baseline} now={clock} onChange={(office) => select({ office, state: sel.state, district: null }, false)} onSelectRace={selectRace} />
      <Takeaways items={toKnow} onSelect={select} />
      {visit && replay === null && (
        <SinceVisit
          visit={visit}
          results={live.results}
          now={now}
          onSelect={selectRace}
        />
      )}

      <section className="board" id="board">
        <div className="board__map">
          <div className="map-toolbar">
            <p className="map-caption">
              {mapCaption}
              {sel.office === "H" && <span className="touch-hint">. Tap a state for its districts</span>}
            </p>
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
            {sel.office !== "H" && sel.office !== "B" && (
              <div className="segmented" role="radiogroup" aria-label="Map detail">
                {/* the short label shows under 700px, where the four full names wrapped to two lines each */}
                {([["states", "States", "States"], ["counties", "Counties", "Counties"], ["remaining", "Still counting", "Counting"], ...(baseline ? [["shift", "Shift since 2024", "vs. 2024"]] : [])] as [MapMode, string, string][]).map(([m, label, short]) => (
                  <button key={m} type="button" role="radio" aria-checked={mode === m} className={mode === m ? "is-on" : undefined} onClick={() => setMode(m)}>
                    <span className="seg-long">{label}</span>
                    <span className="seg-short">{short}</span>
                  </button>
                ))}
              </div>
            )}
            <CopyLink hash={toHash(sel)} />
            </div>
          </div>
          {(sel.office === "H" || sel.office === "B" || mode === "states") && <Replay calls={calls} unstamped={unstamped} at={replay} onChange={setReplay} />}
          <div className={replay === null ? "map-frame" : "map-frame is-replay"} ref={frameRef} onPointerLeave={() => setHover(null)}>
            {sel.office === "H" ? (
              <HexMap
                hexes={hexes}
                racesByDistrict={racesByDistrict}
                selectedState={sel.state}
                selectedDistrict={sel.district}
                spotlight={spotlight}
                now={clock}
                description={mapDescription}
                onHover={onHover}
                onSelect={onHexSelect}
              />
            ) : geo && (counties || !needsCounties) ? (
              <NationalMap
                geo={geo}
                mode={sel.office === "B" ? "measures" : mode}
                description={mapDescription}
                racesByState={racesByState}
                measureCounts={measureCounts}
                spotlight={spotlight}
                now={clock}
                counties={officeCounties ?? {}}
                selected={sel.state}
                baseline={baseline}
                shiftStyle={shiftStyle}
                onHover={onHover}
                onSelect={onStateSelect}
                onClear={onStateClear}
              />
            ) : (
              <MapPending error={geoError ?? (needsCounties && !counties ? error : null)} what={needsCounties && geo ? "county results" : "map"} />
            )}
            {hover && frameRef.current && (
              <Tooltip
                target={hover.target}
                race={hoverRace}
                measures={hoverMeasures}
                baseline={baseline}
                counties={officeCounties}
                now={clock}
                x={hover.x}
                y={hover.y}
                bounds={{ width: frameRef.current.clientWidth, height: frameRef.current.clientHeight }}
              />
            )}
          </div>
          <Legend
            office={sel.office}
            mode={sel.office === "B" ? "measures" : mode}
            hasIndependent={hasIndependent}
            hasRunoff={c.runoffs.length > 0}
            hasNoVotes={hasNoVotes}
            hasFresh={hasFresh}
            spotlight={spotlight}
            onSpotlight={setSpotlight}
            shiftStyle={shiftStyle}
            onShiftStyle={setShiftStyle}
          />
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
            history={history}
            demographics={demographics}
            baseline={baseline}
            now={clock}
            onSelect={(office, state, district) => select({ office, state, district })}
          />
        </aside>
      </section>

      <Analysis
        office={sel.office}
        state={sel.state}
        district={sel.district}
        races={results.races}
        counties={counties}
        demographics={demographics}
        baseline={baseline}
        geo={geo}
        onSelect={selectRace}
      />

      <RaceTable
        office={sel.office}
        races={results.races}
        history={history}
        baseline={baseline}
        now={clock}
        onSelect={selectRace}
      />

      </main>

      <footer className="sources">
        <FooterSeal />
        <div className="sources__text">
        <p>
          Results and race calls from <a href="https://civicapi.org">civicAPI</a>, refreshed hourly, which may call races at
          different times than the Associated Press and other decision desks. Results are unofficial until states certify them.
          Not affiliated with or endorsed by civicAPI, the Associated Press or any election authority.
        </p>
        <p>
          “Before” counts are the parties’ seats going into Election Day; for the House, the 2024 election result. Independents
          Angus King and Bernie Sanders are counted with the Senate Democrats they caucus with. Where both finalists are from the
          same party, the seat counts for that party before a winner is called. Louisiana House races without a majority go to a
          Dec. 12 runoff. On the House map, district positions within each state are approximate. Map boundaries from the U.S.
          Census Bureau via us-atlas. County demographics are U.S. Census Bureau estimates from the 2017–2021 American
          Community Survey. The 2024 presidential vote, for every “since 2024” comparison, is from the MIT Election Data and
          Science Lab’s county presidential returns (CC0); Alaska and Connecticut carry state totals only. Candidate photos are official congressional portraits or come from Wikimedia Commons
          contributors (<a href="./credits.html">photo credits</a>).
        </p>
        <p className="sources__paper">
          <a href="https://wausaupilotandreview.com/">Wausau Pilot &amp; Review</a> · 715-301-5539 ·{" "}
          <a href={`mailto:${SALES_EMAIL}?subject=${encodeURIComponent("Sponsorship: 2026 midterm results")}`}>Advertise on this page</a>
        </p>
        </div>
      </footer>
    </div>
  );
}
