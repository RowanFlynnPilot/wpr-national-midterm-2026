import { useEffect, useRef, useState } from "react";
import { raceEmbedSnippet } from "../lib/embed";
import { raceDistrict, toHash } from "../lib/route";
import { raceTitle } from "../lib/summary";
import type { Race } from "../lib/types";

type State = "idle" | "copied" | "failed";

/** Copies the WordPress snippet that embeds this one race in an article (race.html). For the newsroom, not readers. */
export function EmbedRace({ race }: { race: Race }) {
  const [state, setState] = useState<State>("idle");
  const timer = useRef<number>();
  const slug = toHash({ office: race.office, state: race.state, district: raceDistrict(race) });
  const snippet = () => raceEmbedSnippet(slug, raceTitle(race), new URL("./race.html", window.location.href).href);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const copy = () => {
    window.clearTimeout(timer.current);
    navigator.clipboard.writeText(snippet()).then(
      () => {
        setState("copied");
        timer.current = window.setTimeout(() => setState("idle"), 2500);
      },
      () => setState("failed"),
    );
  };

  if (state === "failed") {
    return (
      <div className="embed-race embed-race--failed" role="status">
        <span>Couldn’t copy. The snippet is</span>
        <textarea readOnly value={snippet()} rows={4} aria-label="Embed snippet for this race" onFocus={(e) => e.currentTarget.select()} />
      </div>
    );
  }
  return (
    <button type="button" className={`embed-race${state === "copied" ? " is-copied" : ""}`} onClick={copy} aria-live="polite">
      {state === "copied" ? "Snippet copied: paste it into a WordPress HTML block" : "Embed this race in an article"}
    </button>
  );
}
