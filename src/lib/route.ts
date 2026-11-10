import { FIPS_BY_CODE } from "./states";
import { OFFICE_SLUG } from "./summary";
import type { Office, Race, Selection } from "./types";

const OFFICE_BY_SLUG: Record<string, Office> = Object.fromEntries(Object.entries(OFFICE_SLUG).map(([o, s]) => [s, o as Office]));

/**
 * "#house-wi-03" -> { H, WI, "WI-03" }; "#measures-wi-179849" -> { B, WI, "WI-179849" }; "#senate-tx" -> { S, TX, null };
 * "#governors-wi-55073" and "#house-in-18097" -> { office, state, null, county } (a county FIPS inside the state; no House
 * district number has five digits); "" -> the Senate overview.
 */
export function parseHash(hash: string): Selection {
  const [slug = "", st, dist] = hash.replace(/^#/, "").toLowerCase().split("-");
  const office = OFFICE_BY_SLUG[slug] ?? "S";
  const state = st && /^[a-z]{2}$/.test(st) ? st.toUpperCase() : null;
  const county = office !== "B" && state && dist && /^\d{5}$/.test(dist) && dist.slice(0, 2) === FIPS_BY_CODE[state] ? dist : undefined;
  const district = (office === "H" || office === "B") && state && dist && !county ? `${state}-${dist.toUpperCase()}` : null; // a measure's key is its id
  return county ? { office, state, district, county } : { office, state, district };
}

/** The inverse, without the "#". */
export function toHash({ office, state, district, county }: Selection): string {
  return [OFFICE_SLUG[office], state?.toLowerCase(), district?.split("-")[1]?.toLowerCase() ?? county].filter(Boolean).join("-");
}

/** The race a selection names, or null for an overview, a state list or an unknown race. */
export function raceFor(races: Race[], sel: Selection): Race | null {
  if (!sel.state) return null;
  return races.find((r) => r.office === sel.office && r.state === sel.state && (sel.office === "H" || sel.office === "B" ? r.district === sel.district : true)) ?? null;
}

/** The district key a race's own view needs: a House district or a measure carries it, a statewide race does not. */
export const raceDistrict = (r: Race): string | null => (r.office === "H" || r.office === "B" ? r.district : null);
