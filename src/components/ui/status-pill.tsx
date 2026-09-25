import { statusTone, type StatusTone } from "@/lib/api/schemas/normalize";
import { cn } from "@/lib/utils";

const toneClass: Record<StatusTone, string> = {
  success: "bg-settled-wash text-settled border-settled/20",
  pending: "bg-pending-wash text-pending border-pending/20",
  failed: "bg-failed-wash text-failed border-failed/20",
  neutral: "bg-field text-ink-soft border-line",
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
    <span className={cn("inline-flex items-center rounded-lg border border-settled/30 bg-settled-wash px-2.5 py-0.5 text-xs font-semibold text-settled", className)}>
      {children}
    </span>
  );
}
