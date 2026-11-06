import { useEffect, useState } from "react";
import { centralTime } from "../lib/format";
import { raceTitle } from "../lib/summary";
import type { Race } from "../lib/types";

interface Props {
  calls: Race[]; // timestamped calls, oldest first
  unstamped: number; // calls civicAPI gave no time; they land at the end
  at: number | null; // null = not replaying; 0..calls.length otherwise
  onChange: (at: number | null) => void;
}

const STEP_MS = 45; // one call per step: the whole night in about 20 seconds

/** Walks the calls in the order they came: a play button, a scrubber, the clock and the race just called. */
export function Replay({ calls, unstamped, at, onChange }: Props) {
  const n = calls.length;
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    if (!playing || at === null) return;
    if (at >= n) {
      setPlaying(false);
      return;
    }
    const id = window.setTimeout(() => onChange(at + 1), STEP_MS);
    return () => window.clearTimeout(id);
  }, [playing, at, n, onChange]);

  if (at === null) {
    return (
      <button
        type="button"
        className="replay-start"
        onClick={() => {
          onChange(0);
          setPlaying(true);
        }}
      >
        <span aria-hidden="true">▶</span> Replay election night
      </button>
    );
  }
  const current = at > 0 && at <= n ? calls[at - 1] : undefined;
  const clock = at === 0 ? "Before the first call" : at >= n ? "Now" : centralTime((current as Race).calledAt as string);
  const winner = current?.cands.find((c) => c.winner);
  const justCalled = current
    ? current.office === "B"
      ? `${raceTitle(current)}: ${current.winner === "Y" ? "passed" : "failed"}`
      : `${raceTitle(current)}: ${winner?.name ?? ""} (${current.winner})${current.flip ? ", a flip" : ""}`
    : at >= n
      ? `${unstamped} calls civicAPI gave no time for appear here, at the end`
      : "Polls are closing. Until a state is called it shows today\u2019s leader.";
  return (
    <div className="replay" role="group" aria-label="Replay election night">
      <button
        type="button"
        className="replay__play"
        aria-label={playing ? "Pause" : "Play"}
        onClick={() => {
          if (!playing && at >= n) onChange(0);
          setPlaying(!playing);
        }}
      >
        <span aria-hidden="true">{playing ? "❚❚" : "▶"}</span>
      </button>
      <input
        className="replay__scrub"
        type="range"
        min={0}
        max={n}
        value={at}
        aria-label="Calls so far"
        aria-valuetext={`${clock}, ${at} of ${n} calls`}
        onChange={(e) => {
          setPlaying(false);
          onChange(Number(e.target.value));
        }}
      />
      <div className="replay__readout">
        <span className="replay__clock">
          <strong>{clock}</strong> <span className="replay__count">· {at} of {n} calls</span>
        </span>
        <span className="replay__call" aria-live="off">
          {justCalled}
        </span>
      </div>
      <button
        type="button"
        className="replay__exit"
        onClick={() => {
          setPlaying(false);
          onChange(null);
        }}
      >
        Exit replay
      </button>
    </div>
  );
}
