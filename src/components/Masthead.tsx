// WPR's flag, Follow the Money arrangement: seal and wordmark as one centered lockup linking home,
// the tagline beneath, then the dateline, all inside the thick-over-thin newspaper rule.
const WPR_URL = "https://wausaupilotandreview.com/";

const LONG_DATE = new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", weekday: "long", month: "long", day: "numeric", year: "numeric" });

export function Masthead({ now }: { now: number }) {
  return (
    <header className="flag">
      <a className="flag__lockup" href={WPR_URL} target="_blank" rel="noopener noreferrer" aria-label="Wausau Pilot & Review home">
        <img className="flag__badge" src="./brand/wpr-typewriter-badge.png" alt="" width={62} height={62} decoding="async" />
        <img className="flag__wordmark" src="./brand/wpr-wordmark.png" alt="Wausau Pilot & Review" width={640} height={82} decoding="async" />
      </a>
      <p className="flag__tagline">Where Locals Look First For News</p>
      <div className="flag__dateline">
        <span>{LONG_DATE.format(new Date(now))}</span>
        <span className="flag__place">Wausau, Wisconsin</span>
      </div>
    </header>
  );
}

/** The seal at footer size, beside the provenance block. */
export function FooterSeal() {
  return <img className="sources__badge" src="./brand/wpr-typewriter-badge.png" alt="" width={44} height={44} loading="lazy" decoding="async" />;
}
