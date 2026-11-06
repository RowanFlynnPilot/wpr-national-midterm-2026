import { NO_RACE, PALE, PARTY } from "../lib/colors";
import { RUNOFF } from "../lib/status";
import type { Office } from "../lib/types";
import { MarginLegend } from "./CountyMap";
import type { MapMode } from "./NationalMap";

interface Props {
  office: Office;
  mode: MapMode;
  hasIndependent: boolean;
  hasRunoff: boolean;
}

export function Legend({ office, mode, hasIndependent, hasRunoff }: Props) {
  if (office !== "H" && mode === "counties") {
    return <MarginLegend parties={hasIndependent ? ["D", "R", "I"] : ["D", "R"]} />;
  }
  const items = [
    { label: "Democrat won", color: PARTY.D },
    { label: "Democrat leads", color: PALE.D },
    { label: "Republican leads", color: PALE.R },
    { label: "Republican won", color: PARTY.R },
    ...(hasIndependent ? [{ label: "Independent or other party", color: PARTY.I }] : []),
    ...(hasRunoff ? [{ label: "Headed to runoff", color: RUNOFF }] : []),
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
