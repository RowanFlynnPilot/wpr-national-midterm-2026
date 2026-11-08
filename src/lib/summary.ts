import { PARTY_PLURAL } from "./colors";
import { apNumber } from "./format";
import { stateName } from "./states";
import type { Office, Party, Race, Results } from "./types";

type Tally = Record<Party, number>;
const zero = (): Tally => ({ D: 0, R: 0, I: 0, O: 0, Y: 0, N: 0 });

export interface Chamber {
  office: Office;
  total: number;
  majority: number;
  notUp: Tally; // seats not on the ballot this year
  won: Tally; // called this year
  decided: Tally; // not called, but both finalists are from one party
  leading: Tally; // still being counted, by current leader
  before: { D: number; R: number };
  flips: Race[];
  uncalled: Race[]; // every race without a called winner, closest first
  runoffs: Race[];
  latestCalls: Race[]; // called races with a timestamp, newest first
  races: Race[]; // every race of the office, in results order
}

export const LATEST_CALLS = 8;

export const OFFICE_NAME: Record<Office, string> = { S: "Senate", H: "House", G: "Governors", B: "Ballot measures" };
export const OFFICE_SINGULAR: Record<Office, string> = { S: "Senate", H: "House", G: "Governor", B: "Ballot measure" };
export const OFFICE_SLUG: Record<Office, string> = { S: "senate", H: "house", G: "governors", B: "measures" };

/** "Wisconsin District 3", "Texas Senate", "Florida Senate special election". */
export function raceTitle(race: Race): string {
  if (race.office === "B") {
    if (!race.title) throw new Error(`measure ${race.id} has no title`);
    return race.title;
  }
  if (race.office === "H") return `${stateName(race.state)} ${race.num === 0 ? "at-large" : `District ${race.num}`}`;
  return `${stateName(race.state)} ${OFFICE_SINGULAR[race.office]}${race.special ? " special election" : ""}`;
}

/** A measure's title without its state: "Wisconsin Question 3 - Prohibit..." -> "Question 3 - Prohibit...". */
export function measureShortTitle(race: Race): string {
  const title = raceTitle(race);
  const prefix = `${stateName(race.state)} `;
  return title.startsWith(prefix) ? title.slice(prefix.length) : title;
}

export function chamber(results: Results, office: Office): Chamber {
  const races = results.races.filter((r) => r.office === office);
  const won = zero(), decided = zero(), leading = zero(), notUp = zero();
  for (const r of races) {
    if (r.winner) won[r.winner] += 1;
    else if (r.runoff) continue;
    else if (r.partyDecided) decided[r.partyDecided] += 1;
    else leading[r.leader] += 1;
  }
  const b = results.baselines;
  if (office === "S") Object.assign(notUp, b.senate.not_up);
  if (office === "G") Object.assign(notUp, b.governor.not_up);
  const before = office === "S" ? b.senate.before : office === "G" ? b.governor.before : office === "H" ? b.house.before : { D: 0, R: 0 };
  return {
    office,
    total: office === "H" ? 435 : office === "S" ? 100 : office === "G" ? 50 : races.length,
    majority: office === "H" ? 218 : office === "S" ? 51 : office === "G" ? 26 : 0, // measures have no majority line
    notUp,
    won,
    decided,
    leading,
    before,
    flips: races.filter((r) => r.flip),
    // closest first; a race with no votes yet goes last, since its zero margin is not a close count
    uncalled: races.filter((r) => !r.winner).sort((a, z) => Number(a.total === 0) - Number(z.total === 0) || a.margin - z.margin),
    runoffs: races.filter((r) => r.runoff),
    latestCalls: races
      .filter((r): r is Race & { calledAt: string } => r.calledAt !== null)
      .sort((a, z) => z.calledAt.localeCompare(a.calledAt))
      .slice(0, LATEST_CALLS),
    races,
  };
}

/** Seats a party holds for certain: not up this year, called for it, or settled by a same-party final. */
export const secured = (c: Chamber, p: Party) => c.notUp[p] + c.won[p] + c.decided[p];

/** The accessible name of a balance-of-power graphic: "54 Democrats, 44 Republicans, two not called, 51 for a majority". */
export function seatLabel(c: Chamber): string {
  const measures = c.office === "B";
  return (
    measures
      ? [`${c.won.Y} passed`, `${c.won.N} failed`, c.uncalled.length ? `${c.uncalled.length} not called` : "all called"]
      : [
          `${secured(c, "D")} Democrats`,
          secured(c, "I") ? `${secured(c, "I")} independents` : "",
          `${secured(c, "R")} Republicans`,
          c.uncalled.length ? `${c.uncalled.length} not called` : "all called",
          c.office === "G" ? "" : `${c.majority} for a majority`,
        ]
  )
    .filter(Boolean)
    .join(", ");
}

/** The party that has secured a majority, if any. */
export function controller(c: Chamber): Party | null {
  for (const p of ["D", "R"] as const) if (secured(c, p) >= c.majority) return p;
  return null;
}

export function headline(house: Chamber, senate: Chamber): string {
  const h = controller(house), s = controller(senate);
  if (h && h === s) return `${PARTY_PLURAL[h]} win the House and the Senate`;
  const part = (p: Party | null, name: string) =>
    p ? `${PARTY_PLURAL[p]} win the ${name}` : `Control of the ${name} is still undecided`;
  return `${part(h, "House")}; ${part(s, "Senate").replace(/^C/, "c")}`;
}

const cap = (s: string) => s.replace(/^\w/, (c) => c.toUpperCase());

export function dek(house: Chamber, senate: Chamber, governors: Chamber, measures?: Chamber): string {
  const sentences = [
    `Democrats have won ${secured(house, "D")} House seats to Republicans' ${secured(house, "R")} and, with the two independents who caucus with them, hold at least ${secured(senate, "D")} Senate seats.`,
  ];
  for (const p of ["D", "R"] as const) {
    const s = senate.flips.filter((r) => r.winner === p).length;
    const g = governors.flips.filter((r) => r.winner === p).length;
    const parts: string[] = [];
    if (s) parts.push(`${apNumber(s)} Senate seat${s === 1 ? "" : "s"}`);
    if (g) parts.push(`${apNumber(g)} governor's office${g === 1 ? "" : "s"}`);
    if (parts.length) sentences.push(`${p === "D" ? "They" : "Republicans"} flipped ${parts.join(" and ")}.`);
  }
  const all = [house, senate, governors];
  const runoffs = all.flatMap((c) => c.runoffs);
  const counting = all.reduce((n, c) => n + c.uncalled.length, 0) - runoffs.length;
  const states = [...new Set(runoffs.map((r) => r.state))];
  const runoffClause = runoffs.length
    ? `${apNumber(runoffs.length)} ${states.length === 1 ? `${stateName(states[0] as string)} ` : ""}House race${runoffs.length === 1 ? " is" : "s are"} headed to runoffs`
    : "";
  if (counting) sentences.push(`Votes are still being counted in ${apNumber(counting)} race${counting === 1 ? "" : "s"}${runoffClause ? `, and ${runoffClause}` : ""}.`);
  else if (runoffClause) sentences.push(`${cap(runoffClause)}.`);
  if (measures && measures.won.Y + measures.won.N > 0) {
    sentences.push(`Of ${measures.total} statewide ballot measures, ${apNumber(measures.won.Y)} ${measures.won.Y === 1 ? "has" : "have"} passed and ${apNumber(measures.won.N)} ${measures.won.N === 1 ? "has" : "have"} failed.`);
  }
  return sentences.join(" ");
}

export interface PopularVote {
  share: Record<Party, number>;
  total: number;
  noRepublican: number;
  noDemocrat: number;
}

/** Every vote cast in House races so far, by party. */
export function housePopularVote(results: Results): PopularVote {
  const house = results.races.filter((r) => r.office === "H");
  const votes = zero();
  for (const r of house) for (const c of r.cands) votes[c.party] += c.votes;
  const total = votes.D + votes.R + votes.I + votes.O;
  const share = zero();
  for (const p of ["D", "R", "I", "O"] as const) share[p] = (100 * votes[p]) / total;
  return {
    share,
    total,
    noRepublican: house.filter((r) => !r.cands.some((c) => c.party === "R")).length,
    noDemocrat: house.filter((r) => !r.cands.some((c) => c.party === "D")).length,
  };
}
