import { apNumber } from "../lib/format";
import { OFFICE_NAME, secured, type Chamber } from "../lib/summary";
import type { Office } from "../lib/types";
import { SeatBar } from "./SeatBar";

interface Props {
  chambers: Record<Office, Chamber>;
  office: Office;
  onChange: (office: Office) => void;
}

const ORDER: Office[] = ["S", "H", "G"];

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
  const d = secured(c, "D"), r = secured(c, "R");
  const uncalled = c.uncalled.length;
  const isGov = c.office === "G";
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
        <span className="chamber__rule">{isGov ? `${c.total} governors` : `${c.majority} for a majority`}</span>
      </span>
      <span className="chamber__counts">
        <span className="chamber__count chamber__count--d">
          <strong>{d}</strong>
          <span>Democrats</span>
        </span>
        <span className="chamber__count chamber__count--r">
          <strong>{r}</strong>
          <span>Republicans</span>
        </span>
      </span>
      <SeatBar chamber={c} />
      <span className="chamber__foot">
        {uncalled ? `${apNumber(uncalled).replace(/^\w/, (x) => x.toUpperCase())} not called` : "All races called"}
        <span className="chamber__before">
          Before: {c.before.D} D, {c.before.R} R
        </span>
      </span>
    </button>
  );
}
