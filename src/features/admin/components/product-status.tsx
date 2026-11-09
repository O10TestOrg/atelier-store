import { StatusDot, type DotTone } from "@/components/signal";
import type { ProductStatus as Status } from "@/db/schema";

// Same dot + label pattern as OrderStatus.
const states: Record<Status, { label: string; tone: DotTone }> = {
  active: { label: "Live", tone: "success" },
  draft: { label: "Draft", tone: "change" },
  archived: { label: "Archived", tone: "muted" },
};

export function ProductStatus({ status }: { status: Status }) {
  const { label, tone } = states[status];
  return (
    <span className="inline-flex items-center gap-2 text-body-sm">
      <StatusDot tone={tone} size="md" />
      {label}
    </span>
  );
}
