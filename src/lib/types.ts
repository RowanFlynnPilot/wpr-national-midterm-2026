/** D/R/I/O for candidates; Y/N are the answers on a ballot measure. */
export type Party = "D" | "R" | "I" | "O" | "Y" | "N";
/** Senate, House, governor; B is a statewide ballot measure. */
export type Office = "S" | "H" | "G" | "B";

export interface Candidate {
  id: number; // civicAPI candidate_id; 0 for the "Others" bucket
  name: string;
  photo: string | null; // file in public/headshots, resolved by scripts/headshots.mjs
  party: Party;
  partyName: string;
  votes: number;
  pct: number;
  winner: boolean;
  advanced: boolean; // finalist in a runoff
}

/** A measure's pass rule beyond a plain majority (pipeline/measure-rules.json): the share Yes needs, how to print it, the sentence for the card. */
export interface MeasureRule {
  needs: number;
  label: string; // "60%", "two-thirds"
  text: string;
}

export interface Race {
  id: number;
  office: Office;
  state: string;
  district: string | null; // "WI-03"; for a measure, "<state>-<civicAPI id>" (its route)
  num: number | null;
  title: string | null; // a measure's name, e.g. "Wisconsin Question 3 - ..."; null for candidate races
  rule: MeasureRule | null; // measures only; null when a plain majority passes it
  recount: string | null; // the state's recount rule in a sentence (pipeline/key-dates.json); null for measures and states without one
  undone?: true; // set by a replay on a race whose call it has undone (src/lib/replay.ts): its numbers are today's
  special: boolean;
  pctIn: number;
  updated: string; // civicAPI's last_updated for this race
  calledAt: string | null;
  winner: Party | null;
  leader: Party;
  prior: Party | null;
  flip: boolean | null;
  runoff: boolean; // no winner; top two go to a later runoff
  unopposed: boolean; // one candidate on the ballot (write-ins aside)
  partyDecided: Party | null; // both finalists from one party, winner not yet called
  margin: number;
  marginVotes: number;
  total: number;
  cands: Candidate[];
}

/** One step of the count still ahead in a state (pipeline/key-dates.json): a calendar day, or a span when `end` is set. */
export interface KeyDate {
  date: string; // ISO day, e.g. "2026-11-18"
  end?: string;
  state: string;
  offices?: Office[]; // the tabs it belongs to; absent means every office the state still has open
  text: string;
}

export interface Results {
  updated: string;
  fetched: string;
  baselines: {
    senate: { before: { D: number; R: number }; not_up: { D: number; R: number } };
    governor: { before: { D: number; R: number }; not_up: { D: number; R: number } };
    house: { before: { D: number; R: number } };
  };
  dates: KeyDate[]; // in (date, state) order
  races: Race[];
}

/** raceId -> county FIPS -> [pctReporting, votes for race.cands[0..2] (non-"Others"), all other votes] */
export type CountyResults = Record<string, Record<string, number[]>>;

export interface CountySets {
  S: CountyResults;
  G: CountyResults;
  B: CountyResults;
  H: CountyResults; // a district's part of each county it covers
}

export interface HexCell {
  d: string;
  st: string;
  q: number;
  r: number;
}

export interface Selection {
  office: Office;
  state: string | null;
  district: string | null;
  county?: string; // a county FIPS within the state, on the Senate, governor and House views: the county's own page
}
