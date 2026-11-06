import { stateName } from "./states";
import { statusText } from "./status";
import { raceTitle } from "./summary";
import type { Race } from "./types";

const cell = (v: string | number | null) => {
  const s = v === null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export const toCsv = (rows: (string | number | null)[][]) => rows.map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n";

const HEADER = ["office", "state", "race", "status", "leader", "leader_party", "leader_pct", "leader_votes", "runner_up", "runner_up_party", "runner_up_pct", "runner_up_votes", "margin_pts", "pct_reporting", "total_votes", "called_at", "updated"];

/** One row per race, the top two non-"Others" candidates spelled out; the file a reporter would want. */
export function racesCsv(races: Race[]): string {
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
      ];
    }),
  ]);
}
