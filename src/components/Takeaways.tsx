import type { Takeaway } from "../lib/takeaways";
import type { Selection } from "../lib/types";

/** The numbered sentences under the chamber cards; each is a button that opens the view behind it. */
export function Takeaways({ items, onSelect }: { items: Takeaway[]; onSelect: (to: Selection) => void }) {
  if (!items.length) return null;
  return (
    <section className="takeaways" aria-labelledby="takeaways-title">
      <h2 id="takeaways-title" className="takeaways__title">
        {items.length === 1 ? "One thing" : `${["", "", "Two", "Three", "Four", "Five"][items.length]} things`} to know
      </h2>
      <ol className="takeaways__list">
        {items.map((t, i) => (
          <li key={i}>
            <button type="button" className="takeaway" onClick={() => onSelect(t.to)}>
              <span className="takeaway__n" aria-hidden="true">
                {i + 1}
              </span>
              <span className="takeaway__text">{t.text}</span>
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}
