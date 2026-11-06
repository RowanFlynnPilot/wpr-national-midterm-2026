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
  return (
    <div className="chambers" role="tablist" aria-label="Choose a set of races">
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
    <button type="button" role="tab" aria-selected={active} className={`chamber${active ? " is-active" : ""}`} onClick={onClick}>
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
