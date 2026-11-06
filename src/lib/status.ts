import { PALE, PARTY, PARTY_LABEL, PARTY_PLURAL } from "./colors";
import { marginText } from "./format";
import { stateName } from "./states";
import type { Race } from "./types";

export type RaceStatus = "won" | "decided" | "runoff" | "leading";

export const RUNOFF = "#A9A293";

export function raceStatus(r: Race): RaceStatus {
  if (r.winner) return "won";
  if (r.runoff) return "runoff";
  if (r.partyDecided) return "decided";
  return "leading";
}

/** Map fill: full party color once the seat's party is certain, pale while only leading. */
export function raceFill(r: Race): string {
  if (r.winner) return PARTY[r.winner];
  if (r.runoff) return RUNOFF;
  if (r.partyDecided) return PARTY[r.partyDecided];
  return PALE[r.leader];
}

/** One plain sentence describing where the race stands. */
export function statusText(r: Race): string {
  switch (raceStatus(r)) {
    case "won":
      return r.unopposed ? "Unopposed" : r.flip && r.prior ? `Winner called. Flipped from ${PARTY_LABEL[r.prior]}` : "Winner called";
    case "runoff": {
      const finalists = r.cands.filter((c) => c.advanced).map((c) => c.name);
      return finalists.length === 2 ? `Headed to a runoff: ${finalists.join(" vs. ")}` : "Headed to a runoff. No candidate won a majority";
    }
    case "decided":
      return `Not called. Both finalists are ${PARTY_PLURAL[r.partyDecided ?? r.leader]}`;
    case "leading":
      return `Not called. ${PARTY_LABEL[r.leader]} leads by ${marginText(r.margin)} points${rcvNote(r) ? " in first-choice votes" : ""}`;
  }
}

/** Ranked-choice states, shown only when no one has a majority of first choices. */
export function rcvNote(r: Race): string | null {
  const top = r.cands[0]?.pct ?? 0;
  if (top > 50) return null;
  const where = r.state === "AK" ? stateName("AK") : r.state === "ME" && r.office !== "G" ? "Maine, in federal races," : null;
  if (!where) return null;
  return `${where} uses ranked-choice voting. These are first-choice votes; if no candidate tops 50%, lower finishers are eliminated and their ballots go to voters' next choices.`;
}
