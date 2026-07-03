"use client";

import { useEffect, useState } from "react";

export function Greeting({ name }: { name: string }) {
  // Time-of-day must come from the client's clock, not the server's UTC —
  // render a neutral fallback until mounted to avoid hydration mismatch.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const hour = new Date().getHours();
  const timeOfDay = !mounted
    ? "Welcome back"
    : hour < 12
    ? "Good morning"
    : hour < 18
    ? "Good afternoon"
    : "Good evening";

  const dateStr = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div>
      <h1
        className="font-display font-bold tracking-tight"
        style={{ fontSize: "2.5rem", color: `rgb(var(--t-text))`, lineHeight: 1.15 }}
      >
        {timeOfDay},{" "}
        <span
          style={{
            color: `rgb(var(--t-accent))`,
            textShadow: `0 0 32px rgb(var(--t-accent) / 0.4)`,
          }}
        >
          {name}
        </span>
      </h1>
      <p className="mt-1.5 text-sm" style={{ color: `rgb(var(--t-muted))` }} suppressHydrationWarning>
        {dateStr}
      </p>
    </div>
  );
}
