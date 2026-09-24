import { Panel, Skeleton } from "@/components/ui/panel";

/** Placeholder while a screen's code and data arrive, shaped like the real thing. */
export function PageSkeleton() {
  return (
    <div className="space-y-5" role="status" aria-label="Loading">
      <div className="space-y-2">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <Skeleton className="h-28 w-full rounded-[var(--radius-panel)]" />
      <Panel className="p-4">
        <Skeleton className="h-10 w-full" />
        <div className="mt-4 space-y-3">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      </Panel>
    </div>
  );
}
