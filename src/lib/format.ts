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

/** AP-style Central time, e.g. "Nov. 5, 7:10 p.m. CST". */
export function centralTime(iso: string): string {
  const parts = Object.fromEntries(CENTRAL.formatToParts(new Date(iso)).map((p) => [p.type, p.value]));
  const month = AP_MONTHS[Number(parts.month) - 1];
  const meridiem = parts.dayPeriod === "AM" ? "a.m." : "p.m.";
  return `${month} ${parts.day}, ${parts.hour}:${parts.minute} ${meridiem} ${parts.timeZoneName}`;
}
