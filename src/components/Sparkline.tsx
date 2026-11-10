import { PARTY, PARTY_LABEL } from "../lib/colors";
import { marginWords, reportingShare, signedMargin } from "../lib/format";
import { readings, side, spanText, type HistoryPoint } from "../lib/history";
import type { Race } from "../lib/types";

const W = 240, H = 44, PAD = 4;

/** How a race's margin has moved across the data runs: a line above zero is the current leader ahead. */
export function Sparkline({ race, points }: { race: Race; points: HistoryPoint[] }) {
  const current = side(race);
  const series = readings(points, current);
  const first = series[0], last = series[series.length - 1];
  if (!first || !last || series.length < 2) return null;
  const t0 = first.t, t1 = last.t;
  const peak = Math.max(0.5, ...series.map((r) => Math.abs(r.margin)));
  const x = (t: number) => PAD + ((W - 2 * PAD) * (t - t0)) / Math.max(1, t1 - t0);
  const y = (m: number) => H / 2 - ((H / 2 - PAD) * m) / peak;
  const d = series.map((r, i) => `${i ? "L" : "M"}${x(r.t).toFixed(1)},${y(r.margin).toFixed(1)}`).join("");
  const color = PARTY[current];
  const s0 = reportingShare(first.pctIn, race.total), s1 = reportingShare(last.pctIn, race.total);
  const label = `${PARTY_LABEL[current]} ${last.margin >= 0 ? "ahead" : "behind"} by ${marginWords(Math.abs(last.margin))} points, from ${first.margin >= 0 ? "ahead" : "behind"} by ${marginWords(Math.abs(first.margin))} over ${spanText(points)}${s0 && s1 ? `; reporting ${s0} to ${s1}` : ""}`;
  return (
    <figure className="spark">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>
        <line className="spark__zero" x1={PAD} x2={W - PAD} y1={H / 2} y2={H / 2} />
        <path className="spark__line" d={d} stroke={color} />
        <circle className="spark__end" cx={x(last.t)} cy={y(last.margin)} r={3} fill={color} />
      </svg>
      <figcaption>
        Margin over {spanText(points)}: {signedMargin(first.margin)} → <strong>{signedMargin(last.margin)}</strong>
        {s0 && s1 && <span className="muted"> · {s0} → {s1} reporting</span>}
      </figcaption>
    </figure>
  );
}
