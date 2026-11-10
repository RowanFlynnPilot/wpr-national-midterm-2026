import { NO_RESULTS, PALE, PARTY, PARTY_LABEL, PARTY_PLURAL } from "./colors";
import { centralTime, marginWords, pct } from "./format";
import { stateName } from "./states";
import type { Race } from "./types";

export type RaceStatus = "won" | "decided" | "runoff" | "leading";

export const RUNOFF = "#A9A293";

/** Runoff dates by state. Louisiana moved its House primaries to Nov. 3 with a Dec. 12 runoff. */
export const RUNOFF_DATE: Record<string, string> = { LA: "Dec. 12" };

/** The map key's entries. "won:D" also covers a same-party final decided for D; "I" covers independents won or leading. */
export type LegendKey = "won:D" | "lead:D" | "won:R" | "lead:R" | "I" | "runoff" | "novotes" | "flip" | "fresh";

/** Calls this recent get a ring on the map and an entry in the key. */
export const FRESH_MS = 3 * 60 * 60 * 1000;

export const isFresh = (r: Race, now: number) => r.calledAt !== null && now - Date.parse(r.calledAt) < FRESH_MS;

/** Which key entry a race belongs to, matching raceFill. */
export function legendKey(r: Race): LegendKey {
  if (noVotesYet(r)) return "novotes";
  if (r.runoff) return "runoff";
  const party = r.winner ?? r.partyDecided ?? r.leader;
  if (party === "I" || party === "O") return "I";
  if (r.winner || r.partyDecided) return party === "D" ? "won:D" : "won:R";
  return party === "D" ? "lead:D" : "lead:R";
}

/** Whether a race stays lit under a spotlighted key entry. */
export function inSpotlight(r: Race, key: LegendKey, now: number): boolean {
  if (key === "flip") return r.flip === true;
  if (key === "fresh") return isFresh(r, now);
  return legendKey(r) === key;
}

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
      if (r.office === "B") return r.winner === "Y" ? "Passed" : failedText(r);
      return r.unopposed ? "Unopposed" : r.flip && r.prior ? `Winner called. Flipped from ${PARTY_LABEL[r.prior]}` : "Winner called";
    case "runoff": {
      const finalists = r.cands.filter((c) => c.advanced).map((c) => c.name);
      const runoff = RUNOFF_DATE[r.state] ? `a ${RUNOFF_DATE[r.state]} runoff` : "a runoff";
      return finalists.length === 2 ? `Headed to ${runoff}: ${finalists.join(" vs. ")}` : `Headed to ${runoff}. No candidate won a majority`;
    }
    case "decided":
      return `Seat decided: both finalists are ${PARTY_PLURAL[r.partyDecided ?? r.leader]}. Winner not called`;
    case "leading":
      if (r.office === "B") return measureLeadText(r);
      return `Not called. ${PARTY_LABEL[r.leader]} leads by ${marginWords(r.margin)} points${rcvNote(r) ? " in first-choice votes" : ""}`;
  }
}

/** A measure's Yes share. */
export const yesShare = (r: Race) => r.cands.find((c) => c.party === "Y")?.pct ?? 0;

/** "Failed", or why when Yes led but the measure needed more than a majority: "Failed: Yes 58.2% fell short of the 60% required". */
function failedText(r: Race): string {
  const yes = yesShare(r);
  return r.rule && yes > 50 ? `Failed: Yes ${pct(yes)} fell short of the ${r.rule.label} required` : "Failed";
}

/** "Not called. Yes leads by 2.2 points", with "but is under the 55% needed" when that lead is not enough to pass. */
function measureLeadText(r: Race): string {
  const lead = `Not called. ${PARTY_LABEL[r.leader]} leads by ${marginWords(r.margin)} points`;
  return r.rule && r.leader === "Y" && yesShare(r) < r.rule.needs ? `${lead} but is under the ${r.rule.label} needed` : lead;
}

/** "Called Nov. 3, 10:32 p.m. CST", or null for a race civicAPI called without a time or has not called. */
export function calledText(r: Race): string | null {
  return r.calledAt ? `Called ${centralTime(r.calledAt)}` : null;
}

/**
 * The status line of a race card or share card, in parts: the sentence, then the call time. "Winner called" beside a
 * call time says the same thing twice, so there the time takes the words' place.
 */
export function statusParts(r: Race): string[] {
  const text = statusText(r);
  const called = calledText(r);
  if (!called) return [text];
  return text.startsWith("Winner called") ? [text.replace("Winner called", called)] : [text, called];
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
