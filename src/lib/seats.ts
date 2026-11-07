import { PALE, PARTY } from "./colors";
import { RUNOFF } from "./status";
import type { Chamber } from "./summary";
import type { Office, Party, Race } from "./types";

export type SeatKind = "notUp" | "won" | "decided" | "leading" | "runoff";

export interface Seat {
  office: Office;
  party: Party;
  kind: SeatKind;
  race: Race | null; // null: a Senate or governor seat not on this year's ballot
  color: string;
}

/** Each race goes in one bucket, the same way `chamber` tallies it. */
function kindOf(r: Race): { kind: SeatKind; party: Party } {
  if (r.winner) return { kind: "won", party: r.winner };
  if (r.runoff) return { kind: "runoff", party: r.leader };
  if (r.partyDecided) return { kind: "decided", party: r.partyDecided };
  return { kind: "leading", party: r.leader };
}

const color = (kind: SeatKind, party: Party) => (kind === "runoff" ? RUNOFF : kind === "leading" ? PALE[party] : PARTY[party]);

/**
 * Every seat of a chamber in the order the arc draws them, left to right: Democrats' holdovers, wins, decided finals and
 * leads; then independents and others the same way; runoffs; then Republicans' leads, decided finals, wins and holdovers.
 * Within a block the widest margin sits outermost, so the closest races of both parties meet in the middle under the
 * majority tick. Measures: passed, yes leading, no leading, failed.
 */
export function chamberSeats(c: Chamber): Seat[] {
  const tagged = c.races.map((race) => ({ race, ...kindOf(race) }));
  const seat = (party: Party, kind: SeatKind, race: Race | null): Seat => ({ office: c.office, party, kind, race, color: color(kind, party) });
  // widestFirst: the block fills from the arc's edge toward the middle; the right side fills the other way
  const block = (kind: SeatKind, party: Party, widestFirst: boolean): Seat[] =>
    tagged
      .filter((t) => t.kind === kind && t.party === party)
      .sort((a, b) => (widestFirst ? b.race.margin - a.race.margin : a.race.margin - b.race.margin))
      .map((t) => seat(party, kind, t.race));
  const holdovers = (party: Party): Seat[] => Array.from({ length: c.notUp[party] }, () => seat(party, "notUp", null));
  const runoffs = tagged.filter((t) => t.kind === "runoff").map((t) => seat(t.party, "runoff", t.race));
  if (c.office === "B") return [...block("won", "Y", true), ...block("leading", "Y", true), ...block("leading", "N", false), ...block("won", "N", false)];
  const left = (p: Party) => [...holdovers(p), ...block("won", p, true), ...block("decided", p, true), ...block("leading", p, true)];
  const right = (p: Party) => [...block("leading", p, false), ...block("decided", p, false), ...block("won", p, false), ...holdovers(p)];
  return [...left("D"), ...left("I"), ...left("O"), ...runoffs, ...right("R")];
}
