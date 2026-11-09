import { useEffect, useRef } from "react";
import type { HistoryPoint } from "../lib/history";
import type { Baseline } from "../lib/shift";
import { raceTitle } from "../lib/summary";
import type { Race } from "../lib/types";
import { RaceCard } from "./RaceCard";

const W = 360; // the side panel's width, so the card reads the same here

interface Props {
  race: Race;
  points?: HistoryPoint[];
  baseline: Baseline | null;
  x: number; // the clicked seat, in the chambers frame's coordinates
  y: number;
  frameWidth: number;
  onOpen: () => void; // "Open on the map": selects the race
  onClose: () => void;
}

/**
 * The race behind a seat, opened by a click on its dot: the race card under the dot, closed by its button, Escape or a
 * click anywhere else. Anchored in the frame rather than centered in the viewport, because inside the auto-height
 * iframe the viewport is the whole article and a centered dialog would open far below the reader.
 */
export function SeatPopover({ race, points, baseline, x, y, frameWidth, onOpen, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.focus({ preventScroll: true });
    // The dots sit low in the cards, so on a laptop the card opens across the fold: bring the rest of it into view.
    ref.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation(); // the page's Escape steps the selection back; this one only closes the card
      onClose();
    };
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("keydown", onKey, true);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [onClose]);
  const width = Math.min(W, frameWidth - 8);
  const left = Math.min(Math.max(4, x - width / 2), frameWidth - width - 4);
  return (
    <div className="seat-popover" role="dialog" aria-label={raceTitle(race)} tabIndex={-1} ref={ref} style={{ left, top: y + 14, width }}>
      <button type="button" className="seat-popover__close" aria-label="Close" onClick={onClose}>
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <path d="M4 4l8 8M12 4l-8 8" />
        </svg>
      </button>
      <RaceCard race={race} heading="h3" points={points} baseline={baseline} />
      <button type="button" className="open-map" onClick={onOpen}>
        Open on the map →
      </button>
    </div>
  );
}
