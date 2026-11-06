// Inside the WordPress embed the tool's own URL means nothing to a reader, so the
// embed snippet passes the article URL as ?host=… and a shared link is the article
// plus the view hash. Standalone, it's this page. Only the publisher's own domain is
// accepted as a host. Same rules as wpr-auto-loan.
const PUBLISHER = /(^|\.)wausaupilotandreview\.com$/;

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

/** Three hours: the results workflow runs hourly, so anything older means the feed or the deploy has stalled. */
export const STALE_AFTER_MS = 3 * 60 * 60 * 1000;

export function isStale(fetchedIso: string, now: number): boolean {
  return now - Date.parse(fetchedIso) > STALE_AFTER_MS;
}
