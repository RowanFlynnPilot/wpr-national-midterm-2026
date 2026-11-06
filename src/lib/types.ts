export type Party = "D" | "R" | "I" | "O";
export type Office = "S" | "H" | "G";

export interface Candidate {
  name: string;
  party: Party;
  partyName: string;
  votes: number;
  pct: number;
  winner: boolean;
  advanced: boolean; // finalist in a runoff
}

export interface Race {
  id: number;
  office: Office;
  state: string;
  district: string | null;
  num: number | null;
  special: boolean;
  pctIn: number;
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

export interface Results {
  updated: string;
  fetched: string;
  baselines: {
    senate: { before: { D: number; R: number }; not_up: { D: number; R: number } };
    governor: { before: { D: number; R: number }; not_up: { D: number; R: number } };
    house: { before: { D: number; R: number } };
  };
  races: Race[];
}

/** raceId -> county FIPS -> [pctReporting, votes for race.cands[0..2] (non-"Others"), all other votes] */
export type CountyResults = Record<string, Record<string, number[]>>;

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
}
