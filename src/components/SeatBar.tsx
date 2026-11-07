import { PALE, PARTY } from "../lib/colors";
import { RUNOFF } from "../lib/status";
import { seatLabel, secured, type Chamber } from "../lib/summary";

/** Balance-of-power bar: secured seats at the ends in full color, leads pale, runoffs gray, majority line. */
export function SeatBar({ chamber: c }: { chamber: Chamber }) {
  const measures = c.office === "B";
  const segs = (
    measures
      ? [
          { key: "Y", n: c.won.Y, color: PARTY.Y },
          { key: "Yl", n: c.leading.Y, color: PALE.Y },
          { key: "Nl", n: c.leading.N, color: PALE.N },
          { key: "N", n: c.won.N, color: PARTY.N },
        ]
      : [
          { key: "D", n: secured(c, "D"), color: PARTY.D },
          { key: "Dl", n: c.leading.D, color: PALE.D },
          { key: "I", n: secured(c, "I"), color: PARTY.I },
          { key: "Il", n: c.leading.I, color: PALE.I },
          { key: "Ro", n: c.runoffs.length, color: RUNOFF },
          { key: "Rl", n: c.leading.R, color: PALE.R },
          { key: "R", n: secured(c, "R"), color: PARTY.R },
        ]
  ).filter((s) => s.n > 0);
  return (
    <span className="seatbar" role="img" aria-label={seatLabel(c)}>
      {segs.map((s) => (
        <span key={s.key} className="seatbar__seg" style={{ width: `${(100 * s.n) / c.total}%`, background: s.color }} />
      ))}
      {c.majority > 0 && <span className="seatbar__majority" style={{ left: `${(100 * c.majority) / c.total}%` }} />}
    </span>
  );
}
