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

  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setNotice("");
    setLoading(true);

    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        const { data } = await supabase.auth.getSession();
        if (data.session) {
          router.push("/dashboard");
          router.refresh();
        } else {
          setNotice(
            "Account created. Check your inbox to confirm your email, then sign in."
          );
          setMode("login");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        router.push("/dashboard");
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Left panel — brand */}
      <div className="relative hidden lg:flex flex-col justify-between p-10 overflow-hidden border-r border-white/[0.05]">
        <div className="absolute inset-0 bg-gradient-to-br from-ink-800 via-ink-900 to-ink-950" />
        <div className="absolute inset-0 bg-gradient-to-tr from-brand-500/10 via-transparent to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-brand-500/30 to-transparent" />

        {/* Logo */}
        <Link href="/" className="relative flex items-center gap-2.5 z-10">
          <div className="relative grid h-9 w-9 place-items-center rounded-xl overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-brand-500 to-brand-700" />
            <span className="relative text-white text-sm font-bold z-10">SL</span>
          </div>
          <span className="text-xl font-semibold tracking-tight text-white">
            Stock<span className="text-brand-400">Lens</span>
          </span>
        </Link>

        {/* Tagline */}
        <div className="relative z-10 space-y-6">
          <blockquote className="text-3xl font-bold leading-tight tracking-tight text-white">
            "Every section cites{" "}
            <span className="text-gradient">its source."</span>
          </blockquote>
          <div className="space-y-4">
            {[
              "Real financials from FMP & SEC EDGAR",
              "AI-written in plain English",
              "Research-only — never financial advice",
            ].map((f) => (
              <div key={f} className="flex items-center gap-3 text-sm text-slate-400">
                <div className="h-1.5 w-1.5 rounded-full bg-brand-400 shrink-0" />
                {f}
              </div>
            ))}
          </div>
        </div>

        <p className="relative z-10 text-xs text-slate-700">
          © {new Date().getFullYear()} StockLens
        </p>
      </div>

      {/* Right panel — form */}
      <div className="flex flex-col items-center justify-center px-6 py-12">
        {/* Mobile logo */}
        <Link href="/" className="mb-8 flex items-center gap-2 lg:hidden">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-brand-500 to-brand-700">
            <span className="text-white text-xs font-bold">SL</span>
          </div>
          <span className="text-lg font-semibold text-white">
            Stock<span className="text-brand-400">Lens</span>
          </span>
        </Link>

        <div className="w-full max-w-sm">
          <div className="mb-8">
            <h1 className="text-2xl font-bold tracking-tight text-white">
              {mode === "login" ? "Welcome back" : "Create your account"}
            </h1>
            <p className="mt-1.5 text-sm text-slate-500">
              {mode === "login"
                ? "Sign in to pick up where you left off."
                : "Free to start. Just an email and password."}
            </p>
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-slate-300">
                Email address
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-xl border border-ink-600 bg-ink-800/60 px-4 py-3 text-white placeholder-slate-600 outline-none backdrop-blur transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
              />
            </div>
            <div>
              <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-slate-300">
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
                className="w-full rounded-xl border border-ink-600 bg-ink-800/60 px-4 py-3 text-white placeholder-slate-600 outline-none backdrop-blur transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
              />
            </div>

            <ErrorMessage message={error} />

            {notice && (
              <div className="flex items-start gap-2.5 rounded-xl border border-brand-500/30 bg-brand-500/10 px-4 py-3 text-sm text-brand-200">
                <span className="shrink-0 text-brand-400">✓</span>
                {notice}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-gradient-to-br from-brand-500 to-brand-600 px-4 py-3 font-semibold text-white shadow-lg shadow-brand-500/20 transition hover:from-brand-400 hover:to-brand-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading
                ? "Working…"
                : mode === "login"
                ? "Sign in"
                : "Create account"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-500">
            {mode === "login" ? "New to StockLens? " : "Already have an account? "}
            <button
              onClick={() => {
                setMode(mode === "login" ? "signup" : "login");
                setError("");
                setNotice("");
              }}
              className="font-semibold text-brand-400 hover:text-brand-300 transition"
            >
              {mode === "login" ? "Create an account" : "Sign in"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
