import { useEffect, useRef, useState } from "react";

const DURATION = 800;

/** Runs a number up from zero on first mount (ease-out, 800 ms); later changes land at once. Reduced motion: no run-up. */
export function useCountUp(value: number): number {
  const [shown, setShown] = useState(() => (window.matchMedia("(prefers-reduced-motion: reduce)").matches ? value : 0));
  const done = useRef(shown === value);
  useEffect(() => {
    if (done.current) {
      setShown(value);
      return;
    }
    const start = performance.now();
    let frame = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / DURATION);
      setShown(Math.round(value * (1 - (1 - p) ** 3)));
      if (p < 1) frame = requestAnimationFrame(tick);
      else done.current = true;
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);
  return shown;
}
