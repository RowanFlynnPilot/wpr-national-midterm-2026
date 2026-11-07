import { memo, useMemo } from "react";
import { arcRows, arcSeats } from "../lib/arc";
import { PALE, PARTY } from "../lib/colors";
import { RUNOFF } from "../lib/status";
import { seatLabel, secured, type Chamber } from "../lib/summary";

const W = 200;
const OUTER = 96;
const INNER = 40;
const H = OUTER + 6;

/** Every seat as a dot in a half circle: secured seats at the ends, leads pale, runoffs gray, the majority line as a tick. */
/** memo: the card's numbers re-render every frame while they run up; the dots only change with the data. */
export const SeatArc = memo(function SeatArc({ chamber: c }: { chamber: Chamber }) {
  const measures = c.office === "B";
  // Left to right: the order a parliament chart reads in.
  const blocks = (
    measures
      ? [
          { n: c.won.Y, color: PARTY.Y },
          { n: c.leading.Y, color: PALE.Y },
          { n: c.leading.N, color: PALE.N },
          { n: c.won.N, color: PARTY.N },
        ]
      : [
          { n: secured(c, "D"), color: PARTY.D },
          { n: c.leading.D, color: PALE.D },
          { n: secured(c, "I"), color: PARTY.I },
          { n: c.leading.I, color: PALE.I },
          { n: c.runoffs.length, color: RUNOFF },
          { n: c.leading.R, color: PALE.R },
          { n: secured(c, "R"), color: PARTY.R },
        ]
  ).filter((b) => b.n > 0);
  const fills = blocks.flatMap((b) => Array<string>(b.n).fill(b.color));
  const total = fills.length;
  const { seats, r } = useMemo(() => {
    const rows = arcRows(total, INNER, OUTER);
    const seats = arcSeats(total, rows, INNER, OUTER);
    const rowGap = (OUTER - INNER) / (rows - 1);
    const along = (Math.PI * (INNER + OUTER)) / 2 / (total / rows);
    return { seats, r: 0.4 * Math.min(rowGap, along) };
  }, [total]);
  const majorityAngle = c.majority > 0 ? Math.PI * (1 - c.majority / c.total) : null;
  return (
    <svg className="seat-arc" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={seatLabel(c)}>
      <g transform={`translate(${W / 2} ${H - 2})`}>
        {seats.map((s, i) => (
          <circle
            key={i}
            className="seat-arc__seat"
            cx={s.x}
            cy={s.y}
            r={r}
            fill={fills[i]}
            style={{ animationDelay: `${Math.min(i, total - 1 - i) * 3}ms` }}
          />
        ))}
        {majorityAngle !== null && (
          <line
            className="seat-arc__majority"
            x1={(INNER - 8) * Math.cos(majorityAngle)}
            y1={-(INNER - 8) * Math.sin(majorityAngle)}
            x2={(OUTER + 5) * Math.cos(majorityAngle)}
            y2={-(OUTER + 5) * Math.sin(majorityAngle)}
          />
        )}
      </g>
    </svg>
  );
});
