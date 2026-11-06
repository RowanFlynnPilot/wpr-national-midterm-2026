import { PALE, PARTY } from "../lib/colors";
import { RUNOFF } from "../lib/status";
import { apNumber } from "../lib/format";
import { OFFICE_NAME, secured, type Chamber } from "../lib/summary";
import type { Office } from "../lib/types";

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
  const d = secured(c, "D"), r = secured(c, "R"), i = secured(c, "I");
  const segs = [
    { key: "D", n: d, color: PARTY.D },
    { key: "Dl", n: c.leading.D, color: PALE.D },
    { key: "I", n: i, color: PARTY.I },
    { key: "Il", n: c.leading.I, color: PALE.I },
    { key: "Ro", n: c.runoffs.length, color: RUNOFF },
    { key: "Rl", n: c.leading.R, color: PALE.R },
    { key: "R", n: r, color: PARTY.R },
  ].filter((s) => s.n > 0);
  const uncalled = c.uncalled.length;
  const isGov = c.office === "G";
  const total = c.total;
  return (
    <button type="button" role="tab" aria-selected={active} className={`chamber${active ? " is-active" : ""}`} onClick={onClick}>
      <span className="chamber__head">
        <span className="chamber__name">{OFFICE_NAME[c.office]}</span>
        <span className="chamber__rule">{isGov ? `${total} governors` : `${c.majority} for a majority`}</span>
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
      <span className="seatbar" aria-hidden="true">
        {segs.map((s) => (
          <span key={s.key} className="seatbar__seg" style={{ width: `${(100 * s.n) / total}%`, background: s.color }} />
        ))}
        {!isGov && <span className="seatbar__majority" style={{ left: `${(100 * c.majority) / total}%` }} />}
      </span>
      <span className="chamber__foot">
        {uncalled ? `${apNumber(uncalled).replace(/^\w/, (x) => x.toUpperCase())} not called` : "All races called"}
        <span className="chamber__before">
          Before: {c.before.D} D, {c.before.R} R
        </span>
      </span>
    </button>
  );
}
