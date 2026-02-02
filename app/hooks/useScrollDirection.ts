"use client";

import { useEffect, useRef, useState } from "react";

type ScrollDirection = "up" | "down" | null;

const SCROLL_THRESHOLD = 10;

/**
 * Returns scroll direction based on scroll container.
 * 'down' = user scrolled down (hide login button)
 * 'up' = user scrolled up (show login button)
 */
export function useScrollDirection(
  scrollRef: React.RefObject<HTMLElement | null>
): ScrollDirection {
  const [direction, setDirection] = useState<ScrollDirection>(null);
  const lastScrollTop = useRef(0);
  const lastDirection = useRef<ScrollDirection>(null);
  const ticking = useRef(false);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const handleScroll = () => {
      if (!ticking.current) {
        window.requestAnimationFrame(() => {
          if (!scrollRef.current) return;
          const scrollTop = scrollRef.current.scrollTop;
          const delta = scrollTop - lastScrollTop.current;

          if (Math.abs(delta) > SCROLL_THRESHOLD) {
            const newDirection: ScrollDirection = delta > 0 ? "down" : "up";
            if (lastDirection.current !== newDirection) {
              setDirection(newDirection);
              lastDirection.current = newDirection;
            }
            lastScrollTop.current = scrollTop;
          }
          ticking.current = false;
        });
        ticking.current = true;
      }
    };

    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => el.removeEventListener("scroll", handleScroll);
  }, [scrollRef]);

  return direction;
}
