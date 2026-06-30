"use client";

import { useState } from "react";
import { AnimatePresence } from "framer-motion";
import { ChatPanel } from "@/components/ChatPanel";

export function ChatButton({ ticker }: { ticker: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Floating action button */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close AI research chat" : "Open AI research chat"}
        data-testid="chat-fab"
        className="fixed bottom-6 right-4 z-50 flex h-14 w-14 items-center justify-center rounded-full shadow-2xl transition-transform active:scale-95"
        style={{
          background: `linear-gradient(135deg, rgb(var(--t-accent)), rgb(var(--t-accent) / 0.7))`,
          boxShadow: open
            ? `0 0 0 3px rgb(var(--t-accent) / 0.3), 0 8px 32px rgb(var(--t-accent) / 0.4)`
            : `0 0 0 0px rgb(var(--t-accent) / 0), 0 8px 32px rgb(var(--t-accent) / 0.25), 0 0 60px rgb(var(--t-accent) / 0.12)`,
          animation: open ? "none" : "glow-pulse 3s ease-in-out infinite",
        }}
      >
        <span
          className="font-bold text-sm tracking-tight select-none"
          style={{ color: `rgb(var(--t-bg))` }}
        >
          {open ? "✕" : "AI"}
        </span>
      </button>

      {/* Chat panel (AnimatePresence handles mount/unmount animation) */}
      <AnimatePresence>
        {open && <ChatPanel ticker={ticker} onClose={() => setOpen(false)} />}
      </AnimatePresence>
    </>
  );
}
