// Skeleton while the check-up runs (Nessie can take a few seconds).
export default function Loading() {
  return (
    <div className="flex flex-col gap-6 px-4 pt-6 pb-8" aria-busy="true">
      <div className="h-10 w-2/3 animate-pulse rounded-lg bg-foreground/10" />
      <div className="h-28 animate-pulse rounded-2xl bg-foreground/10" />
      <div className="h-4 w-1/3 animate-pulse rounded bg-foreground/10" />
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-40 animate-pulse rounded-2xl bg-foreground/10" />
      ))}
      <span className="sr-only" role="status">
        Loading…
      </span>
    </div>
  );
}
