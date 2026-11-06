// Sponsorship inventory, the WPR tracker model: a slot is a sponsor or null, and null renders an
// upsell rather than an empty hole. Flip a slot from open to sold by editing this file only.
// Sales: Chris Weber. One address, no variants.
export const SALES_EMAIL = "weber.chris@wausaupilotandreview.com";
export const CAMPAIGN = "midterm-2026";

export interface Sponsor {
  name: string;
  logo: string | null; // a file in public/sponsors/, drawn for white; null falls back to the name in Fraunces
  url: string; // the sponsor's destination; UTM tags are added on the way out
  tagline: string; // "what they offer — where they are": the em dash splits a bold line from a muted one
  address: string | null; // a street address gets a Directions chip
}

export type Slot = "title";

export const SPONSORS: Record<Slot, Sponsor | null> = {
  title: null, // the placement under the headline, above the balance of power
};

export const SLOT_LABEL: Record<Slot, string> = {
  title: "Title sponsor, 2026 midterm results",
};

/** What `?demo` shows in every open slot so sales can show a prospect their name on the live page. Never overrides a sold slot. */
export const DEMO_SPONSOR: Sponsor = {
  name: "Your Brand Here",
  logo: null,
  url: "https://wausaupilotandreview.com/",
  tagline: "Your message in front of every reader following the results — Wausau, WI",
  address: null,
};
