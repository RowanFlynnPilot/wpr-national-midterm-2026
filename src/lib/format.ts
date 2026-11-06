const WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"];

/** AP style: spell out one through nine. */
export function apNumber(n: number): string {
  return n >= 0 && n < 10 ? (WORDS[n] as string) : n.toLocaleString("en-US");
}

export const votes = (n: number) => n.toLocaleString("en-US");
export const pct = (n: number) => `${n.toFixed(1)}%`;

export function marginText(points: number): string {
  return points < 0.1 ? "<0.1" : points.toFixed(1);
}

const AP_MONTHS = ["Jan.", "Feb.", "March", "April", "May", "June", "July", "Aug.", "Sept.", "Oct.", "Nov.", "Dec."];
const CENTRAL = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Chicago",
  month: "numeric",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZoneName: "short",
});

/** "just now", "12 min. ago", "3 hr. ago"; null once a day has passed. */
export function relativeAge(iso: string, now: number): string | null {
  const min = Math.floor((now - Date.parse(iso)) / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} min. ago`;
  if (min < 24 * 60) return `${Math.floor(min / 60)} hr. ago`;
  return null;
}

/** relativeAge, or beyond a day the AP-style Central time without the zone. */
export function timeAgo(iso: string, now: number): string {
  return relativeAge(iso, now) ?? centralTime(iso, false);
}

/** AP-style Central time, e.g. "Nov. 5, 7:10 p.m. CST". */
export function centralTime(iso: string, zone = true): string {
  const parts = Object.fromEntries(CENTRAL.formatToParts(new Date(iso)).map((p) => [p.type, p.value]));
  const month = AP_MONTHS[Number(parts.month) - 1];
  const meridiem = parts.dayPeriod === "AM" ? "a.m." : "p.m.";
  return `${month} ${parts.day}, ${parts.hour}:${parts.minute} ${meridiem}${zone ? ` ${parts.timeZoneName}` : ""}`;
}
