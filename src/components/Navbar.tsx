"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { MobileNav } from "@/components/MobileNav";

const NAV_LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/watchlist", label: "Watchlist" },
  { href: "/compare",   label: "Compare" },
  { href: "/timeline",  label: "Timeline" },
  { href: "/earnings",  label: "Earnings" },
  { href: "/news",      label: "News" },
  { href: "/alerts",    label: "Alerts" },
  { href: "/explain",   label: "Explainer" },
];

export function Navbar({ email }: { email?: string | null }) {
  const router   = useRouter();
  const pathname = usePathname();
  const supabase = createClient();

  async function signOut() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <header
      className="sticky top-0 z-20 border-b"
      style={{
        backgroundColor: `rgb(var(--t-bg) / 0.75)`,
        borderBottomColor: `rgb(var(--t-text) / 0.06)`,
        backdropFilter: "blur(28px) saturate(160%)",
        WebkitBackdropFilter: "blur(28px) saturate(160%)",
        boxShadow: "0 1px 0 rgb(var(--t-text) / 0.05)",
      }}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 h-14">
        {/* Logo */}
        <Link
          href={email ? "/dashboard" : "/"}
          className="flex items-center gap-2.5 group shrink-0"
        >
          <div
            className="relative grid h-7 w-7 place-items-center rounded-lg overflow-hidden"
            style={{
              background: `linear-gradient(135deg, rgb(var(--t-accent)), rgb(var(--t-accent) / 0.65))`,
              boxShadow: `0 0 16px rgb(var(--t-accent) / 0.3)`,
            }}
          >
            <span
              className="relative z-10 text-[11px] font-bold tracking-tight"
              style={{ color: `rgb(var(--t-bg))`, fontFamily: "var(--font-display), sans-serif" }}
            >
              SL
            </span>
          </div>
          <span
            className="text-base font-semibold tracking-tight"
            style={{ color: `rgb(var(--t-text))`, fontFamily: "var(--font-display), sans-serif" }}
          >
            Stock<span style={{ color: `rgb(var(--t-accent))` }}>Lens</span>
          </span>
        </Link>

        {email ? (
          <div className="flex items-center gap-1">
            {/* Nav links */}
            <nav className="hidden md:flex items-center">
              {NAV_LINKS.map((link) => {
                const active = pathname === link.href;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="relative px-3 py-1.5 text-[13px] font-medium rounded-lg transition-colors duration-150"
                    style={{
                      color: active ? `rgb(var(--t-text))` : `rgb(var(--t-muted))`,
                    }}
                    onMouseEnter={(e) => {
                      if (!active) (e.currentTarget as HTMLElement).style.color = `rgb(var(--t-text))`;
                    }}
                    onMouseLeave={(e) => {
                      if (!active) (e.currentTarget as HTMLElement).style.color = `rgb(var(--t-muted))`;
                    }}
                  >
                    {link.label}
                    {active && (
                      <motion.span
                        layoutId="nav-underline"
                        className="absolute bottom-0 left-1/2 -translate-x-1/2 h-0.5 w-4/5 rounded-full"
                        style={{
                          background: `rgb(var(--t-accent))`,
                          boxShadow: `0 0 8px 1px rgb(var(--t-accent) / 0.6)`,
                        }}
                        transition={{ type: "spring", stiffness: 380, damping: 30 }}
                      />
                    )}
                  </Link>
                );
              })}
            </nav>

            {/* Separator */}
            <div
              className="hidden lg:block w-px h-4 mx-3"
              style={{ backgroundColor: `rgb(var(--t-text) / 0.1)` }}
            />

            {/* Cmd+K hint */}
            <button
              onClick={() => {
                const e = new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true });
                window.dispatchEvent(e);
              }}
              className="hidden lg:flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-mono transition"
              style={{
                borderColor: `rgb(var(--t-text) / 0.1)`,
                color: `rgb(var(--t-dim))`,
                backgroundColor: `rgb(var(--t-text) / 0.03)`,
              }}
              title="Open command palette"
            >
              <span>⌘K</span>
            </button>

            {/* Settings */}
            <Link
              href="/settings"
              className="hidden lg:flex ml-1 h-8 w-8 items-center justify-center rounded-lg transition text-sm"
              style={{ color: `rgb(var(--t-muted))` }}
              title="Settings"
            >
              ⊙
            </Link>

            {/* Sign out */}
            <button
              onClick={signOut}
              className="ml-1 rounded-lg border px-3 py-1.5 text-xs font-medium transition"
              style={{
                borderColor: `rgb(var(--t-text) / 0.1)`,
                color: `rgb(var(--t-muted))`,
                backgroundColor: `rgb(var(--t-text) / 0.03)`,
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.color = `rgb(var(--t-text))`;
                (e.currentTarget as HTMLElement).style.borderColor = `rgb(var(--t-accent) / 0.4)`;
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.color = `rgb(var(--t-muted))`;
                (e.currentTarget as HTMLElement).style.borderColor = `rgb(var(--t-text) / 0.1)`;
              }}
            >
              Sign out
            </button>
          </div>
        ) : (
          <Link href="/login" className="btn-accent text-sm">
            Sign in
          </Link>
        )}
      </div>
      {email && <MobileNav />}
    </header>
  );
}
