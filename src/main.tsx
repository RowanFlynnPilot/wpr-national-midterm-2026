import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { Masthead } from "./components/Masthead";
import { loadData } from "./lib/data";
import { initEmbedHeight } from "./lib/embed";
import "./styles.css";

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("missing #root");
const root = createRoot(rootEl);

// The flag paints first, before any data; the results replace only the line beneath it.
const shell = (line: React.ReactNode) => (
  <div className="app">
    <Masthead now={Date.now()} />
    {line}
  </div>
);

initEmbedHeight();
root.render(shell(<p className="loading">Loading results…</p>));
loadData()
  .then((data) =>
    root.render(
      <StrictMode>
        <App data={data} />
      </StrictMode>,
    ),
  )
  .catch((err: Error) => root.render(shell(<p className="load-error">The results could not be loaded. {err.message}</p>)));
