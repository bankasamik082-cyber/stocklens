export function ErrorMessage({ message }: { message: string }) {
  if (!message) return null;
  return (
    <div
      role="alert"
      className="flex items-start gap-2.5 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300"
    >
      <span className="mt-px text-rose-400 shrink-0">⚠</span>
      <span>{message}</span>
    </div>
  );
}
