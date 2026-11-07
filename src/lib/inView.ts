import { useEffect, useRef, useState } from "react";

/**
 * True once the element has come within `margin` of the viewport, and stays true. For work that costs the main thread
 * (the analysis band's thousands of scatter dots) and sits well below the fold: nothing renders until the reader heads
 * there, so the load is not charged for it. Inside an auto-height iframe the frame's viewport is the whole document, so
 * everything counts as in view at once; that is the embed's nature, not a bug.
 */
export function useInView<T extends Element>(margin = "600px"): [React.RefObject<T>, boolean] {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || inView) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setInView(true);
          io.disconnect();
        }
      },
      { rootMargin: margin },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [inView, margin]);
  return [ref, inView];
}
