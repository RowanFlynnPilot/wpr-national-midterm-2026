import { raceShift, turnoutVs2024, type Baseline } from "./shift";
import { stateName } from "./states";
import { statusText } from "./status";
import { raceTitle } from "./summary";
import type { Race } from "./types";

const cell = (v: string | number | null) => {
  const s = v === null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export const toCsv = (rows: (string | number | null)[][]) => rows.map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n";

const HEADER = ["office", "state", "race", "status", "leader", "leader_party", "leader_pct", "leader_votes", "runner_up", "runner_up_party", "runner_up_pct", "runner_up_votes", "margin_pts", "pct_reporting", "total_votes", "called_at", "updated", "shift_vs_2024_pts", "votes_vs_2024_turnout_pct"];

/** One row per race, the top two non-"Others" candidates spelled out; the file a reporter would want. */
export function racesCsv(races: Race[], baseline: Baseline | null): string {
  return toCsv([
    HEADER,
    ...races.map((r) => {
      const [a, b] = r.cands.filter((c) => c.party !== "O");
      return [
        r.office,
        stateName(r.state),
        raceTitle(r),
        statusText(r),
        a?.name ?? null,
        a?.party ?? null,
        a?.pct ?? null,
        a?.votes ?? null,
        b?.name ?? null,
        b?.party ?? null,
        b?.pct ?? null,
        b?.votes ?? null,
        r.margin,
        r.pctIn,
        r.total,
        r.calledAt,
        r.updated,
        shiftCell(r, baseline),
        turnoutCell(r, baseline),
      ];
    }),
  ]);
}

/** The race's move against the 2024 presidential vote, one decimal, Democratic positive; blank without a baseline. */
function shiftCell(r: Race, baseline: Baseline | null): number | null {
  const s = baseline ? raceShift(r, baseline) : null;
  return s ? Math.round(s.shift * 10) / 10 : null;
}

/** Votes counted so far as a whole-number percentage of the state's 2024 presidential vote; blank for a district or without a baseline. */
function turnoutCell(r: Race, baseline: Baseline | null): number | null {
  const t = baseline ? turnoutVs2024(r, baseline) : null;
  return t === null ? null : Math.round(t);
}

