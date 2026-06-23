import { ReactNode } from "react";

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-white/[0.07] bg-ink-800/50 shadow-card backdrop-blur-sm ${className}`}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  badge,
}: {
  title: string;
  badge?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
      <h3 className="text-sm font-semibold tracking-wide text-white/90 uppercase">
        {title}
      </h3>
      {badge}
    </div>
  );
}
