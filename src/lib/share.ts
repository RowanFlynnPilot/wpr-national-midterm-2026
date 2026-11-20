// Inside the WordPress embed the tool's own URL means nothing to a reader, so the
// embed snippet passes the article URL as ?host=… and a shared link is the article
// plus the view hash. Standalone, it's this page. Only the selected newsroom's own
// domain (src/newsrooms.ts) is accepted as a host. Same rules as wpr-auto-loan.
import { OWNER } from "../newsrooms";
import { newsroom, onSite } from "./newsroom";

export function shareUrl(search: string, hash: string, href: string): string {
  const room = newsroom(search);
  const params = new URLSearchParams(search);
  const host = params.get("host");
  if (host === null) {
    const url = new URL(href);
    // A link built from a bare page URL (the module's and the race embed's links to the full page) keeps the newsroom and its state.
    for (const key of ["partner", "home"]) {
      const value = params.get(key);
      if (value !== null) url.searchParams.set(key, value);
    }
    url.hash = hash;
    return url.toString();
  }
  const url = new URL(host);
  if (!onSite(url, room)) throw new Error(`Refusing share host ${host}`);
  url.hash = hash;
  return url.toString();
}

/**
 * The link "Share this race" hands out: the race's stub page (s/<hash>.html, built with the race's own card in its meta
 * tags), carrying the article URL as ?to= when the page is embedded so the stub sends the reader on to the article, and
 * a partner's slug as ?partner= so a reader sent on to the app lands on that newsroom's page.
 */
export function raceShareUrl(search: string, hash: string, href: string): string {
  const room = newsroom(search);
  const url = new URL(`./s/${hash}.html`, href);
  if (room.slug !== OWNER) url.searchParams.set("partner", room.slug);
  const host = new URLSearchParams(search).get("host");
  if (host !== null) {
    const article = new URL(host);
    if (!onSite(article, room)) throw new Error(`Refusing share host ${host}`);
    url.searchParams.set("to", article.toString());
  }
  return url.toString();
}

/** Twelve hours. The results workflow asks for an hourly run and GitHub starts it every 4 to 11 hours, so the notice means a run was missed, not that the page is between runs. */
export const STALE_AFTER_MS = 12 * 60 * 60 * 1000;

export function isStale(fetchedIso: string, now: number): boolean {
  return now - Date.parse(fetchedIso) > STALE_AFTER_MS;
}
