import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

import { cn } from "../../lib/format";
import { useInView, usePrefersReducedMotion } from "./useMotion";

/** Fade-and-rise wrapper driven by intersection, not by time on the page. */
export function Reveal({
  children,
  className,
  delay = 0,
  distance = 18,
  style,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  distance?: number;
  style?: CSSProperties;
}) {
  const reduced = usePrefersReducedMotion();
  const { ref, inView } = useInView<HTMLDivElement>();
  const visible = reduced || inView;

  const motion: CSSProperties = reduced
    ? {}
    : {
        opacity: visible ? 1 : 0,
        transform: visible ? "translate3d(0, 0, 0)" : `translate3d(0, ${distance}px, 0)`,
        transition: `opacity 720ms cubic-bezier(0.22, 0.7, 0.24, 1) ${delay}ms, transform 720ms cubic-bezier(0.22, 0.7, 0.24, 1) ${delay}ms`,
        willChange: "opacity, transform",
      };

  return (
    <div ref={ref} className={className} style={{ ...motion, ...style }}>
      {children}
    </div>
  );
}

/** Hairline reading progress across the whole landing page. */
export function ScrollProgress() {
  const fill = useRef<HTMLDivElement>(null);
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    const node = fill.current;
    if (!node) return;

    if (reduced) {
      node.style.transform = "scaleX(0)";
      return;
    }

    let frame = 0;
    const update = () => {
      frame = 0;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const progress = max <= 0 ? 0 : Math.min(1, Math.max(0, window.scrollY / max));
      node.style.transform = `scaleX(${progress.toFixed(4)})`;
    };
    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [reduced]);

  return (
    <div aria-hidden="true" className="fixed inset-x-0 top-0 z-[60] h-[2px]">
      <div
        ref={fill}
        className="h-full origin-left bg-gradient-to-r from-accent via-accent-strong to-info"
        style={{ transform: "scaleX(0)" }}
      />
    </div>
  );
}

/** Counts to a value once it scrolls into view; static under reduced motion. */
export function CountUp({
  value,
  suffix = "",
  duration = 1100,
  className,
}: {
  value: number;
  suffix?: string;
  duration?: number;
  className?: string;
}) {
  const reduced = usePrefersReducedMotion();
  const { ref, inView } = useInView<HTMLSpanElement>({ threshold: 0.4 });
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (!inView) return;
    if (reduced || value === 0) {
      setDisplay(value);
      return;
    }

    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const elapsed = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - elapsed, 3);
      setDisplay(Math.round(value * eased));
      if (elapsed < 1) frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [inView, reduced, value, duration]);

  return (
    <span ref={ref} className={cn("tabular-nums", className)}>
      {display}
      {suffix}
    </span>
  );
}
