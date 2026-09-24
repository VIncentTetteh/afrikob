import { statusTone, type StatusTone } from "@/lib/api/schemas/normalize";
import { cn } from "@/lib/utils";

const toneClass: Record<StatusTone, string> = {
  success: "bg-success-soft text-success border-success/20",
  pending: "bg-warning-soft text-warning border-warning/20",
  failed: "bg-danger-soft text-danger border-danger/20",
  neutral: "bg-muted text-muted-foreground border-border",
};

export function StatusPill({ status, tone, className }: { status: string | null; tone?: StatusTone; className?: string }) {
  const resolved = tone ?? statusTone(status);
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-lg border px-2.5 py-0.5 text-xs font-semibold capitalize whitespace-nowrap",
        toneClass[resolved],
        className,
      )}
    >
      {status ? status.toLowerCase().replaceAll("_", " ") : "unknown"}
    </span>
  );
}

export function Tag({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-lg border border-success/30 bg-success-soft px-2.5 py-0.5 text-xs font-semibold text-success", className)}>
      {children}
    </span>
  );
}
