import { memo, useMemo, useRef, useState } from "react";
import { arcRows, arcSeats } from "../lib/arc";
import { chamberSeats, type Seat } from "../lib/seats";
import { statusText } from "../lib/status";
import { raceTitle, seatLabel, type Chamber } from "../lib/summary";
import type { Race } from "../lib/types";
import { focusPoint, type HoverPoint } from "./Tooltip";

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
  const svgRef = useRef<SVGSVGElement>(null);
  const seats = useMemo(() => chamberSeats(c), [c]);
  const total = seats.length;
  const { pos, r } = useMemo(() => {
    const rows = arcRows(total, INNER, OUTER);
    const pos = arcSeats(total, rows, INNER, OUTER);
    const rowGap = (OUTER - INNER) / (rows - 1);
    const along = (Math.PI * (INNER + OUTER)) / 2 / (total / rows);
    return { pos, r: 0.4 * Math.min(rowGap, along) };
  }, [total]);
  // Keyboard: the seats with a race are one roving tab stop; Left/Right walk them in the arc's order (left to right across
  // the rows), Home/End jump to the ends, focus shows the tooltip and Enter or Space opens the race. Holdovers only name
  // themselves on hover, so the keyboard skips them.
  const raceIdx = useMemo(() => seats.flatMap((s, i) => (s.race ? [i] : [])), [seats]);
  const [focusIdx, setFocusIdx] = useState<number | null>(null);
  const tabStop = focusIdx !== null && seats[focusIdx]?.race ? focusIdx : raceIdx[0];
  const move = (from: number, key: string) => {
    const k = raceIdx.indexOf(from);
    const to =
      key === "ArrowRight" || key === "ArrowDown" ? raceIdx[Math.min(k + 1, raceIdx.length - 1)]
      : key === "ArrowLeft" || key === "ArrowUp" ? raceIdx[Math.max(k - 1, 0)]
      : key === "Home" ? raceIdx[0]
      : key === "End" ? raceIdx[raceIdx.length - 1]
      : undefined;
    if (to === undefined) return false;
    svgRef.current?.querySelector<SVGCircleElement>(`[data-i="${to}"]`)?.focus();
    return true;
  };
  const majorityAngle = c.majority > 0 ? Math.PI * (1 - c.majority / c.total) : null;
  // The drawing reaches past the outer ring by a dot (and its hover stroke) or by the majority tick, whichever is farther;
  // the Senate's dots are 5 units and were cut at the sides and the bottom when the box stopped at the ring.
  const pad = Math.max(r, 5) + 1;
  const half = OUTER + pad;
  // A click is always a mouse or a pen here: under a coarse pointer the dots take no events.
  const at = (e: React.MouseEvent, pointerType = "mouse"): HoverPoint => ({ clientX: e.clientX, clientY: e.clientY, pointerType });
  const interactive = Boolean(onSelect);
  return (
    <svg
      ref={svgRef}
      className="seat-arc"
      viewBox={`${-half} ${-half} ${2 * half} ${half + pad}`}
      role={interactive ? "group" : "img"}
      aria-label={interactive ? `${seatLabel(c)} Arrow keys move between the seats on the ballot.` : seatLabel(c)}
    >
      <g>
        {pos.map((s, i) => {
          const seat = seats[i] as Seat;
          const race = seat.race;
          const focusable = interactive && race !== null;
          return (
            <circle
              key={i}
              data-i={i}
              className={race ? "seat-arc__seat is-race" : "seat-arc__seat"}
              cx={s.x}
              cy={s.y}
              r={r}
              fill={seat.color}
              style={{ animationDelay: `${Math.min(i, total - 1 - i) * 3}ms` }}
              role={focusable ? "button" : undefined}
              tabIndex={focusable ? (i === tabStop ? 0 : -1) : undefined}
              aria-label={focusable ? `${raceTitle(race)}: ${statusText(race)}` : undefined}
              onPointerEnter={onHover && ((e) => onHover(seat, at(e, e.pointerType)))}
              onPointerLeave={onHover && (() => onHover(null))}
              onFocus={
                focusable
                  ? (e) => {
                      setFocusIdx(i);
                      if (e.currentTarget.matches(":focus-visible")) onHover?.(seat, focusPoint(e.currentTarget));
                    }
                  : undefined
              }
              onBlur={focusable ? () => onHover?.(null) : undefined}
              onKeyDown={
                focusable
                  ? (e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onSelect?.(race, focusPoint(e.currentTarget));
                      } else if (move(i, e.key)) e.preventDefault();
                    }
                  : undefined
              }
              onClick={
                race && onSelect
                  ? (e) => {
                      e.stopPropagation(); // the card around the arc selects the whole office
                      onSelect(race, at(e));
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
