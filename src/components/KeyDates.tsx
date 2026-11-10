import { useState } from "react";
import { apDay } from "../lib/format";
import type { KeyDate } from "../lib/types";

const LISTED = 6;

/** What happens next: the dated steps still ahead in states with a race not yet called, soonest first. */
export function KeyDates({ dates }: { dates: KeyDate[] }) {
  const [showAll, setShowAll] = useState(false);
  const listed = showAll ? dates : dates.slice(0, LISTED);
  return (
    <section className="board__list" aria-labelledby="next-title">
      <h2 id="next-title" className="panel__title">
        What happens next
      </h2>
      <p className="panel__note">Dates in states with a race not yet called, from each state’s election office or law. They can change.</p>
      <ol className="key-dates">
        {listed.map((d) => (
          <li key={`${d.date} ${d.text}`}>
            <time className="key-dates__day" dateTime={d.date}>
              {d.end ? `${apDay(d.date)} to ${apDay(d.end)}` : apDay(d.date)}
            </time>
            <span>{d.text}</span>
          </li>
        ))}
      </ol>
      {!showAll && dates.length > LISTED && (
        <button type="button" className="show-all" onClick={() => setShowAll(true)}>
          Show all {dates.length} dates
        </button>
      )}
    </section>
  );
}
