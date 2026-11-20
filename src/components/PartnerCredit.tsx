import { IS_PARTNER, NEWSROOM } from "../lib/newsroom";
import { WPR } from "../newsrooms";

/** On a partner's page: whose readers the results are for and who made them. The owner's own page carries no such line. */
export function PartnerCredit() {
  if (!IS_PARTNER) return null;
  return (
    <p className="partner-credit">
      Results for readers of{" "}
      <a href={NEWSROOM.site} target="_blank" rel="noopener noreferrer">
        {NEWSROOM.name}
      </a>
      , from {WPR.name}
    </p>
  );
}
