"use client";

import { useState, useRef, useLayoutEffect } from "react";

const TOOLTIP_W = 208; // w-52

export function InfoTooltip({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  // Fixed positioning: compute absolute screen coordinates from the trigger,
  // clamp so the tooltip never exceeds the viewport on either side.
  useLayoutEffect(() => {
    if (!open || !triggerRef.current) {
      setPos(null);
      return;
    }
    const rect = triggerRef.current.getBoundingClientRect();
    let left = rect.left + rect.width / 2 - TOOLTIP_W / 2;
    left = Math.max(8, Math.min(left, window.innerWidth - TOOLTIP_W - 16));
    setPos({ top: rect.bottom + 6, left });
  }, [open]);

  // Close on scroll so a fixed tooltip never drifts away from its trigger
  useLayoutEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  return (
    <span className="relative inline-block align-middle">
      <button
        ref={triggerRef}
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
      {open && pos && (
        <span
          className="fixed z-[100] w-52 rounded-lg border px-2.5 py-2 text-[11px] leading-relaxed shadow-xl pointer-events-none"
          style={{
            top: pos.top,
            left: pos.left,
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
