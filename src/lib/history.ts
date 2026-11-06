import type { Party, Race } from "./types";

/** One data run's reading of a race: Unix seconds of the fetch, who led, by how much, share reporting. */
export type HistoryPoint = [t: number, leader: Party, margin: number, pctIn: number];

/** raceId -> points, oldest first; only races with two or more points in the last week (pipeline/history.py). */
export type History = Record<string, HistoryPoint[]>;

export interface Reading {
  t: number;
  margin: number; // signed: positive when the race's current leader led, negative when the other side did
  pctIn: number;
}

/** The side a race is measured from: its winner once called, else the current leader. */
export const side = (race: Race): Party => race.winner ?? race.leader;

/** The series as the current leader sees it, so a line that rises is a lead growing. */
export function readings(points: HistoryPoint[], current: Party): Reading[] {
  return points.map(([t, leader, margin, pctIn]) => ({ t, margin: leader === current ? margin : -margin, pctIn }));
}

export type Trend = "widening" | "narrowing" | "flipped";

/** How the lead moved between the last two readings, or null when it moved under a tenth of a point. */
export function trend(points: HistoryPoint[], current: Party): Trend | null {
  const r = readings(points, current);
  const last = r[r.length - 1], prev = r[r.length - 2];
  if (!last || !prev) return null;
  if (Math.sign(last.margin) !== Math.sign(prev.margin) && prev.margin !== 0) return "flipped";
  const change = Math.abs(last.margin) - Math.abs(prev.margin);
  if (Math.abs(change) < 0.1) return null;
  return change > 0 ? "widening" : "narrowing";
}

/** "the last 3 hours", "the last 2 days": the span a series covers, in words. */
export function spanText(points: HistoryPoint[]): string {
  const first = points[0], last = points[points.length - 1];
  if (!first || !last) return "";
  const hours = Math.max(1, Math.round((last[0] - first[0]) / 3600));
  if (hours < 48) return `the last ${hours === 1 ? "hour" : `${hours} hours`}`;
  return `the last ${Math.round(hours / 24)} days`;
}
