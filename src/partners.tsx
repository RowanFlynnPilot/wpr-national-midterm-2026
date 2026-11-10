// partners.html: the page a newsroom lands on to put the results on its own site. It explains what the embed is, asks
// for the few things WPR asks, builds the snippet for the chosen home state with a live preview, and offers the compact
// module too. Static apart from the preview, which is the app itself in a frame sized by its height message.
import { StrictMode, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { FooterSeal, Masthead } from "./components/Masthead";
import { compactEmbedSnippet, EMBED_ID, pageEmbedSnippet } from "./lib/embed";
import { STATE_NAME } from "./lib/states";
import { SALES_EMAIL } from "./sponsors";
import "./styles.css";
import "./partners.css";

/** Who hears from a newsroom that wants to run the page. The one address WPR gives out. */
const PARTNER_EMAIL = SALES_EMAIL;
const PHONE = "715-301-5539";

const STATES = Object.entries(STATE_NAME)
  .filter(([code]) => code !== "DC")
  .sort((a, b) => a[1].localeCompare(b[1]));

function CopyButton({ text, what }: { text: string; what: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number>();
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const copy = () =>
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setCopied(false), 2000);
    });
  return (
    <button type="button" className={copied ? "copy-snippet is-copied" : "copy-snippet"} onClick={copy} aria-live="polite">
      {copied ? "Copied" : `Copy the ${what}`}
    </button>
  );
}

function Snippet({ code, what }: { code: string; what: string }) {
  return (
    <div className="snippet">
      <pre tabIndex={0}>
        <code>{code}</code>
      </pre>
      <CopyButton text={code} what={what} />
    </div>
  );
}

/** The app in a frame, sized by the same height message the snippet listens for. */
function Preview({ src }: { src: string }) {
  const [height, setHeight] = useState(900);
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      const d = e.data as { type?: string; id?: string; height?: number };
      if (d && d.type === "wpr-embed-height" && d.id === EMBED_ID && typeof d.height === "number") setHeight(d.height);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);
  return <iframe className="preview" src={src} title="Preview of the embedded results" style={{ height }} allow="clipboard-write; web-share" loading="lazy" />;
}

function Partners() {
  const [home, setHome] = useState("");
  const appUrl = new URL("./", window.location.href).href;
  const snippet = pageEmbedSnippet(appUrl, home || null);
  const compact = compactEmbedSnippet(new URL("./compact.html", window.location.href).href);
  const homeName = home ? STATE_NAME[home] : "Wisconsin";
  return (
    <div className="app partners">
      <Masthead now={Date.now()} />
      <main>
        <section className="hero">
          <p className="kicker">
            <span className="kicker__section">For newsrooms</span>
          </p>
          <h1>Put every 2026 result on your site, with your state up front</h1>
          <p className="hero__dek">
            Wausau Pilot &amp; Review built a reader-facing explorer of every U.S. Senate, House and governor race and every
            statewide ballot measure in the Nov. 3 midterms. It refreshes several times a day while the counting goes on. Other
            newsrooms are welcome to embed it, free, with their own state in the shortcut, the glance block and the maps.
          </p>
        </section>

        <div className="partners__grid">
          <section>
            <h2 className="partners__title">What your readers get</h2>
            <ul className="partners__list">
              <li>Every race, called or still being counted, with the candidates, votes and the time of each call, refreshed several times a day from civicAPI.</li>
              <li>Your state first: a shortcut chip, an at-a-glance block of its races and questions, an outline on both maps, and a sentence about it among the things to know.</li>
              <li>A page for every county in your state, with its vote in each race and how it compares with the 2024 presidential vote.</li>
              <li>County maps, the swing since 2024, an election-night replay, a sortable table with a CSV download, and a share card for every race.</li>
              <li>It works on phones, sizes itself inside your page, and a shared link opens the right race.</li>
            </ul>
          </section>
          <section>
            <h2 className="partners__title">What we ask</h2>
            <ul className="partners__list">
              <li>Leave the masthead, the footer and the civicAPI credit as they are. The page says who made it and where the numbers come from.</li>
              <li>Introduce it as from Wausau Pilot &amp; Review where it appears, with a link to wausaupilotandreview.com.</li>
              <li>Tell us where it runs, so we can let you know when something changes or when the refresh stops after certification.</li>
              <li>Know what it is: race calls are civicAPI’s and can differ from the Associated Press, and every result is unofficial until the states certify.</li>
            </ul>
          </section>
        </div>

        <section className="partners__builder" aria-labelledby="builder-title">
          <h2 id="builder-title" className="partners__title">
            Build your snippet
          </h2>
          <label className="partners__pick">
            <span>Your state</span>
            <select value={home} onChange={(e) => setHome(e.target.value)}>
              <option value="">Wisconsin (the default)</option>
              {STATES.map(([code, name]) => (
                <option key={code} value={code}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <p className="partners__note">
            Paste this into a WordPress Custom HTML block, or anywhere your site accepts HTML. The frame sets its own height, and the
            page inside it opens on {homeName}’s shortcut.
          </p>
          <Snippet code={snippet} what="snippet" />
          <h3 className="partners__subtitle">Preview</h3>
          <Preview src={home ? `${appUrl}?home=${home}` : appUrl} />
        </section>

        <section className="partners__also" aria-labelledby="also-title">
          <h2 id="also-title" className="partners__title">
            Smaller pieces
          </h2>
          <p className="partners__note">
            The balance of power alone, for a homepage module or a sidebar: four cards, the first three things to know and the latest
            calls, laid out one, two or four across to fit the space.
          </p>
          <Snippet code={compact} what="module snippet" />
          <p className="partners__note">
            For one race in an article, open that race on the full page and use “Embed this race in an article” under the card: it copies
            a snippet for that race alone.
          </p>
        </section>

        <section className="partners__contact">
          <h2 className="partners__title">Questions</h2>
          <p>
            <a href={`mailto:${PARTNER_EMAIL}?subject=${encodeURIComponent("Embedding the 2026 midterm results")}`}>{PARTNER_EMAIL}</a> · {PHONE}
          </p>
        </section>
      </main>
      <footer className="sources">
        <FooterSeal />
        <div className="sources__text">
          <p>
            Results and race calls from <a href="https://civicapi.org">civicAPI</a>, refreshed several times a day. Map boundaries from the U.S. Census Bureau via
            us-atlas; county demographics from the 2017–2021 American Community Survey; the 2024 presidential vote from the MIT Election Data and
            Science Lab (CC0). Not affiliated with or endorsed by civicAPI, the Associated Press or any election authority.
          </p>
          <p className="sources__paper">
            <a href="https://wausaupilotandreview.com/">Wausau Pilot &amp; Review</a> · {PHONE}
          </p>
        </div>
      </footer>
    </div>
  );
}

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("missing #root");
createRoot(rootEl).render(
  <StrictMode>
    <Partners />
  </StrictMode>,
);
