// Standard WPR iframe pattern (as in wpr-auto-loan and wpr-tip-desk): post the document
// height to the parent page whenever it changes so the WordPress embed can size the
// iframe, with no scrollbar inside a scrollbar. Only the height crosses the frame
// boundary, so "*" as target origin is fine; the parent checks origin. The listener
// snippet is in CLAUDE.md under "WordPress embed".
export const EMBED_ID = "wpr-national-midterm-2026";

export const isEmbedded = (): boolean => window.parent !== window;

export function initEmbedHeight(): void {
  if (!isEmbedded()) return;

  let last = 0;
  const post = () => {
    // body.scrollHeight, not documentElement's: the latter is clamped to the viewport,
    // so the iframe could never shrink.
    const height = Math.ceil(document.body.scrollHeight);
    if (height === last) return;
    last = height;
    window.parent.postMessage({ type: "wpr-embed-height", id: EMBED_ID, height }, "*");
  };

  new ResizeObserver(post).observe(document.body);
  window.addEventListener("load", post);
  post();
  // ResizeObserver rides the rendering loop, which background tabs don't run, and
  // React's first commit can land after load: post on a short timer too.
  for (const ms of [200, 800, 2000]) setTimeout(post, ms);
}
