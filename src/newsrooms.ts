// The newsrooms this page runs for. Wausau Pilot & Review made it and is the default; another newsroom is selected with
// ?partner=<slug>. A slug that is not in this file fails the page at load, so only a newsroom added here gets a sponsor
// slot, a sales address and a share domain of its own. None of those may ride in a URL, where anyone could forge them.
// To add a partner: add an entry (slug in lowercase letters, digits and hyphens), put its sponsor's logo, if any, in
// public/sponsors/, commit. To sell a slot: fill in that newsroom's `sponsors.title`.
import type { Slot, Sponsor } from "./sponsors";

export interface Newsroom {
  name: string; // as it reads in "Results for readers of …"
  site: string; // its home page, https
  domain: string; // the only place a share link may send a reader: this host and its subdomains
  home: string; // postal code of its state; ?home= moves it
  place: string; // where its readers are, as a sponsor's line gives it: "Wausau, WI"
  salesEmail: string; // where "Book this placement" and "Advertise on this page" go
  utmSource: string; // utm_source on its sponsors' links
  sponsors: Record<Slot, Sponsor | null>; // null renders the open-slot upsell rather than an empty hole
}

export const OWNER = "wpr";

export const WPR: Newsroom = {
  name: "Wausau Pilot & Review",
  site: "https://wausaupilotandreview.com/",
  domain: "wausaupilotandreview.com",
  home: "WI",
  place: "Wausau, WI",
  salesEmail: "chris.weber@wausaupilotandreview.com", // Chris Weber. One address, no variants.
  utmSource: "wausaupilotandreview",
  sponsors: {
    title: null, // the placement under the headline, above the balance of power
  },
};

export const NEWSROOMS: Record<string, Newsroom> = {
  [OWNER]: WPR,
  // The sales preview of a partner's page: a stand-in name over WPR's own contacts, so a prospect who clicks through
  // reaches WPR. Show it with ?partner=demo&home=<their state>, and add &demo to fill the open sponsor slot.
  demo: {
    ...WPR,
    name: "Your Newsroom",
    place: "Your city",
  },
};
