import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChamberTabs } from "./components/ChamberTabs";
import { HexMap } from "./components/HexMap";
import { Legend } from "./components/Legend";
import { NationalMap, type MapMode } from "./components/NationalMap";
import { RaceTable } from "./components/RaceTable";
import { SidePanel } from "./components/SidePanel";
import { Tooltip, type HoverTarget } from "./components/Tooltip";
import { countyColumns, readCounty, type Data } from "./lib/data";
import { centralTime } from "./lib/format";
import { stateName } from "./lib/states";
import { chamber, dek, headline, housePopularVote, OFFICE_NAME, OFFICE_SLUG } from "./lib/summary";
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

export function App({ data }: { data: Data }) {
  const { results, counties, hexes, geo } = data;
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

  const onHover = useCallback((target: HoverTarget | null, e?: React.PointerEvent) => {
    // Touch taps select instead; a tooltip left behind by a tap would never get its pointerleave.
    if (!target || !e || e.pointerType === "touch" || !frameRef.current) return setHover(null);
    const rect = frameRef.current.getBoundingClientRect();
    setHover({ target, x: e.clientX - rect.left, y: e.clientY - rect.top });
  }, []);

  const hoverRace: Race | undefined = hover
    ? hover.target.kind === "district"
      ? racesByDistrict.get(hover.target.district)
      : racesByState.get(hover.target.state)
    : undefined;

  const onStateSelect = useCallback((state: string) => select({ office: sel.office, state, district: null }), [select, sel.office]);
  const onHexSelect = useCallback((state: string, district: string | null) => select({ office: "H", state, district }), [select]);
  const jumpStates = useMemo(() => [...new Set(officeRaces.map((r) => r.state))].sort((a, b) => stateName(a).localeCompare(stateName(b))), [officeRaces]);

  const mapCaption =
    sel.office === "H"
      ? "Each hexagon is one House district, placed near where its voters live"
      : mode === "states"
        ? `${OFFICE_NAME[sel.office]} results by state`
        : `County results in the ${racesByState.size} ${sel.office === "S" ? "Senate" : "governor"} races`;

  return (
    <div className="app">
      <header className="masthead">
        <span className="wordmark">Wausau Pilot &amp; Review</span>
        <span className="masthead__section">Midterm results</span>
        <span className="masthead__meta">
          Updated <time dateTime={results.updated}>{centralTime(results.updated)}</time>
        </span>
      </header>

      <section className="hero">
        <h1>{headline(chambers.H, chambers.S)}</h1>
        <p className="hero__dek">{dek(chambers.H, chambers.S, chambers.G)}</p>
      </section>

      <ChamberTabs chambers={chambers} office={sel.office} onChange={(office) => select({ office, state: sel.state, district: null }, false)} />

      <section className="board">
        <div className="board__map">
          <div className="map-toolbar">
            <p className="map-caption">{mapCaption}</p>
            <div className="map-controls">
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
                {(["states", "counties"] as const).map((m) => (
                  <button key={m} type="button" role="radio" aria-checked={mode === m} className={mode === m ? "is-on" : undefined} onClick={() => setMode(m)}>
                    {m === "states" ? "States" : "Counties"}
                  </button>
                ))}
              </div>
            )}
            </div>
          </div>
          <div className="map-frame" ref={frameRef} onPointerLeave={() => setHover(null)}>
            {sel.office === "H" ? (
              <HexMap
                hexes={hexes}
                racesByDistrict={racesByDistrict}
                selectedState={sel.state}
                selectedDistrict={sel.district}
                onHover={onHover}
                onSelect={onHexSelect}
              />
            ) : (
              <NationalMap
                geo={geo}
                mode={mode}
                racesByState={racesByState}
                counties={officeCounties ?? {}}
                selected={sel.state}
                onHover={onHover}
                onSelect={onStateSelect}
              />
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
          <Legend office={sel.office} mode={mode} hasIndependent={hasIndependent} hasRunoff={chambers[sel.office].runoffs.length > 0} />
        </div>
        <aside className="board__panel" ref={panelRef} aria-live="polite">
          <SidePanel
            office={sel.office}
            state={sel.state}
            district={sel.district}
            races={results.races}
            chamber={chambers[sel.office]}
            popularVote={popularVote}
            counties={counties}
            geo={geo}
            onSelect={(office, state, district) => select({ office, state, district })}
          />
        </aside>
      </section>

      <RaceTable
        office={sel.office}
        races={results.races}
        onSelect={(r) => select({ office: r.office, state: r.state, district: r.office === "H" ? r.district : null })}
      />

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
          Census Bureau via us-atlas.
        </p>
      </footer>
    </div>
  );
}
