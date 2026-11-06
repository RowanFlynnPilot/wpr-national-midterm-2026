import { NO_RACE, NO_RESULTS, PALE, PARTY, REMAINING_BINS, REMAINING_RAMP } from "../lib/colors";
import { RUNOFF } from "../lib/status";
import type { Office } from "../lib/types";
import { MarginLegend } from "./CountyMap";
import type { MapMode } from "./NationalMap";

interface Props {
  office: Office;
  mode: MapMode;
  hasIndependent: boolean;
  hasRunoff: boolean;
  hasNoVotes: boolean;
}

export function Legend({ office, mode, hasIndependent, hasRunoff, hasNoVotes }: Props) {
  if (office !== "H" && mode === "counties") {
    return <MarginLegend parties={hasIndependent ? ["D", "R", "I"] : ["D", "R"]} />;
  }
  if (office !== "H" && mode === "remaining") {
    const [b1, b2, b3] = REMAINING_BINS as [number, number, number];
    const labels = ["Done", `<${b1}%`, `${b1}–${b2}%`, `${b2}–${b3}%`, `${b3}%+`];
    return (
      <div className="margin-legend">
        <div className="margin-legend__title">Share of the county’s vote still to be reported, by civicAPI’s % reporting</div>
        <div className="margin-legend__row margin-legend__row--remaining">
          {REMAINING_RAMP.map((c, i) => (
            <span key={c} className="margin-legend__step" style={{ background: c }} title={labels[i]} />
          ))}
        </div>
        <div className="margin-legend__ticks margin-legend__ticks--remaining" aria-hidden="true">
          {labels.map((l) => (
            <span key={l}>{l}</span>
          ))}
        </div>
      </div>
    );
  }
  const items = [
    { label: "Democrat won", color: PARTY.D },
    { label: "Democrat leads", color: PALE.D },
    { label: "Republican leads", color: PALE.R },
    { label: "Republican won", color: PARTY.R },
    ...(hasIndependent ? [{ label: "Independent or other party", color: PARTY.I }] : []),
    ...(hasRunoff ? [{ label: "Headed to runoff", color: RUNOFF }] : []),
    ...(hasNoVotes ? [{ label: "No votes yet", color: NO_RESULTS }] : []),
  ];
  return (
    <ul className="legend">
      {items.map((it) => (
        <li key={it.label}>
          <span className="legend__swatch" style={{ background: it.color }} />
          {it.label}
        </li>
      ))}
      {office !== "H" && (
        <>
          <li>
            <span className="legend__swatch" style={{ background: NO_RACE }} />
            No race
          </li>
          <li>
            <span className="legend__dot" />
            Seat flipped
          </li>
        </>
      )}
    </ul>
  );
}
