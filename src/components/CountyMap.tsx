import { useMemo, useState } from "react";
import { MARGIN_BINS, MARGIN_RAMP, NO_RESULTS, marginColor } from "../lib/colors";
import { countyColumns, readCounty } from "../lib/data";
import { pct } from "../lib/format";
import { stateShape, type Geo } from "../lib/geo";
import type { CountyResults, Party, Race } from "../lib/types";

/** A single state's counties, shaded by the county winner's margin. */
export function CountyMap({ race, counties, geo }: { race: Race; counties: CountyResults; geo: Geo }) {
  const [hover, setHover] = useState<string | null>(null);
  const rows = counties[String(race.id)];
  if (!rows) throw new Error(`no county results for race ${race.id}`);
  const cols = countyColumns(race);
  const shapes = geo.countiesByState.get(race.state) ?? [];
  const state = stateShape(geo, race.state);

  const view = useMemo(() => {
    const [[x0, y0], [x1, y1]] = state.bounds;
    const pad = Math.max(x1 - x0, y1 - y0) * 0.03;
    return `${x0 - pad} ${y0 - pad} ${x1 - x0 + 2 * pad} ${y1 - y0 + 2 * pad}`;
  }, [state]);
  const strokeScale = useMemo(() => {
    const [[x0, y0], [x1, y1]] = state.bounds;
    return Math.max(x1 - x0, y1 - y0) / 300;
  }, [state]);

  const parties = [...new Set(cols.map((c) => c.party))] as Party[];
  const hovered = hover ? shapes.find((s) => s.id === hover) : undefined;
  const reading = hover && rows[hover] ? readCounty(rows[hover]) : null;

  return (
    <figure className="county-map">
      <svg viewBox={view} style={{ ["--stroke" as string]: `${strokeScale * 0.6}px` }} aria-label={`County results map for ${race.state}`}>
        {shapes.map((s) => {
          const row = rows[s.id];
          const r = row ? readCounty(row) : null;
          const col = r ? cols[r.leaderIndex] : undefined;
          return (
            <path
              key={s.id}
              d={s.d}
              fill={r && col ? marginColor(col.party, r.margin) : NO_RESULTS}
              className={hover === s.id ? "is-hover" : undefined}
              onPointerEnter={() => setHover(s.id)}
              onPointerLeave={() => setHover(null)}
            />
          );
        })}
        <path className="county-map__outline" d={state.d} style={{ strokeWidth: strokeScale * 1.4 }} />
      </svg>
      <figcaption>
        <div className="county-readout" aria-live="polite">
          {hovered && reading ? (
            <>
              <strong>{hovered.name}</strong>{" "}
              {cols
                .map((c, i) => ({ c, share: reading.shares[i] ?? 0 }))
                .sort((a, b) => b.share - a.share)
                .slice(0, 2)
                .map(({ c, share }) => `${c.name.split(" ").slice(-1)[0]} ${pct(share)}`)
                .join(", ")}
              <span className="muted"> ({Math.round(reading.pctIn)}% in)</span>
            </>
          ) : (
            <span className="muted">Point at a county for its result</span>
          )}
        </div>
        <MarginLegend parties={parties} />
      </figcaption>
    </figure>
  );
}

export function MarginLegend({ parties }: { parties: Party[] }) {
  const labels = ["<5", ...MARGIN_BINS.map(String)];
  return (
    <div className="margin-legend">
      <div className="margin-legend__title">County margin, points</div>
      {parties.map((p) => (
        <div className="margin-legend__row" key={p}>
          <span className="margin-legend__party">{p === "D" ? "Dem." : p === "R" ? "Rep." : "Ind./other"}</span>
          {MARGIN_RAMP[p].map((c, i) => (
            <span key={c} className="margin-legend__step" style={{ background: c }} title={`${labels[i]}${i === 4 ? "+" : ""}`} />
          ))}
        </div>
      ))}
      <div className="margin-legend__ticks" aria-hidden="true">
        <span />
        {MARGIN_BINS.map((b) => (
          <span key={b}>{b}</span>
        ))}
      </div>
    </div>
  );
}
