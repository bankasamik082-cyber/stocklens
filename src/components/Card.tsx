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
      className={`card ${className}`}
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
    <div className="flex items-center justify-between border-b border-t-border/60 px-5 py-4">
      <h3 className="text-sm font-semibold tracking-wide text-t-text uppercase">
        {title}
      </h3>
      {badge}
    </div>
  );
}
