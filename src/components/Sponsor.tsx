import { useEffect, useRef, useState } from "react";
import { CAMPAIGN, DEMO_SPONSOR, SALES_EMAIL, SLOT_LABEL, SPONSORS, type Slot, type Sponsor } from "../sponsors";

export const isDemo = () => new URLSearchParams(window.location.search).has("demo");

/** The sponsor to show in a slot: the sold one, the demo placeholder under ?demo, else null (an open slot). */
export function sponsorFor(slot: Slot): Sponsor | null {
  return SPONSORS[slot] ?? (isDemo() ? DEMO_SPONSOR : null);
}

const outbound = (url: string, slot: Slot) => {
  const u = new URL(url);
  u.searchParams.set("utm_source", "wausaupilotandreview");
  u.searchParams.set("utm_medium", "widget");
  u.searchParams.set("utm_campaign", CAMPAIGN);
  u.searchParams.set("utm_content", slot);
  return u.toString();
};

const mapsUrl = (address: string) =>
  /iPhone|iPad|Macintosh/.test(navigator.userAgent)
    ? `https://maps.apple.com/?q=${encodeURIComponent(address)}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;

/** A sold placement: a white card marked on top, "Presented by", the logo or name, the tagline split at the em dash. */
export function SponsorLockup({ slot, sponsor }: { slot: Slot; sponsor: Sponsor }) {
  const [offer, where] = sponsor.tagline.split(/\s[—–]\s/);
  return (
    <a className="sponsor" data-slot={slot} href={outbound(sponsor.url, slot)} target="_blank" rel="noopener noreferrer sponsored">
      <span className="sponsor__eyebrow">Presented by</span>
      {sponsor.logo ? (
        <img className="sponsor__logo" src={`./sponsors/${sponsor.logo}`} alt={sponsor.name} height={50} decoding="async" />
      ) : (
        <span className="sponsor__name">{sponsor.name}</span>
      )}
      <span className="sponsor__tagline">
        <strong>{offer}</strong>
        {where && <span className="sponsor__where">{where}</span>}
      </span>
      {sponsor.address && (
        // the card is already a link; a nested anchor is invalid, so the chip is a button-role span
        <span
          className="sponsor__chip"
          role="button"
          tabIndex={0}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            window.open(mapsUrl(sponsor.address as string), "_blank", "noopener");
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              e.stopPropagation();
              window.open(mapsUrl(sponsor.address as string), "_blank", "noopener");
            }
          }}
        >
          Directions
        </span>
      )}
    </a>
  );
}

/** An open placement: the ask first, a button, the address beneath; the mailto also copies the address. */
export function OpenSlot({ slot }: { slot: Slot }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number>();
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const subject = encodeURIComponent(`Sponsorship: ${SLOT_LABEL[slot]}`);
  const copy = () => {
    // A desktop with no mail handler does nothing on a mailto: click; the copy confirms something happened.
    navigator.clipboard?.writeText(SALES_EMAIL).then(() => {
      setCopied(true);
      timer.current = window.setTimeout(() => setCopied(false), 2500);
    }, () => undefined);
  };
  return (
    <aside className="sponsor sponsor--open" data-slot={slot} aria-labelledby={`slot-${slot}`}>
      <span className="sponsor__eyebrow" id={`slot-${slot}`}>
        Sponsorship available
      </span>
      <p className="sponsor__pitch">Reach Wisconsin readers following every race in the country.</p>
      <a className="sponsor__book" href={`mailto:${SALES_EMAIL}?subject=${subject}`} onClick={copy}>
        Book this placement →
      </a>
      <span className="sponsor__email" aria-live="polite">
        {copied ? "✓ Address copied" : SALES_EMAIL}
      </span>
    </aside>
  );
}

/** The title slot: the lockup when sold (or in demo), the upsell when open. */
export function TitleSlot() {
  const sponsor = sponsorFor("title");
  return sponsor ? <SponsorLockup slot="title" sponsor={sponsor} /> : <OpenSlot slot="title" />;
}

/** Under ?demo: a ribbon so a forwarded demo link explains itself. */
export function DemoRibbon() {
  if (!isDemo()) return null;
  return (
    <p className="demo-ribbon" role="status">
      Sales preview: open placements show a placeholder.{" "}
      <a href={`mailto:${SALES_EMAIL}?subject=${encodeURIComponent("Sponsorship: 2026 midterm results")}`}>Ask about sponsoring this page</a>
    </p>
  );
}
