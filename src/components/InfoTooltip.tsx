"use client";

import { useState, useRef, useLayoutEffect } from "react";

export function InfoTooltip({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const tooltipRef = useRef<HTMLSpanElement>(null);
  const [nudge, setNudge] = useState(0);

  useLayoutEffect(() => {
    if (!open || !tooltipRef.current) return;
    const rect = tooltipRef.current.getBoundingClientRect();
    const rightOverflow = rect.right - (window.innerWidth - 8);
    setNudge(rightOverflow > 0 ? -rightOverflow : 0);
  }, [open]);

  return (
    <span className="relative inline-block align-middle">
      <button
        type="button"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        onBlur={() => setOpen(false)}
        className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full text-[9px] font-bold leading-none transition-colors cursor-help outline-none select-none"
        style={{ color: open ? `rgb(var(--t-accent))` : `rgb(var(--t-dim))` }}
        aria-label="More information"
        tabIndex={-1}
      >
        ⓘ
      </button>
      {open && (
        <span
          ref={tooltipRef}
          className="absolute z-50 w-52 rounded-lg border px-2.5 py-2 text-[11px] leading-relaxed shadow-xl pointer-events-none"
          style={{
            top: "100%",
            marginTop: 4,
            left: 0,
            transform: nudge ? `translateX(${nudge}px)` : undefined,
            borderColor: `rgb(var(--t-border) / 0.8)`,
            backgroundColor: `rgb(var(--t-card))`,
            color: `rgb(var(--t-muted))`,
          }}
          role="tooltip"
        >
          {text}
        </span>
      )}
    </span>
  );
}
