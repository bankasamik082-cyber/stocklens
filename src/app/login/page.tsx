"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { ErrorMessage } from "@/components/ErrorMessage";

type Mode = "login" | "signup";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [mode, setMode]       = useState<Mode>("login");
  const [email, setEmail]     = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]     = useState("");
  const [notice, setNotice]   = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setNotice(""); setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        const { data } = await supabase.auth.getSession();
        if (data.session) { router.push("/dashboard"); router.refresh(); }
        else { setNotice("Account created. Check your inbox to confirm, then sign in."); setMode("login"); }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.push("/dashboard"); router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally { setLoading(false); }
  }

  return (
    <div
      className="grid min-h-screen lg:grid-cols-2"
      style={{ backgroundColor: `rgb(var(--t-bg))` }}
    >
      {/* Left — brand panel */}
      <div
        className="relative hidden lg:flex flex-col justify-between p-10 overflow-hidden border-r"
        style={{ borderColor: `rgb(var(--t-border) / 0.4)` }}
      >
        {/* Background glow */}
        <div
          className="pointer-events-none absolute top-0 right-0 h-96 w-96 -translate-y-1/2 translate-x-1/2 rounded-full blur-3xl opacity-20"
          style={{ backgroundColor: `rgb(var(--t-accent))` }}
        />

        {/* Logo */}
        <Link href="/" className="relative z-10 flex items-center gap-2.5">
          <div className="relative grid h-9 w-9 place-items-center rounded-xl overflow-hidden">
            <div
              className="absolute inset-0"
              style={{ background: `linear-gradient(135deg, rgb(var(--t-accent)), rgb(var(--t-accent) / 0.6))` }}
            />
            <span
              className="relative z-10 text-sm font-bold"
              style={{ color: `rgb(var(--t-bg))` }}
            >
              SL
            </span>
          </div>
          <span
            className="text-xl font-semibold tracking-tight"
            style={{ color: `rgb(var(--t-text))` }}
          >
            Stock<span style={{ color: `rgb(var(--t-accent))` }}>Lens</span>
          </span>
        </Link>

        {/* Tagline */}
        <div className="relative z-10 space-y-6">
          <blockquote
            className="text-3xl font-bold leading-tight tracking-tight"
            style={{ color: `rgb(var(--t-text))` }}
          >
            &ldquo;Every section cites{" "}
            <span
              className="bg-clip-text text-transparent"
              style={{
                backgroundImage: `linear-gradient(90deg, rgb(var(--t-accent)), rgb(var(--t-accent) / 0.6))`,
              }}
            >
              its source.&rdquo;
            </span>
          </blockquote>
          <div className="space-y-3">
            {[
              "Real financials from Finnhub & SEC EDGAR",
              "AI-written in plain English, all cited",
              "Research-only — never financial advice",
            ].map((f) => (
              <div key={f} className="flex items-center gap-3 text-sm" style={{ color: `rgb(var(--t-muted))` }}>
                <div
                  className="h-1.5 w-1.5 rounded-full shrink-0"
                  style={{ backgroundColor: `rgb(var(--t-accent))` }}
                />
                {f}
              </div>
            ))}
          </div>
        </div>

        <p className="relative z-10 text-xs" style={{ color: `rgb(var(--t-dim))` }}>
          © {new Date().getFullYear()} StockLens
        </p>
      </div>

      {/* Right — form */}
      <div
        className="flex flex-col items-center justify-center px-6 py-12"
        style={{ backgroundColor: `rgb(var(--t-bg))` }}
      >
        {/* Mobile logo */}
        <Link href="/" className="mb-8 flex items-center gap-2 lg:hidden">
          <div
            className="grid h-8 w-8 place-items-center rounded-lg"
            style={{ background: `linear-gradient(135deg, rgb(var(--t-accent)), rgb(var(--t-accent) / 0.6))` }}
          >
            <span className="text-xs font-bold" style={{ color: `rgb(var(--t-bg))` }}>SL</span>
          </div>
          <span className="text-lg font-semibold" style={{ color: `rgb(var(--t-text))` }}>
            Stock<span style={{ color: `rgb(var(--t-accent))` }}>Lens</span>
          </span>
        </Link>

        <div className="w-full max-w-sm">
          <div className="mb-8">
            <h1 className="font-display text-2xl font-bold tracking-tight" style={{ color: `rgb(var(--t-text))` }}>
              {mode === "login" ? "Welcome back" : "Create your account"}
            </h1>
            <p className="mt-1.5 text-sm" style={{ color: `rgb(var(--t-muted))` }}>
              {mode === "login"
                ? "Sign in to pick up where you left off."
                : "Free to start. Just an email and password."}
            </p>
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="mb-1.5 block text-sm font-medium"
                style={{ color: `rgb(var(--t-muted))` }}
              >
                Email address
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="input-base"
              />
            </div>
            <div>
              <label
                htmlFor="password"
                className="mb-1.5 block text-sm font-medium"
                style={{ color: `rgb(var(--t-muted))` }}
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="input-base"
              />
            </div>

            <ErrorMessage message={error} />

            {notice && (
              <div
                className="flex items-start gap-2.5 rounded-xl border px-4 py-3 text-sm"
                style={{
                  borderColor: `rgb(var(--t-success) / 0.3)`,
                  backgroundColor: `rgb(var(--t-success) / 0.08)`,
                  color: `rgb(var(--t-success))`,
                }}
              >
                <span className="shrink-0">✓</span>
                {notice}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-accent w-full py-3 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Working…" : mode === "login" ? "Sign in" : "Create account"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm" style={{ color: `rgb(var(--t-muted))` }}>
            {mode === "login" ? "New to StockLens? " : "Already have an account? "}
            <button
              onClick={() => { setMode(mode === "login" ? "signup" : "login"); setError(""); setNotice(""); }}
              className="font-semibold transition"
              style={{ color: `rgb(var(--t-accent))` }}
            >
              {mode === "login" ? "Create an account" : "Sign in"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
