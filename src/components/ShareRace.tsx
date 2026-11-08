import { useEffect, useRef, useState } from "react";
import { raceDistrict, toHash } from "../lib/route";
import { raceShareUrl } from "../lib/share";
import { statusText } from "../lib/status";
import { raceTitle } from "../lib/summary";
import type { Race } from "../lib/types";

type State = "idle" | "copied" | "failed";

/**
 * Share one race: the device's share sheet where there is one, else the link is copied. The link is the race's stub page
 * (s/<hash>.html, with its own card image), which sends the reader on to the article when the page is embedded. Beside
 * it, the card image itself to save and post.
 */
export function ShareRace({ race }: { race: Race }) {
  const [state, setState] = useState<State>("idle");
  const timer = useRef<number>();
  const hash = toHash({ office: race.office, state: race.state, district: raceDistrict(race) });
  const link = () => raceShareUrl(window.location.search, hash, window.location.href);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const copy = (url: string) => {
    window.clearTimeout(timer.current);
    navigator.clipboard.writeText(url).then(
      () => {
        setState("copied");
        timer.current = window.setTimeout(() => setState("idle"), 2000);
      },
      () => setState("failed"),
    );
  };

  const share = async () => {
    const url = link();
    if (navigator.share) {
      try {
        await navigator.share({ title: `${raceTitle(race)}: 2026 result`, text: statusText(race), url });
        return;
      } catch (e) {
        if ((e as Error).name === "AbortError") return; // the reader closed the sheet
      }
    }
    copy(url); // no share sheet (a desktop browser, or an iframe without web-share): the link goes to the clipboard
  };

  return (
    <>
      {state === "failed" ? (
        <span className="share-race-link share-race-link--failed" role="status">
          <span>Couldn’t copy. The link is</span>
          <input readOnly value={link()} aria-label="Link to this race" onFocus={(e) => e.currentTarget.select()} />
        </span>
      ) : (
        <button type="button" className={`share-race-link${state === "copied" ? " is-copied" : ""}`} onClick={share} aria-live="polite">
          <svg viewBox="0 0 16 16" aria-hidden="true">
            {state === "copied" ? <path d="M3.5 8.5l3 3 6-7" /> : <path d="M8 10V2.5M5 5l3-3 3 3M3.5 8.5v4.5h9V8.5" />}
          </svg>
          {state === "copied" ? "Link copied" : "Share this race"}
        </button>
      )}
      <a className="share-race-link share-race-link--image" href={`./share/${hash}.jpg`} download={`${hash}-2026-result.jpg`}>
        Save image
      </a>
    </>
  );
}
