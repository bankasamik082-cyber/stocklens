"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Search, GitBranch, Layers, User } from "lucide-react";

const ITEMS = [
  { href: "/dashboard", label: "Dashboard", Icon: LayoutDashboard },
  { href: "/explain",   label: "Research",  Icon: Search },
  { href: "/timeline",  label: "Timeline",  Icon: GitBranch },
  { href: "/compare",   label: "Compare",   Icon: Layers },
  { href: "/profile",   label: "Profile",   Icon: User },
];

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 border-t md:hidden"
      style={{
        height: "calc(64px + env(safe-area-inset-bottom))",
        paddingBottom: "env(safe-area-inset-bottom)",
        backgroundColor: `rgb(var(--t-bg) / 0.8)`,
        borderTopColor: `rgb(var(--t-text) / 0.08)`,
        backdropFilter: "blur(28px) saturate(160%)",
        WebkitBackdropFilter: "blur(28px) saturate(160%)",
      }}
      aria-label="Mobile navigation"
    >
      <div className="grid h-16 grid-cols-5">
        {ITEMS.map(({ href, label, Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className="relative flex flex-col items-center justify-center gap-1"
              style={{ color: active ? `rgb(var(--t-accent))` : `rgb(var(--t-muted))` }}
            >
              {active && (
                <span
                  className="absolute top-1.5 h-1 w-1 rounded-full"
                  style={{
                    backgroundColor: `rgb(var(--t-accent))`,
                    boxShadow: `0 0 6px rgb(var(--t-accent))`,
                  }}
                />
              )}
              <Icon size={20} strokeWidth={active ? 2.4 : 2} />
              <span className="text-[10px] font-medium">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
