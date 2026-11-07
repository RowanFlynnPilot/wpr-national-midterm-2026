import { createRoot } from "react-dom/client";
import { ShareCard } from "./components/ShareCard";
import { loadBaseline, loadResults } from "./lib/data";
import "./styles.css";
import "./share.css";

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("missing #root");
const root = createRoot(rootEl);

Promise.all([loadResults(), loadBaseline()])
  .then(([results, baseline]) => root.render(<ShareCard results={results} baseline={baseline} />))
  .catch((err: Error) => root.render(<p className="load-error">{err.message}</p>));
