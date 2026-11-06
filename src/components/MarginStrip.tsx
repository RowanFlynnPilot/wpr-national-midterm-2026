import { useMemo } from "react";
import { PALE, PARTY } from "../lib/colors";
import { marginText } from "../lib/format";
import { HOME_STATE } from "../lib/states";
import { noVotesYet } from "../lib/status";
import { raceTitle } from "../lib/summary";
import type { Race } from "../lib/types";

interface Props {
  races: Race[];
  onSelect: (race: Race) => void;
}

const W = 320;
const PAD = 10;
const CAP = 40; // points; wider margins share the last column
const BIN = 2; // points per column
const COLS = CAP / BIN;
const R = 2.3;
const AXIS = 18; // room under the baseline for the tick labels
const MAX_H = 112; // the dot columns' height; dense columns pack tighter rather than growing

const TICKS: [number, string][] = [
  [-40, "D+40"],
  [-20, "D+20"],
  [0, "Even"],
  [20, "R+20"],
  [40, "R+40"],
];

/** Every House district as one dot on a margin axis, Democratic wins to the left, Republican to the right. */
export function MarginStrip({ races, onSelect }: Props) {
  const { dots, bars } = useMemo(() => {
    const columns = new Map<number, Race[]>();
    for (const r of races) {
      if (r.office !== "H" || noVotesYet(r)) continue;
      const party = r.winner ?? r.partyDecided ?? r.leader;
      const col = (party === "D" ? -1 : 1) * Math.min(COLS - 1, Math.floor(Math.min(r.margin, CAP) / BIN));
      columns.set(col, [...(columns.get(col) ?? []), r]);
    }
    const isCap = (col: number) => Math.abs(col) === COLS - 1;
    // The two outermost columns (38 points and up) hold dozens of safe seats each; as dots they would dwarf the rest,
    // so they are drawn as one bar with a count, and only the home state's seats among them stay as dots.
    const tallest = Math.max(...[...columns].filter(([col]) => !isCap(col)).map(([, c]) => c.length));
    const pitch = Math.min(2 * R + 0.8, (MAX_H - R) / tallest);
    const dots = [...columns].flatMap(([col, list]) =>
      list
        .sort((a, z) => a.margin - z.margin)
        .filter((r) => !isCap(col) || r.state === HOME_STATE)
        .map((r, i) => ({ r, x: colX(col), y: MAX_H - R - i * pitch })),
    );
    const bars = [...columns]
      .filter(([col]) => isCap(col))
      .map(([col, list]) => ({ col, n: list.length, x: colX(col), h: Math.min(MAX_H, list.length * pitch), party: col < 0 ? ("D" as const) : ("R" as const) }));
    return { dots, bars };
  }, [races]);
  const home = dots.filter((d) => d.r.state === HOME_STATE);
  return (
    <svg
      className="margin-strip"
      viewBox={`0 0 ${W} ${MAX_H + AXIS}`}
      role="img"
      aria-label={`House districts by margin. ${bars.map((b) => `${b.n} ${b.party === "D" ? "Democratic" : "Republican"} seats by ${CAP - BIN} points or more`).join(", ")}. ${home.map((d) => `${d.r.district} ${marginText(d.r.margin)} points`).join(", ")}.`}
    >
      {bars.map((b) => (
        <g key={b.col} className="margin-strip__bar">
          <rect x={b.x - R - 0.4} y={MAX_H - b.h} width={2 * R + 0.8} height={b.h} fill={PARTY[b.party]} />
          <text x={b.x} y={MAX_H - b.h - 3}>{b.n}</text>
        </g>
      ))}
      <line className="margin-strip__base" x1={PAD} x2={W - PAD} y1={MAX_H + 0.5} y2={MAX_H + 0.5} />
      {TICKS.map(([v, label]) => (
        <text key={v} className="margin-strip__tick" x={colX(v === 0 ? 0 : Math.sign(v) * (Math.abs(v) / BIN - (Math.abs(v) === CAP ? 1 : 0)))} y={MAX_H + 13}>
          {label}
        </text>
      ))}
      {dots.map(({ r, x, y }) => (
        <circle
          key={r.id}
          cx={x}
          cy={y}
          r={R}
          fill={r.winner || r.partyDecided ? PARTY[r.winner ?? (r.partyDecided as "D" | "R")] : PALE[r.leader]}
          className={r.state === HOME_STATE ? "margin-strip__dot is-home" : "margin-strip__dot"}
          onClick={() => onSelect(r)}
        >
          <title>{`${raceTitle(r)}: ${(r.cands[0] as Race["cands"][number]).name} by ${marginText(r.margin)}`}</title>
        </circle>
      ))}
    </svg>
  );
}

/** The x of a column: 0 (under 2 points either way) at the center, ±1.. stepping outward; ±(COLS-1) is the 38-plus column. */
function colX(col: number): number {
  return W / 2 + (col * (W / 2 - PAD)) / COLS;
}
