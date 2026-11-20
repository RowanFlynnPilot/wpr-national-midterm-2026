import { NEWSROOMS, OWNER, type Newsroom } from "../newsrooms";
import { stateCode } from "./states";

export interface Selected extends Newsroom {
  slug: string;
}

/**
 * The newsroom this page is running for: ?partner=<slug> picks one from the registry (src/newsrooms.ts) and no parameter
 * means the owner. ?home=<postal code> moves the home state of whichever is picked, which is also how a newsroom that is
 * not registered embeds the owner's page around its own state. An unknown slug or state is a setup error and fails the page.
 */
export function newsroom(search: string): Selected {
  const params = new URLSearchParams(search);
  const slug = params.get("partner") ?? OWNER;
  const room = Object.hasOwn(NEWSROOMS, slug) ? NEWSROOMS[slug] : undefined;
  if (!room) throw new Error(`unknown partner ${slug}`);
  const home = params.get("home");
  return { ...room, slug, home: home === null ? room.home : stateCode(home) };
}

export const NEWSROOM = newsroom(typeof location === "undefined" ? "" : location.search);

/**
 * The home state drives a toolbar shortcut, a resting outline on both maps, the "at a glance" block on every overview
 * panel, the outlined districts on the House margin strip and the last "thing to know".
 */
export const HOME_STATE = NEWSROOM.home;

/** Whether the page is running for a newsroom other than its owner. */
export const IS_PARTNER = NEWSROOM.slug !== OWNER;

/** Whether a URL is on a newsroom's own site: https, and its domain or a subdomain of it. */
export function onSite(url: URL, room: Newsroom): boolean {
  return url.protocol === "https:" && (url.hostname === room.domain || url.hostname.endsWith(`.${room.domain}`));
}

/**
 * One pattern matching a hostname on any registered newsroom's domain, for the race share stubs: they are static pages
 * and cannot know which newsroom sent the reader, so they accept an article on any site in the registry and no other.
 */
export function sitesPattern(): string {
  const domains = [...new Set(Object.values(NEWSROOMS).map((n) => n.domain))];
  return `(^|\\.)(${domains.map((d) => d.replace(/\./g, "\\.")).join("|")})$`;
}
