export function ErrorMessage({ message }: { message: string }) {
  if (!message) return null;
  return (
    <div
      role="alert"
      className="flex items-start gap-2.5 rounded-xl border border-t-danger/30 bg-t-danger/10 px-4 py-3 text-sm text-t-danger"
    >
      <span className="mt-px shrink-0">⚠</span>
      <span>{message}</span>
    </div>
  );
}
