import { PARTY } from "../lib/colors";
import { apNumber } from "../lib/format";
import { OFFICE_NAME, secured, type Chamber } from "../lib/summary";
import type { Office } from "../lib/types";
import { useCountUp } from "../lib/countUp";
import { SeatArc } from "./SeatArc";

interface Props {
  chambers: Record<Office, Chamber>;
  office: Office;
  onChange: (office: Office) => void;
}

const ORDER: Office[] = ["S", "H", "G", "B"];

export function ChamberTabs({ chambers, office, onChange }: Props) {
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
    <div className="chambers" role="tablist" aria-label="Choose a set of races" onKeyDown={onKeyDown}>
      {ORDER.map((o) => (
        <ChamberTab key={o} c={chambers[o]} active={o === office} onClick={() => onChange(o)} />
      ))}
    </div>
  );
}

function ChamberTab({ c, active, onClick }: { c: Chamber; active: boolean; onClick: () => void }) {
  const measures = c.office === "B";
  const left = measures ? { n: c.won.Y, label: "Passed", color: PARTY.Y } : { n: secured(c, "D"), label: "Democrats", color: PARTY.D };
  const right = measures ? { n: c.won.N, label: "Failed", color: PARTY.N } : { n: secured(c, "R"), label: "Republicans", color: PARTY.R };
  const rule = measures ? `${c.total} statewide` : c.office === "G" ? `${c.total} governors` : `${c.majority} for a majority`;
  const uncalled = c.uncalled.length;
  const leftShown = useCountUp(left.n);
  const rightShown = useCountUp(right.n);
  return (
    <button
      type="button"
      role="tab"
      data-office={c.office}
      aria-selected={active}
      aria-controls="board"
      tabIndex={active ? 0 : -1}
      className={`chamber${active ? " is-active" : ""}`}
      onClick={onClick}
    >
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
      <SeatArc chamber={c} />
      <span className="chamber__foot">
        {uncalled ? `${apNumber(uncalled).replace(/^\w/, (x) => x.toUpperCase())} not called` : measures ? "All measures called" : "All races called"}
        {!measures && (
          <span className="chamber__before">
            Before: {c.before.D} D, {c.before.R} R
          </span>
        )}
      </span>
    </button>
  );
}
