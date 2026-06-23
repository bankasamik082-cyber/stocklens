"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function Navbar({ email }: { email?: string | null }) {
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();

  async function signOut() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-20 border-b border-white/[0.05] bg-ink-950/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3.5">
        <Link href={email ? "/dashboard" : "/"} className="flex items-center gap-2.5 group">
          <div className="relative grid h-8 w-8 place-items-center rounded-lg overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-brand-500 to-brand-700 opacity-90" />
            <div className="absolute inset-0 bg-gradient-to-tr from-transparent to-white/10" />
            <span className="relative text-white text-sm font-bold tracking-tight z-10">SL</span>
          </div>
          <span className="text-[17px] font-semibold tracking-tight text-white">
            Stock<span className="text-brand-400">Lens</span>
          </span>
        </Link>

        {email ? (
          <div className="flex items-center gap-5">
            <nav className="hidden items-center gap-1 sm:flex">
              <NavLink href="/dashboard" active={pathname === "/dashboard"}>
                Dashboard
              </NavLink>
              <NavLink href="/news" active={pathname === "/news"}>
                Market News
              </NavLink>
            </nav>
            <div className="hidden h-4 w-px bg-ink-700 lg:block" />
            <span className="hidden text-xs text-slate-500 lg:inline truncate max-w-[160px]">
              {email}
            </span>
            <button
              onClick={signOut}
              className="rounded-lg border border-ink-600 px-3 py-1.5 text-sm text-slate-300 transition hover:border-ink-500 hover:text-white hover:bg-ink-800"
            >
              Sign out
            </button>
          </div>
        ) : (
          <Link
            href="/login"
            className="rounded-lg bg-brand-500 px-4 py-1.5 text-sm font-medium text-white transition hover:bg-brand-600 shadow-lg shadow-brand-500/20"
          >
            Sign in
          </Link>
        )}
      </div>
    </header>
  );
}

function NavLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`relative px-3 py-1.5 text-sm rounded-md transition ${
        active
          ? "text-white bg-ink-800"
          : "text-slate-400 hover:text-white hover:bg-ink-800/60"
      }`}
    >
      {children}
    </Link>
  );
}
