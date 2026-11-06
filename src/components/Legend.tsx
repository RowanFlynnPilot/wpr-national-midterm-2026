import { MEASURE_BINS, MEASURE_RAMP, NO_RACE, NO_RESULTS, PALE, PARTY, REMAINING_BINS, REMAINING_RAMP } from "../lib/colors";
import { RUNOFF, type LegendKey } from "../lib/status";
import type { Office } from "../lib/types";
import { MarginLegend } from "./CountyMap";
import type { MapMode } from "./NationalMap";

interface Props {
  office: Office;
  mode: MapMode;
  hasIndependent: boolean;
  hasRunoff: boolean;
  hasNoVotes: boolean;
  hasFresh: boolean;
  spotlight: LegendKey | null;
  onSpotlight: (key: LegendKey | null) => void;
}

/** The map key. In the states and hex views each entry is a button: pressing one dims everything else on the map. */
export function Legend({ office, mode, hasIndependent, hasRunoff, hasNoVotes, hasFresh, spotlight, onSpotlight }: Props) {
  if (office === "B") {
    const [b1, b2, b3] = MEASURE_BINS as [number, number, number];
    const labels = ["1 measure", `${b1}–${b2 - 1}`, `${b2}–${b3 - 1}`, `${b3} or more`];
    return (
      <ul className="legend">
        {MEASURE_RAMP.map((c, i) => (
          <li key={c}>
            <span className="legend__swatch" style={{ background: c }} />
            {labels[i]}
          </li>
        ))}
        <li>
          <span className="legend__swatch" style={{ background: NO_RACE }} />
          No statewide measures
        </li>
      </ul>
    );
  }
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
  const items: { key: LegendKey; label: string; swatch: React.ReactNode }[] = [
    { key: "won:D", label: "Democrat won", swatch: <Swatch color={PARTY.D} /> },
    { key: "lead:D", label: "Democrat leads", swatch: <Swatch color={PALE.D} /> },
    { key: "lead:R", label: "Republican leads", swatch: <Swatch color={PALE.R} /> },
    { key: "won:R", label: "Republican won", swatch: <Swatch color={PARTY.R} /> },
    ...(hasIndependent ? [{ key: "I" as LegendKey, label: "Independent or other party", swatch: <Swatch color={PARTY.I} /> }] : []),
    ...(hasRunoff ? [{ key: "runoff" as LegendKey, label: "Headed to runoff", swatch: <Swatch color={RUNOFF} /> }] : []),
    ...(hasNoVotes ? [{ key: "novotes" as LegendKey, label: "No votes yet", swatch: <Swatch color={NO_RESULTS} /> }] : []),
    ...(office !== "H" ? [{ key: "flip" as LegendKey, label: "Seat flipped", swatch: <span className="legend__dot" /> }] : []),
    ...(hasFresh ? [{ key: "fresh" as LegendKey, label: "Called in the last 3 hours", swatch: <span className="legend__fresh" /> }] : []),
  ];
  return (
    <ul className="legend legend--buttons" aria-label="Map key. Press an entry to spotlight those races.">
      {items.map((it) => (
        <li key={it.key}>
          <button type="button" className="legend__item" aria-pressed={spotlight === it.key} onClick={() => onSpotlight(spotlight === it.key ? null : it.key)}>
            {it.swatch}
            {it.label}
          </button>
        </li>
      ))}
      {office !== "H" && (
        <li>
          <span className="legend__item legend__item--static">
            <Swatch color={NO_RACE} />
            No race
          </span>
        </li>
      )}
      {spotlight && (
        <li>
          <button type="button" className="legend__clear" onClick={() => onSpotlight(null)}>
            Show all
          </button>
        </li>
      )}
    </ul>
  );
}

const Swatch = ({ color }: { color: string }) => <span className="legend__swatch" style={{ background: color }} />;
