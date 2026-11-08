import { useMemo } from "react";
import { reportingShare } from "../lib/format";
import { PARTY } from "../lib/colors";
import { readCounty } from "../lib/data";
import type { Geo } from "../lib/geo";
import type { Demographics } from "../lib/patterns";
import { countyShift, raceShift, type Baseline } from "../lib/shift";
import type { CountyResults, Race } from "../lib/types";

const W = 320;
const H = 230;
const PAD = { top: 10, right: 10, bottom: 30, left: 34 };
const X_MIN = Math.log10(0.5); // people per square mile
const X_MAX = Math.log10(50_000);
const X_TICKS = [1, 10, 100, 1000, 10_000];
const COUNTED = 90; // percent reporting under which a county's shift is drawn lighter

interface Props {
  races: Race[];
  counties: CountyResults;
  demographics: Demographics;
  baseline: Baseline;
  geo: Geo | null; // for county names in the hover text; FIPS until it loads
}

interface Dot {
  key: string;
  x: number;
  y: number;
  r: number;
  color: string;
  partial: boolean;
  title: string;
}

/** Every county of the given races as a dot: denser places to the right, a bigger move toward Democrats higher up. */
export function ShiftScatter({ races, counties, demographics, baseline, geo }: Props) {
  const dots = useMemo(() => {
    const names = new Map(geo ? geo.counties.map((c) => [c.id, c.name]) : []);
    const out: Dot[] = [];
    for (const race of races) {
      if (raceShift(race, baseline) === null) continue;
      const rows = counties[String(race.id)];
      if (!rows) throw new Error(`no county results for race ${race.id}`);
      for (const [fips, row] of Object.entries(rows)) {
        const s = countyShift(race, row, fips, baseline);
        const reading = readCounty(row);
        const density = demographics.counties[fips]?.[4];
        if (!s || !reading || density === undefined) continue;
        out.push({
          key: `${race.id}-${fips}`,
          x: Math.min(X_MAX, Math.max(X_MIN, Math.log10(Math.max(density, 0.5)))),
          y: s.shift,
          r: Math.sqrt(reading.total),
          color: s.shift >= 0 ? PARTY.D : PARTY.R,
          partial: reading.pctIn < COUNTED,
          title: `${names.get(fips) ?? fips}, ${race.state}: ${s.shift >= 0 ? "D" : "R"} +${Math.abs(s.shift).toFixed(1)} since 2024 · ${Math.round(density).toLocaleString("en-US")} per sq. mi. · ${reading.total.toLocaleString("en-US")} votes${reading.pctIn < COUNTED && reportingShare(reading.pctIn, reading.total) ? ` · ${reportingShare(reading.pctIn, reading.total)} counted` : ""}`,
        });
      }
    }
    return out;
  }, [races, counties, demographics, baseline, geo]);
  if (dots.length < 2) return null;

  const ys = dots.map((d) => d.y);
  const yMin = Math.min(-5, Math.floor(Math.min(...ys) / 10) * 10);
  const yMax = Math.max(5, Math.ceil(Math.max(...ys) / 10) * 10);
  const rMax = Math.max(...dots.map((d) => d.r));
  const px = (x: number) => PAD.left + ((x - X_MIN) / (X_MAX - X_MIN)) * (W - PAD.left - PAD.right);
  const py = (y: number) => PAD.top + ((yMax - y) / (yMax - yMin)) * (H - PAD.top - PAD.bottom);
  const yTicks: number[] = [];
  const step = yMax - yMin > 60 ? 20 : 10;
  for (let v = Math.ceil(yMin / step) * step; v <= yMax; v += step) yTicks.push(v);
  const label = (n: number) => (n >= 1000 ? `${n / 1000}k` : String(n));
  // biggest counties drawn first so small ones stay visible on top
  const ordered = [...dots].sort((a, b) => b.r - a.r);

  return (
    <figure className="scatter">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${dots.length} counties by density and their move since the 2024 presidential vote`}>
        {yTicks.map((v) => (
          <g key={v} className={v === 0 ? "scatter__grid scatter__grid--zero" : "scatter__grid"}>
            <line x1={PAD.left} x2={W - PAD.right} y1={py(v)} y2={py(v)} />
            <text x={PAD.left - 4} y={py(v)} dy="0.32em" textAnchor="end">
              {v > 0 ? `D +${v}` : v < 0 ? `R +${-v}` : "0"}
            </text>
          </g>
        ))}
        {X_TICKS.map((t) => (
          <g key={t} className="scatter__grid">
            <line x1={px(Math.log10(t))} x2={px(Math.log10(t))} y1={PAD.top} y2={H - PAD.bottom} />
            <text x={px(Math.log10(t))} y={H - PAD.bottom + 12} textAnchor="middle">
              {label(t)}
            </text>
          </g>
        ))}
        <text className="scatter__axis" x={W - PAD.right} y={H - 4} textAnchor="end">
          people per square mile →
        </text>
        {ordered.map((d) => (
          <circle
            key={d.key}
            cx={px(d.x)}
            cy={py(d.y)}
            r={1.4 + (d.r / rMax) * 9}
            fill={d.color}
            className={d.partial ? "scatter__dot is-partial" : "scatter__dot"}
          >
            <title>{d.title}</title>
          </circle>
        ))}
      </svg>
      <figcaption className="panel__note">
        Each dot is a county, sized by its vote: further right is denser, higher is a bigger move toward Democrats since the 2024
        presidential vote. Lighter dots are under {COUNTED}% counted.<span className="fine-hint"> Point at a dot for its county.</span>
      </figcaption>
    </figure>
  );
}
