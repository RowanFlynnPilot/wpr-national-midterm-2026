import { useCallback, useRef, useState } from "react";
import { PARTY } from "../lib/colors";
import { apNumber } from "../lib/format";
import type { Seat } from "../lib/seats";
import type { Baseline } from "../lib/shift";
import { OFFICE_NAME, secured, type Chamber } from "../lib/summary";
import type { Office, Race } from "../lib/types";
import { useCountUp } from "../lib/countUp";
import { SeatArc } from "./SeatArc";
import { Tooltip, type HoverPoint, type TipTarget } from "./Tooltip";

interface Props {
  chambers: Record<Office, Chamber>;
  office: Office;
  baseline: Baseline | null; // the 2024 presidential vote, for the seat tooltip's shift line
  now: number;
  onChange: (office: Office) => void;
  onSelectRace: (race: Race) => void;
}

const ORDER: Office[] = ["S", "H", "G", "B"];

interface SeatHover {
  seat: Seat;
  x: number;
  y: number;
}

export function ChamberTabs({ chambers, office, baseline, now, onChange, onSelectRace }: Props) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<SeatHover | null>(null);
  // A seat under the pointer names its race in the same tooltip the maps use; a finger never hovers.
  const onHover = useCallback((seat: Seat | null, at?: HoverPoint) => {
    const frame = frameRef.current;
    if (!seat || !at || at.pointerType === "touch" || !frame) return setHover(null);
    const rect = frame.getBoundingClientRect();
    setHover({ seat, x: at.clientX - rect.left, y: at.clientY - rect.top });
  }, []);
  // WAI-ARIA tabs: the active tab is the only tab stop; Left/Right/Home/End move and select.
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const i = ORDER.indexOf(office);
    const next =
      e.key === "ArrowRight" ? ORDER[(i + 1) % ORDER.length]
      : e.key === "ArrowLeft" ? ORDER[(i + ORDER.length - 1) % ORDER.length]
      : e.key === "Home" ? ORDER[0]
      : e.key === "End" ? ORDER[ORDER.length - 1]
      : undefined;
    if (!next) return;
    e.preventDefault();
    onChange(next);
    e.currentTarget.querySelector<HTMLButtonElement>(`[data-office="${next}"]`)?.focus();
  };
  return (
    <div className="chambers-frame" ref={frameRef} onPointerLeave={() => setHover(null)}>
      <div className="chambers" role="tablist" aria-label="Choose a set of races" onKeyDown={onKeyDown}>
        {ORDER.map((o) => (
          <ChamberTab key={o} c={chambers[o]} active={o === office} onClick={() => onChange(o)} onHover={onHover} onSelectRace={onSelectRace} />
        ))}
      </div>
      {hover && frameRef.current && (
        <Tooltip
          target={seatTarget(hover.seat)}
          race={hover.seat.race ?? undefined}
          counties={null}
          baseline={baseline}
          now={now}
          x={hover.x}
          y={hover.y}
          bounds={{ width: frameRef.current.clientWidth, height: frameRef.current.clientHeight }}
        />
      )}
    </div>
  );
}

/** What the tooltip describes: the seat's race, or a seat that was not on this year's ballot. */
function seatTarget(seat: Seat): TipTarget {
  const r = seat.race;
  if (!r) return { kind: "seat", party: seat.party, office: seat.office };
  return r.district !== null ? { kind: "district", district: r.district } : { kind: "state", state: r.state };
}

interface TabProps {
  c: Chamber;
  active: boolean;
  onClick: () => void;
  onHover: (seat: Seat | null, at?: HoverPoint) => void;
  onSelectRace: (race: Race) => void;
}

/** The card is the click target for the office; the tab button inside it carries the keyboard and screen-reader role. */
function ChamberTab({ c, active, onClick, onHover, onSelectRace }: TabProps) {
  const measures = c.office === "B";
  const left = measures ? { n: c.won.Y, label: "Passed", color: PARTY.Y } : { n: secured(c, "D"), label: "Democrats", color: PARTY.D };
  const right = measures ? { n: c.won.N, label: "Failed", color: PARTY.N } : { n: secured(c, "R"), label: "Republicans", color: PARTY.R };
  const rule = measures ? `${c.total} statewide` : c.office === "G" ? `${c.total} governors` : `${c.majority} for a majority`;
  const uncalled = c.uncalled.length;
  const leftShown = useCountUp(left.n);
  const rightShown = useCountUp(right.n);
  return (
    <div className={`chamber${active ? " is-active" : ""}`} onClick={onClick}>
      <button type="button" role="tab" data-office={c.office} aria-selected={active} aria-controls="board" tabIndex={active ? 0 : -1} className="chamber__tab">
        <span className="chamber__head">
          <span className="chamber__name">{OFFICE_NAME[c.office]}</span>
          <span className="chamber__rule">{rule}</span>
        </span>
        <span className="chamber__counts">
          <span className="chamber__count">
            <strong style={{ color: left.color }}>{leftShown}</strong>
            <span>{left.label}</span>
          </span>
          <span className="chamber__count chamber__count--right">
            <strong style={{ color: right.color }}>{rightShown}</strong>
            <span>{right.label}</span>
          </span>
        </span>
      </button>
      <SeatArc chamber={c} onHover={onHover} onSelect={onSelectRace} />
      <span className="chamber__foot">
        {uncalled ? `${apNumber(uncalled).replace(/^\w/, (x) => x.toUpperCase())} not called` : measures ? "All measures called" : "All races called"}
        {!measures && (
          <span className="chamber__before">
            Before: {c.before.D} D, {c.before.R} R
          </span>
        )}
      </span>
    </div>
  );
}
