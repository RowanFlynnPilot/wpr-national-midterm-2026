import { memo, useMemo } from "react";
import { arcRows, arcSeats } from "../lib/arc";
import { chamberSeats, type Seat } from "../lib/seats";
import { seatLabel, type Chamber } from "../lib/summary";
import type { Race } from "../lib/types";
import type { HoverPoint } from "./Tooltip";

const W = 200;
const OUTER = 98;
const INNER = 34;
const H = OUTER + 8;

interface Props {
  chamber: Chamber;
  onHover?: (seat: Seat | null, at?: HoverPoint) => void; // without it the arc is a picture (the share card)
  onSelect?: (race: Race) => void;
}

/** Every seat as a dot in a half circle: secured seats at the ends, leads pale, runoffs gray, the majority line as a tick. */
/** memo: the card's numbers re-render every frame while they run up; the dots only change with the data. */
export const SeatArc = memo(function SeatArc({ chamber: c, onHover, onSelect }: Props) {
  const seats = useMemo(() => chamberSeats(c), [c]);
  const total = seats.length;
  const { pos, r } = useMemo(() => {
    const rows = arcRows(total, INNER, OUTER);
    const pos = arcSeats(total, rows, INNER, OUTER);
    const rowGap = (OUTER - INNER) / (rows - 1);
    const along = (Math.PI * (INNER + OUTER)) / 2 / (total / rows);
    return { pos, r: 0.4 * Math.min(rowGap, along) };
  }, [total]);
  const majorityAngle = c.majority > 0 ? Math.PI * (1 - c.majority / c.total) : null;
  const at = (e: React.PointerEvent): HoverPoint => ({ clientX: e.clientX, clientY: e.clientY, pointerType: e.pointerType });
  return (
    <svg className="seat-arc" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={seatLabel(c)}>
      <g transform={`translate(${W / 2} ${H - 2})`}>
        {pos.map((s, i) => {
          const seat = seats[i] as Seat;
          return (
            <circle
              key={i}
              className={seat.race ? "seat-arc__seat is-race" : "seat-arc__seat"}
              cx={s.x}
              cy={s.y}
              r={r}
              fill={seat.color}
              style={{ animationDelay: `${Math.min(i, total - 1 - i) * 3}ms` }}
              onPointerEnter={onHover && ((e) => onHover(seat, at(e)))}
              onPointerLeave={onHover && (() => onHover(null))}
              onClick={
                seat.race && onSelect
                  ? (e) => {
                      e.stopPropagation(); // the card around the arc selects the whole office
                      onSelect(seat.race as Race);
                    }
                  : undefined
              }
            />
          );
        })}
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
