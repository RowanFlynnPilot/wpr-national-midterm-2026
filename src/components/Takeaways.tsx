import { memo } from "react";
import type { Takeaway } from "../lib/takeaways";
import type { Selection } from "../lib/types";

interface Props {
  items: Takeaway[];
  onSelect?: (to: Selection) => void; // the full page: a button selects the view
  link?: (to: Selection) => string; // the compact module: a link to the full page at that view
}

/** The numbered sentences under the chamber cards; each opens the view behind it. */
export const Takeaways = memo(function Takeaways({ items, onSelect, link }: Props) {
  if (!items.length) return null;
  return (
    <section className="takeaways" aria-labelledby="takeaways-title">
      <h2 id="takeaways-title" className="takeaways__title">
        {items.length === 1 ? "One thing" : `${["", "", "Two", "Three", "Four", "Five"][items.length]} things`} to know
      </h2>
      <ol className="takeaways__list">
        {items.map((t, i) => (
          <li key={i}>
            {link ? (
              <a className="takeaway" href={link(t.to)} target="_top">
                <span className="takeaway__n" aria-hidden="true">
                  {i + 1}
                </span>
                <span className="takeaway__text">{t.text}</span>
              </a>
            ) : (
              <button type="button" className="takeaway" onClick={() => onSelect?.(t.to)}>
                <span className="takeaway__n" aria-hidden="true">
                  {i + 1}
                </span>
                <span className="takeaway__text">{t.text}</span>
              </button>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
});
