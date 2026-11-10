import type { KeyDate, Office, Race } from "./types";

/**
 * The dates still ahead for an office's overview: those of states where that office has a race without a winner, on or
 * after today in Central time. The measures tab gets none: the dates file covers only states with a candidate race open.
 * The pipeline has already put them in order.
 */
export function upcoming(dates: KeyDate[], races: Race[], office: Office, now: number): KeyDate[] {
  if (office === "B") return [];
  const open = new Set(races.filter((r) => r.office === office && !r.winner).map((r) => r.state));
  return dates.filter(
    (d) => open.has(d.state) && (!d.offices || d.offices.includes(office)) && Date.parse(`${d.end ?? d.date}T23:59:59-06:00`) >= now,
  );
}
