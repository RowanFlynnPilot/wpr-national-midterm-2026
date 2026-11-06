import { useEffect, useRef, useState } from "react";
import { shareUrl } from "../lib/share";

type State = "idle" | "copied" | "failed";

/** Copies a link to the current view: the article URL when embedded, this page otherwise. */
export function CopyLink({ hash }: { hash: string }) {
  const [state, setState] = useState<State>("idle");
  const timer = useRef<number>();
  const link = () => shareUrl(window.location.search, `#${hash}`, window.location.href);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const copy = () => {
    window.clearTimeout(timer.current);
    navigator.clipboard.writeText(link()).then(
      () => {
        setState("copied");
        timer.current = window.setTimeout(() => setState("idle"), 2000);
      },
      () => setState("failed"),
    );
  };

  if (state === "failed") {
    return (
      <span className="copy-link copy-link--failed" role="status">
        <span>Couldn’t copy. The link is</span>
        <input readOnly value={link()} aria-label="Link to this view" onFocus={(e) => e.currentTarget.select()} />
      </span>
    );
  }
  return (
    <button type="button" className={`copy-link${state === "copied" ? " is-copied" : ""}`} onClick={copy} aria-live="polite">
      <svg viewBox="0 0 16 16" aria-hidden="true">
        {state === "copied" ? (
          <path d="M3.5 8.5l3 3 6-7" />
        ) : (
          <>
            <path d="M6.5 9.5a2.5 2.5 0 0 0 3.5 0l2.5-2.5a2.5 2.5 0 0 0-3.5-3.5L8 4.5" />
            <path d="M9.5 6.5a2.5 2.5 0 0 0-3.5 0L3.5 9a2.5 2.5 0 0 0 3.5 3.5L8 11.5" />
          </>
        )}
      </svg>
      {state === "copied" ? "Link copied" : "Copy link"}
    </button>
  );
}
