import type { ProductStatus as Status } from "@/db/schema";

// Same dot + label pattern as OrderStatus.
const states: Record<Status, { label: string; dot: string }> = {
  active: { label: "Live", dot: "bg-success" },
  draft: { label: "Draft", dot: "bg-change" },
  archived: { label: "Archived", dot: "bg-muted" },
};

export function ProductStatus({ status }: { status: Status }) {
  const { label, dot } = states[status];
  return (
    <span className="inline-flex items-center gap-2 text-body-sm">
      <span aria-hidden="true" className={`size-2 rounded-pill ${dot}`} />
      {label}
    </span>
  );
}
