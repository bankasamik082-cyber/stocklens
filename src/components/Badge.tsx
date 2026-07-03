type Tone = "neutral" | "brand" | "good" | "warn" | "bad";

const TONES: Record<Tone, string> = {
  neutral: "bg-t-surface text-t-muted border-t-border",
  brand: "bg-t-accent/15 text-t-accent border-t-accent/30",
  good: "bg-t-success/10 text-t-success border-t-success/30",
  warn: "bg-t-warn/10 text-t-warn border-t-warn/30",
  bad: "bg-t-danger/10 text-t-danger border-t-danger/30",
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
