// Standard WPR iframe pattern (as in wpr-auto-loan and wpr-tip-desk): post the document
// height to the parent page whenever it changes so the WordPress embed can size the
// iframe, with no scrollbar inside a scrollbar. Only the height crosses the frame
// boundary, so "*" as target origin is fine; the parent checks origin. The listener
// snippet is in CLAUDE.md under "WordPress embed".
export const EMBED_ID = "wpr-national-midterm-2026";

export const isEmbedded = (): boolean => window.parent !== window;

export function initEmbedHeight(id: string = EMBED_ID): void {
  if (!isEmbedded()) return;

  let last = 0;
  const post = () => {
    // body.scrollHeight, not documentElement's: the latter is clamped to the viewport,
    // so the iframe could never shrink.
    const height = Math.ceil(document.body.scrollHeight);
    if (height === last) return;
    last = height;
    window.parent.postMessage({ type: "wpr-embed-height", id, height }, "*");
  };

  new ResizeObserver(post).observe(document.body);
  window.addEventListener("load", post);
  post();
  // ResizeObserver rides the rendering loop, which background tabs don't run, and
  // React's first commit can land after load: post on a short timer too.
  for (const ms of [200, 800, 2000]) setTimeout(post, ms);
}

const attr = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
const js = (s: string) => s.replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/</g, "\\x3c");

/**
 * The WordPress snippet for one race (race.html at a view hash): its own container and height-message id, so several
 * races can share an article, the article URL passed as ?host= for the link out, and the publisher origin checked.
 */
export function raceEmbedSnippet(slug: string, title: string, raceHtml: string): string {
  const id = `${EMBED_ID}-race-${slug}`;
  const origin = new URL(raceHtml).origin;
  return [
    `<div id="${id}"></div>`,
    "<script>",
    "(function () {",
    "  var f = document.createElement('iframe');",
    `  f.src = '${js(raceHtml)}?host=' + encodeURIComponent(location.origin + location.pathname) + '#${js(slug)}';`,
    "  f.style.cssText = 'width:100%;border:0;min-height:520px';",
    "  f.allow = 'clipboard-write';",
    `  f.title = '${js(attr(title))}: 2026 result';`,
    "  window.addEventListener('message', function (e) {",
    `    if (e.origin !== '${js(origin)}') return;`,
    `    if (e.data && e.data.type === 'wpr-embed-height' && e.data.id === '${js(id)}') f.style.height = e.data.height + 'px';`,
    "  });",
    `  document.getElementById('${js(id)}').appendChild(f);`,
    "})();",
    "</script>",
  ].join("\n");
}

