import { OFFICE_SLUG } from "./summary";
import type { Office, Selection } from "./types";

const OFFICE_BY_SLUG: Record<string, Office> = Object.fromEntries(Object.entries(OFFICE_SLUG).map(([o, s]) => [s, o as Office]));

/** "#house-wi-03" -> { H, WI, "WI-03" }; "#measures-wi-179849" -> { B, WI, "WI-179849" }; "#senate-tx" -> { S, TX, null }; "" -> the Senate overview. */
export function parseHash(hash: string): Selection {
  const [slug = "", st, dist] = hash.replace(/^#/, "").toLowerCase().split("-");
  const office = OFFICE_BY_SLUG[slug] ?? "S";
  const state = st && /^[a-z]{2}$/.test(st) ? st.toUpperCase() : null;
  const district = (office === "H" || office === "B") && state && dist ? `${state}-${dist.toUpperCase()}` : null; // a measure's key is its id
  return { office, state, district };
}

/** The inverse, without the "#". */
export function toHash({ office, state, district }: Selection): string {
  return [OFFICE_SLUG[office], state?.toLowerCase(), district?.split("-")[1]?.toLowerCase()].filter(Boolean).join("-");
}
