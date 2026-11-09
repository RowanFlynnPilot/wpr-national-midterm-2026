import { memo, useMemo } from "react";
import { arcRows, arcSeats } from "../lib/arc";
import { chamberSeats, type Seat } from "../lib/seats";
import { seatLabel, type Chamber } from "../lib/summary";
import type { Race } from "../lib/types";
import type { HoverPoint } from "./Tooltip";

const OUTER = 98;
const INNER = 34;

interface Props {
  chamber: Chamber;
  onHover?: (seat: Seat | null, at?: HoverPoint) => void; // without it the arc is a picture (the share card)
  onSelect?: (race: Race, at: HoverPoint) => void;
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
  // The drawing reaches past the outer ring by a dot (and its hover stroke) or by the majority tick, whichever is farther;
  // the Senate's dots are 5 units and were cut at the sides and the bottom when the box stopped at the ring.
  const pad = Math.max(r, 5) + 1;
  const half = OUTER + pad;
  // A click is always a mouse or a pen here: under a coarse pointer the dots take no events.
  const at = (e: React.MouseEvent, pointerType = "mouse"): HoverPoint => ({ clientX: e.clientX, clientY: e.clientY, pointerType });
  return (
    <svg className="seat-arc" viewBox={`${-half} ${-half} ${2 * half} ${half + pad}`} role="img" aria-label={seatLabel(c)}>
      <g>
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
              onPointerEnter={onHover && ((e) => onHover(seat, at(e, e.pointerType)))}
              onPointerLeave={onHover && (() => onHover(null))}
              onClick={
                seat.race && onSelect
                  ? (e) => {
                      e.stopPropagation(); // the card around the arc selects the whole office
                      onSelect(seat.race as Race, at(e));
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
