"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  INVESTOR_TYPES,
  INVESTMENT_FOCUS,
  EXPERIENCE_LEVELS,
  AVATARS,
  type UserProfile,
  EMPTY_PROFILE,
} from "@/lib/profile";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="card p-6">
      <div className="label mb-5">{title}</div>
      {children}
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  optional,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  optional?: boolean;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold" style={{ color: `rgb(var(--t-muted))` }}>
        {label}
        {optional && (
          <span className="ml-1 font-normal" style={{ color: `rgb(var(--t-dim))` }}>
            (optional)
          </span>
        )}
      </label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={60}
        className="input-base text-sm"
      />
    </div>
  );
}

function Chip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full border px-3.5 py-1.5 text-xs font-semibold transition"
      style={{
        borderColor: active ? `rgb(var(--t-accent) / 0.5)` : `rgb(var(--t-text) / 0.1)`,
        backgroundColor: active ? `rgb(var(--t-accent) / 0.12)` : `rgb(var(--t-text) / 0.02)`,
        color: active ? `rgb(var(--t-accent))` : `rgb(var(--t-muted))`,
      }}
    >
      {label}
    </button>
  );
}

export function ProfileClient() {
  const [profile, setProfile] = useState<UserProfile>(EMPTY_PROFILE);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/profile")
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        if (d.profile) setProfile({ ...EMPTY_PROFILE, ...d.profile });
        setLoading(false);
      })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  function set<K extends keyof UserProfile>(key: K, value: UserProfile[K]) {
    setProfile((p) => ({ ...p, [key]: value }));
  }

  function toggleFocus(f: string) {
    setProfile((p) => ({
      ...p,
      investment_focus: p.investment_focus.includes(f)
        ? p.investment_focus.filter((x) => x !== f)
        : [...p.investment_focus, f],
    }));
  }

  async function save() {
    setSaving(true);
    setToast(null);
    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save.");
      // Cache for navbar avatar + personalization without a refetch
      try {
        localStorage.setItem("sl-profile", JSON.stringify(profile));
        window.dispatchEvent(new Event("sl-profile-updated"));
      } catch {}
      setToast({ kind: "ok", msg: "Profile saved ✓" });
    } catch (e) {
      setToast({ kind: "err", msg: e instanceof Error ? e.message : "Something went wrong." });
    } finally {
      setSaving(false);
      setTimeout(() => setToast(null), 4000);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="skeleton h-48 w-full rounded-2xl" />
        <div className="skeleton h-64 w-full rounded-2xl" />
        <div className="skeleton h-32 w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <Section title="About You">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="First name"
            value={profile.first_name ?? ""}
            onChange={(v) => set("first_name", v)}
            placeholder="Pankaj"
          />
          <Field
            label="Last name"
            value={profile.last_name ?? ""}
            onChange={(v) => set("last_name", v)}
            placeholder="Banka"
          />
          <div className="sm:col-span-2">
            <Field
              label="Display name"
              value={profile.display_name ?? ""}
              onChange={(v) => set("display_name", v)}
              placeholder="Shown next to your avatar"
              optional
            />
          </div>
        </div>
        <p className="mt-3 text-[11px]" style={{ color: `rgb(var(--t-dim))` }}>
          Your first name personalizes the dashboard greeting.
        </p>
      </Section>

      <Section title="Investor Profile">
        <div className="space-y-5">
          <div>
            <p className="mb-2 text-xs font-semibold" style={{ color: `rgb(var(--t-muted))` }}>
              Investor type
            </p>
            <div className="flex flex-wrap gap-2">
              {INVESTOR_TYPES.map((t) => (
                <Chip
                  key={t}
                  label={t}
                  active={profile.investor_type === t}
                  onClick={() => set("investor_type", profile.investor_type === t ? null : t)}
                />
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold" style={{ color: `rgb(var(--t-muted))` }}>
              Investment focus <span className="font-normal" style={{ color: `rgb(var(--t-dim))` }}>(pick any)</span>
            </p>
            <div className="flex flex-wrap gap-2">
              {INVESTMENT_FOCUS.map((f) => (
                <Chip
                  key={f}
                  label={f}
                  active={profile.investment_focus.includes(f)}
                  onClick={() => toggleFocus(f)}
                />
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold" style={{ color: `rgb(var(--t-muted))` }}>
              Experience level
            </p>
            <div className="flex flex-wrap gap-2">
              {EXPERIENCE_LEVELS.map((l) => (
                <Chip
                  key={l}
                  label={l}
                  active={profile.experience_level === l}
                  onClick={() => set("experience_level", profile.experience_level === l ? null : l)}
                />
              ))}
            </div>
            <p className="mt-2 text-[11px]" style={{ color: `rgb(var(--t-dim))` }}>
              Beginner highlights metric explanations; Advanced defaults to compact data density.
            </p>
          </div>
        </div>
      </Section>

      <Section title="Your Avatar">
        <div className="flex flex-wrap gap-3">
          {AVATARS.map((a) => {
            const active = profile.avatar === a;
            return (
              <button
                key={a}
                type="button"
                onClick={() => set("avatar", active ? null : a)}
                className="flex h-14 w-14 items-center justify-center rounded-2xl border text-2xl transition"
                style={{
                  borderColor: active ? `rgb(var(--t-accent) / 0.6)` : `rgb(var(--t-text) / 0.1)`,
                  backgroundColor: active ? `rgb(var(--t-accent) / 0.12)` : `rgb(var(--t-text) / 0.02)`,
                  boxShadow: active ? `0 0 16px rgb(var(--t-accent) / 0.25)` : "none",
                }}
                aria-label={`Avatar ${a}`}
                data-testid={`avatar-${a}`}
              >
                {a}
              </button>
            );
          })}
        </div>
      </Section>

      <div className="flex items-center gap-4">
        <button
          onClick={save}
          disabled={saving}
          className="btn-accent text-sm disabled:opacity-50"
          data-testid="save-profile-btn"
        >
          {saving ? "Saving…" : "Save Profile"}
        </button>
        {toast && (
          <span
            className="text-sm font-medium"
            style={{
              color: toast.kind === "ok" ? `rgb(var(--t-success))` : `rgb(var(--t-danger))`,
            }}
            role="status"
          >
            {toast.msg}
          </span>
        )}
        <Link
          href="/settings"
          className="hover-accent-text ml-auto text-xs font-semibold"
          style={{ color: `rgb(var(--t-muted))` }}
        >
          App Settings →
        </Link>
      </div>
    </div>
  );
}
