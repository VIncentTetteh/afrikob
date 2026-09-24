import { CheckCircle2 } from "lucide-react";
import { KeyValueList, recordToItems } from "@/components/domain/key-value-list";

export function ResultPanel({ title, data }: { title: string; data: Record<string, unknown> }) {
  return (
    <div className="space-y-4">
      <p className="flex items-center gap-2 rounded-lg border border-settled/25 bg-settled-wash px-3 py-2.5 text-sm font-medium text-settled">
        <CheckCircle2 className="size-4 shrink-0" aria-hidden />
        {title}
      </p>
      <KeyValueList items={recordToItems(data)} />
    </div>
  );
}
