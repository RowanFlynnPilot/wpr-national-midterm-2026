import { marginText, pct } from "./format";
import { raceDistrict } from "./route";
import { biggestShifts, marginLabel, officeShift, ticketPairs, type Baseline, type TicketPair } from "./shift";
import { HOME_STATE, stateName } from "./states";
import { housePopularVote, OFFICE_SINGULAR, raceTitle, secured, type Chamber } from "./summary";
import type { Office, Race, Results, Selection } from "./types";

export interface Takeaway {
  text: string;
  to: Selection; // the view that backs it up
}

const toRace = (r: Race): Selection => ({ office: r.office, state: r.state, district: raceDistrict(r) });
const lastName = (name: string) => name.split(" ").slice(-1)[0] as string;

/**
 * Up to six sentences a reader could take away, each written from the data and linked to the view that shows it:
 * the closest race still being counted, the seats that changed hands, the House popular vote, the move since 2024
 * (once the baseline has loaded), the states that split their Senate and governor votes between the parties, and the
 * home state. Replays with the results, since it is derived from them.
 */
export function takeaways(results: Results, chambers: Record<Office, Chamber>, baseline: Baseline | null): Takeaway[] {
  const out: Takeaway[] = [];
  const races = results.races;

  // 1. The closest race still being counted: statewide first, then the House.
  const open = (offices: Office[]) => races.filter((r) => offices.includes(r.office) && !r.winner && !r.runoff && r.total > 0).sort((a, b) => a.margin - b.margin)[0];
  const closest = open(["S", "G"]) ?? open(["H"]);
  if (closest) {
    const lead = closest.cands[0] as Race["cands"][number];
    out.push({
      text: `The closest race still being counted is ${raceTitle(closest)}, where ${lead.name} leads by ${marginText(closest.margin)} points with ${Math.round(closest.pctIn)}% in.`,
      to: toRace(closest),
    });
  } else {
    out.push({ text: "Every race has been called.", to: { office: "S", state: null, district: null } });
  }

  // 2. Seats that changed hands, Senate first.
  for (const office of ["S", "G"] as const) {
    const flips = chambers[office].flips.filter((r) => r.winner).sort((a, b) => b.margin - a.margin);
    const big = flips[0];
    if (!big || !big.winner) continue;
    const n = flips.length;
    const noun = office === "S" ? "Senate seat" : "governor's office";
    out.push({
      text: `${n === 1 ? "One" : n} ${noun}${n === 1 ? "" : "s"} changed parties, the widest in ${stateName(big.state)}, where ${big.cands[0]?.name ?? ""} flipped it by ${marginText(big.margin)} points.`,
      to: toRace(big),
    });
    break;
  }

  // 3. The House popular vote beside the seat count.
  const vote = housePopularVote(results);
  if (vote.total > 0) {
    const h = chambers.H;
    out.push({
      text: `Democrats have ${pct(vote.share.D)} of the House vote counted so far to Republicans' ${pct(vote.share.R)}, and ${secured(h, "D")} seats to ${secured(h, "R")}.`,
      to: { office: "H", state: null, district: null },
    });
  }

  // 4. The move since 2024, Senate first, once the baseline is in.
  if (baseline) {
    for (const office of ["S", "G"] as const) {
      const list = races.filter((r) => r.office === office);
      const all = officeShift(list, baseline);
      if (!all) continue;
      const s = all.shift.shift;
      const toward = s > 0 ? "D" : "R";
      const top = biggestShifts(list, baseline, toward, 1)[0];
      const where = top ? `; the biggest move was in ${stateName(top.race.state)} (${Math.abs(top.shift.shift).toFixed(1)} points)` : "";
      out.push({
        text: `Across ${all.races} ${office === "S" ? "Senate" : "governor"} races the vote ran ${Math.abs(s).toFixed(1)} points more ${s > 0 ? "Democratic" : "Republican"} than the 2024 presidential vote in the same states${where}.`,
        to: { office, state: null, district: null },
      });
      break;
    }
  }

  // 5. States electing both a senator and a governor that split them between the parties.
  const pairs = ticketPairs(races);
  const splits = pairs.filter((p) => p.split);
  if (splits.length) {
    const top = splits[0] as TicketPair;
    out.push({
      text: `${splits.length} of the ${pairs.length} states electing both a senator and a governor split them between the parties, the widest gap in ${stateName(top.state)} (Senate ${marginLabel(top.senateMargin)}, governor ${marginLabel(top.governorMargin)}).`,
      to: toRace(top.senate),
    });
  }

  // 6. The home state: its statewide race, its delegation, its questions.
  const home = races.filter((r) => r.state === HOME_STATE);
  const statewide = home.find((r) => r.office === "G" && r.winner) ?? home.find((r) => r.office === "S" && r.winner);
  const house = home.filter((r) => r.office === "H");
  const measures = home.filter((r) => r.office === "B");
  const parts: string[] = [];
  if (statewide) {
    const w = statewide.cands.find((c) => c.winner);
    if (w) parts.push(`${w.name} won the ${OFFICE_SINGULAR[statewide.office].toLowerCase()}${statewide.office === "G" ? "'s race" : " race"} by ${marginText(statewide.margin)} points`);
  }
  if (house.length) {
    const d = house.filter((r) => r.winner === "D" || r.partyDecided === "D").length;
    const r = house.filter((r) => r.winner === "R" || r.partyDecided === "R").length;
    parts.push(`the House delegation is ${d} D, ${r} R${house.length - d - r ? ` with ${house.length - d - r} still open` : ""}`);
  }
  if (measures.length) {
    const passed = measures.filter((m) => m.winner === "Y").length;
    const failed = measures.filter((m) => m.winner === "N").length;
    parts.push(`${passed} of ${measures.length} ballot question${measures.length === 1 ? "" : "s"} passed${failed ? ` and ${failed} failed` : ""}`);
  }
  if (parts.length) {
    out.push({
      text: `In ${stateName(HOME_STATE)}, ${parts.join("; ")}.`,
      to: statewide ? toRace(statewide) : { office: "H", state: HOME_STATE, district: null },
    });
  }
  return out.slice(0, 6);
}

/** The surname-only form used in short labels. */
export const shortName = lastName;
