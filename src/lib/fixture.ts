// Test fixture: 19 real races frozen from civicAPI on Nov. 5, 2026, chosen to cover every status rule.
import fixture from "./__fixtures__/races.json";
import type { Office, Race, Results } from "./types";

export const RESULTS = fixture as Results;

/** A race by its district ("WI-03"), a measure by its route ("WI-179849"), or a statewide race by its state ("TX"). */
export function race(office: Office, key: string): Race {
  const r = RESULTS.races.find((x) => x.office === office && (office === "H" || office === "B" ? x.district : x.state) === key);
  if (!r) throw new Error(`fixture has no ${office} race ${key}`);
  return r;
}
