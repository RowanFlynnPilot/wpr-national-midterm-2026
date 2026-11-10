// Inside the WordPress embed the tool's own URL means nothing to a reader, so the
// embed snippet passes the article URL as ?host=… and a shared link is the article
// plus the view hash. Standalone, it's this page. Only the publisher's own domain is
// accepted as a host. Same rules as wpr-auto-loan.
export const PUBLISHER = /(^|\.)wausaupilotandreview\.com$/;

export function isPublisher(url: URL): boolean {
  return url.protocol === "https:" && PUBLISHER.test(url.hostname);
}

export function shareUrl(search: string, hash: string, href: string): string {
  const host = new URLSearchParams(search).get("host");
  if (host === null) {
    const url = new URL(href);
    url.hash = hash;
    return url.toString();
  }
  const url = new URL(host);
  if (!isPublisher(url)) throw new Error(`Refusing share host ${host}`);
  url.hash = hash;
  return url.toString();
}

/**
 * The link "Share this race" hands out: the race's stub page (s/<hash>.html, built with the race's own card in its meta
 * tags), carrying the article URL as ?to= when the page is embedded so the stub sends the reader on to the article.
 */
export function raceShareUrl(search: string, hash: string, href: string): string {
  const url = new URL(`./s/${hash}.html`, href);
  const host = new URLSearchParams(search).get("host");
  if (host !== null) {
    const article = new URL(host);
    if (!isPublisher(article)) throw new Error(`Refusing share host ${host}`);
    url.searchParams.set("to", article.toString());
  }
  return url.toString();
}

/** Three hours. The results workflow asks for an hourly run, but GitHub starts it every 4 to 11 hours, so between runs the page says when it was last fetched. */
export const STALE_AFTER_MS = 3 * 60 * 60 * 1000;

export function isStale(fetchedIso: string, now: number): boolean {
  return now - Date.parse(fetchedIso) > STALE_AFTER_MS;
}
