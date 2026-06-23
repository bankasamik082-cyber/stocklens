type Tone = "neutral" | "brand" | "good" | "warn" | "bad";

const TONES: Record<Tone, string> = {
  neutral: "bg-ink-700/80 text-slate-300 border-white/10",
  brand: "bg-brand-500/15 text-brand-200 border-brand-500/30",
  good: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
  warn: "bg-amber-500/10 text-amber-300 border-amber-500/30",
  bad: "bg-rose-500/10 text-rose-300 border-rose-500/30",
};

export function Badge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: Tone;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold tracking-wide ${TONES[tone]}`}
    >
      {children}
    </span>
  );
}

export function scoreTone(score: number): Tone {
  if (score >= 7) return "good";
  if (score >= 4) return "warn";
  return "bad";
}

export function confidenceTone(level: string): Tone {
  if (level === "High") return "good";
  if (level === "Medium") return "warn";
  return "neutral";
}
