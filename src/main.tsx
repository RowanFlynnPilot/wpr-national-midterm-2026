import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { loadData } from "./lib/data";
import { initEmbedHeight } from "./lib/embed";
import "./styles.css";

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("missing #root");
const root = createRoot(rootEl);

initEmbedHeight();
root.render(<p className="loading">Loading results…</p>);
loadData()
  .then((data) =>
    root.render(
      <StrictMode>
        <App data={data} />
      </StrictMode>,
    ),
  )
  .catch((err: Error) => root.render(<p className="load-error">The results could not be loaded. {err.message}</p>));
