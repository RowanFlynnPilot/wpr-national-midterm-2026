import { useId, useMemo, useState } from "react";
import type { Geo } from "../lib/geo";
import { STATES, stateName } from "../lib/states";
import type { Office, Race } from "../lib/types";

interface Entry {
  fips: string;
  name: string;
  state: string;
  search: string; // "marathon wisconsin wi"
}

const MAX = 8;

interface Props {
  geo: Geo | null; // the county names come from the atlas; null until it loads
  races: Race[];
  office: Office; // the current tab is preferred when the county's state has that race
  onSelect: (office: "S" | "G", state: string, fips: string) => void;
}

/**
 * A search box for any county in a state electing a senator or governor this year. Every word typed must appear in the
 * county's name or its state ("marathon wi", "washington, oregon"); a pick opens the county's own page on the Senate or
 * governor view, whichever the state has (the current tab when it has both).
 */
export function CountyFinder({ geo, races, office, onSelect }: Props) {
  const id = useId();
  const listId = `${id}-list`;
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const [open, setOpen] = useState(false);

  const statewide = useMemo(() => {
    const m = new Map<string, Set<"S" | "G">>();
    for (const r of races) if (r.office === "S" || r.office === "G") m.set(r.state, (m.get(r.state) ?? new Set<"S" | "G">()).add(r.office));
    return m;
  }, [races]);

  const entries = useMemo<Entry[]>(() => {
    if (!geo) return [];
    const out: Entry[] = [];
    for (const c of geo.counties) {
      const code = STATES[c.id.slice(0, 2)]?.code;
      if (!code || !statewide.has(code)) continue;
      out.push({ fips: c.id, name: c.name, state: code, search: `${c.name} ${stateName(code)} ${code}`.toLowerCase() });
    }
    return out.sort((a, b) => a.name.localeCompare(b.name) || stateName(a.state).localeCompare(stateName(b.state)));
  }, [geo, statewide]);

  const matches = useMemo(() => {
    const tokens = q.toLowerCase().split(/[\s,]+/).filter(Boolean);
    if (!tokens.length) return [];
    const first = tokens[0] as string;
    return entries
      .filter((e) => tokens.every((t) => e.search.includes(t)))
      .sort((a, b) => Number(b.name.toLowerCase().startsWith(first)) - Number(a.name.toLowerCase().startsWith(first))) // names that begin with the word first
      .slice(0, MAX);
  }, [entries, q]);

  const showList = open && q.trim().length > 0;

  const pick = (e: Entry) => {
    const has = statewide.get(e.state) as Set<"S" | "G">;
    const o: "S" | "G" = (office === "S" || office === "G") && has.has(office) ? office : has.has("S") ? "S" : "G";
    setQ("");
    setOpen(false);
    setActive(0);
    onSelect(o, e.state, e.fips);
  };

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((i) => Math.min(i + 1, Math.max(matches.length - 1, 0)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      const m = matches[active];
      if (showList && m) {
        e.preventDefault();
        pick(m);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <section className="finder">
      <label className="panel__title finder__label" htmlFor={id}>
        How did your county vote?
      </label>
      <input
        id={id}
        type="text"
        role="combobox"
        autoComplete="off"
        spellCheck={false}
        placeholder="Type a county name"
        value={q}
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={showList && matches[active] ? `${listId}-${active}` : undefined}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
          setActive(0);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={onKey}
      />
      {showList && (
        <ul className="finder__list" id={listId} role="listbox" aria-label="Matching counties">
          {!geo ? (
            <li className="finder__empty" role="option" aria-selected={false}>
              Loading the county list…
            </li>
          ) : matches.length === 0 ? (
            <li className="finder__empty" role="option" aria-selected={false}>
              No county by that name in a state electing a senator or governor this year
            </li>
          ) : (
            matches.map((m, i) => (
              <li
                key={m.fips}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === active}
                onMouseDown={(e) => e.preventDefault()} // keep the input's focus so the click lands before the list closes
                onMouseMove={() => setActive(i)}
                onClick={() => pick(m)}
              >
                {m.name}
                <span className="finder__state">, {stateName(m.state)}</span>
              </li>
            ))
          )}
        </ul>
      )}
    </section>
  );
}
