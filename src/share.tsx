import { createRoot } from "react-dom/client";
import { ShareCard } from "./components/ShareCard";
import type { Results } from "./lib/types";
import "./styles.css";
import "./share.css";

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("missing #root");
const root = createRoot(rootEl);

fetch("./data/results.json")
  .then((res) => {
    if (!res.ok) throw new Error(`Could not load results.json (HTTP ${res.status})`);
    return res.json() as Promise<Results>;
  })
  .then((results) => root.render(<ShareCard results={results} />))
  .catch((err: Error) => root.render(<p className="load-error">{err.message}</p>));
