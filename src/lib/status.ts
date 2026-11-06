import { NO_RESULTS, PALE, PARTY, PARTY_LABEL, PARTY_PLURAL } from "./colors";
import { marginText } from "./format";
import { stateName } from "./states";
import type { Race } from "./types";

export type RaceStatus = "won" | "decided" | "runoff" | "leading";

export const RUNOFF = "#A9A293";

/** Runoff dates by state. Louisiana moved its House primaries to Nov. 3 with a Dec. 12 runoff. */
export const RUNOFF_DATE: Record<string, string> = { LA: "Dec. 12" };

/** No votes reported yet and no call: the map should not paint a lead that does not exist. */
export const noVotesYet = (r: Race) => r.total === 0 && !r.winner;

export function raceStatus(r: Race): RaceStatus {
  if (r.winner) return "won";
  if (r.runoff) return "runoff";
  if (r.partyDecided) return "decided";
  return "leading";
}

/** Map fill: full party color once the seat's party is certain, pale while only leading. */
export function raceFill(r: Race): string {
  if (r.winner) return PARTY[r.winner];
  if (noVotesYet(r)) return NO_RESULTS;
  if (r.runoff) return RUNOFF;
  if (r.partyDecided) return PARTY[r.partyDecided];
  return PALE[r.leader];
}

/** One plain sentence describing where the race stands. */
export function statusText(r: Race): string {
  if (noVotesYet(r)) return "No votes reported yet";
  switch (raceStatus(r)) {
    case "won":
      if (r.office === "B") return r.winner === "Y" ? "Passed" : "Failed";
      return r.unopposed ? "Unopposed" : r.flip && r.prior ? `Winner called. Flipped from ${PARTY_LABEL[r.prior]}` : "Winner called";
    case "runoff": {
      const finalists = r.cands.filter((c) => c.advanced).map((c) => c.name);
      const runoff = RUNOFF_DATE[r.state] ? `a ${RUNOFF_DATE[r.state]} runoff` : "a runoff";
      return finalists.length === 2 ? `Headed to ${runoff}: ${finalists.join(" vs. ")}` : `Headed to ${runoff}. No candidate won a majority`;
    }
    case "decided":
      return `Seat decided: both finalists are ${PARTY_PLURAL[r.partyDecided ?? r.leader]}. Winner not called`;
    case "leading":
      return `Not called. ${PARTY_LABEL[r.leader]} leads by ${marginText(r.margin)} points${rcvNote(r) ? " in first-choice votes" : ""}`;
  }
}

/** Ranked-choice states, shown only when no one has a majority of first choices. */
export function rcvNote(r: Race): string | null {
  if (r.office === "B") return null; // a measure is a single yes/no question
  const top = r.cands[0]?.pct ?? 0;
  if (top > 50) return null;
  const where = r.state === "AK" ? stateName("AK") : r.state === "ME" && r.office !== "G" ? "Maine, in federal races," : null;
  if (!where) return null;
  const when = r.state === "AK" ? " Alaska runs that tabulation once all ballots are in, around Nov. 18." : "";
  return `${where} uses ranked-choice voting. These are first-choice votes; if no candidate tops 50%, lower finishers are eliminated and their ballots go to voters' next choices.${when}`;
}
