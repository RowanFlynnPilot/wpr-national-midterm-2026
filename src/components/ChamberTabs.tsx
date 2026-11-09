import { useCallback, useRef, useState } from "react";
import { PARTY } from "../lib/colors";
import { apNumber } from "../lib/format";
import type { History } from "../lib/history";
import type { Seat } from "../lib/seats";
import type { Baseline } from "../lib/shift";
import { OFFICE_NAME, secured, type Chamber } from "../lib/summary";
import type { Office, Race } from "../lib/types";
import { useCountUp } from "../lib/countUp";
import { SeatArc } from "./SeatArc";
import { SeatPopover } from "./SeatPopover";
import { Tooltip, type HoverPoint, type TipTarget } from "./Tooltip";

interface Props {
  chambers: Record<Office, Chamber>;
  office: Office;
  races: Race[]; // the seat pop-up reads its race from here, so a refresh or a replay step updates an open card
  history: History;
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

/** The seat whose race is open in the pop-up, and where its dot was clicked, in the frame's coordinates. */
interface SeatOpen {
  raceId: number;
  x: number;
  y: number;
}

export function ChamberTabs({ chambers, office, races, history, baseline, now, onChange, onSelectRace }: Props) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<SeatHover | null>(null);
  const [open, setOpen] = useState<SeatOpen | null>(null);
  const opener = useRef<HTMLElement | SVGElement | null>(null); // the seat that had focus when the pop-up opened; focus returns to it
  const openRace = open ? races.find((r) => r.id === open.raceId) : undefined;
  // A seat under the pointer names its race in the same tooltip the maps use; a finger never hovers, and no tooltip
  // joins an open pop-up.
  const onHover = useCallback((seat: Seat | null, at?: HoverPoint) => {
    const frame = frameRef.current;
    if (!seat || !at || at.pointerType === "touch" || !frame || open) return setHover(null);
    const rect = frame.getBoundingClientRect();
    setHover({ seat, x: at.clientX - rect.left, y: at.clientY - rect.top });
  }, [open]);
  // A click on a seat opens its race under the dot instead of changing the view: the panel is below the fold here.
  const onSeat = useCallback((race: Race, at: HoverPoint) => {
    const frame = frameRef.current;
    if (!frame) return;
    const rect = frame.getBoundingClientRect();
    const active = document.activeElement;
    opener.current = active instanceof SVGElement && active.classList.contains("seat-arc__seat") ? active : null;
    setHover(null);
    setOpen({ raceId: race.id, x: at.clientX - rect.left, y: at.clientY - rect.top });
  }, []);
  const close = useCallback(() => {
    setOpen(null);
    opener.current?.focus({ preventScroll: true });
    opener.current = null;
  }, []);
  // WAI-ARIA tabs: the active tab is the only tab stop; Left/Right/Home/End move and select.
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!(e.target as HTMLElement).matches('[role="tab"]')) return; // the arcs' seats handle their own arrow keys
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
      {/* The tab list owns its four tabs by id: a tablist may hold nothing but tabs, and each card also holds its arc of seat buttons. */}
      <div role="tablist" aria-label="Choose a set of races" aria-owns={ORDER.map((o) => `chamber-tab-${o}`).join(" ")} />
      <div className="chambers" onKeyDown={onKeyDown}>
        {ORDER.map((o) => (
          <ChamberTab key={o} c={chambers[o]} active={o === office} onClick={() => onChange(o)} onHover={onHover} onSelectRace={onSeat} />
        ))}
      </div>
      {open && openRace && frameRef.current && (
        <SeatPopover
          race={openRace}
          points={history[String(openRace.id)]}
          baseline={baseline}
          x={open.x}
          y={open.y}
          frameWidth={frameRef.current.clientWidth}
          onOpen={() => {
            close();
            onSelectRace(openRace);
          }}
          onClose={close}
        />
      )}
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
  onSelectRace: (race: Race, at: HoverPoint) => void;
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
      <button type="button" id={`chamber-tab-${c.office}`} role="tab" data-office={c.office} aria-selected={active} aria-controls="board" tabIndex={active ? 0 : -1} className="chamber__tab">
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
