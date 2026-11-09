import Link from "next/link";
import type { AdminEvent } from "@/lib/admin-events";
import { formatPrice } from "@/lib/catalog";

// Admin history rows (`admin_events`), newest first. Shared by the product
// edit page and /admin/activity.

const dateFormat = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
});

const fieldLabels: Record<string, string> = {
  name: "Name",
  slug: "Slug",
  reference: "Reference",
  categoryId: "Category",
  price: "Price",
  stock: "Stock",
  image: "Image",
  imageAlt: "Image description",
  detailFocus: "Close-up focus",
  isNew: "New arrivals",
  colour: "Colour",
  description: "Description",
  details: "Details",
  status: "Status",
  role: "Role",
  attention: "Needed attention",
  note: "Note",
};

const statusLabels: Record<string, string> = {
  active: "Live",
  draft: "Draft",
  archived: "Archived",
};

function describe(event: AdminEvent) {
  const to = event.changes.status?.to ?? event.changes.role?.to;
  switch (`${event.entity}.${event.action}`) {
    case "product.create":
      return "Created product";
    case "product.update":
      return "Edited product";
    case "product.stock":
      return "Set stock";
    case "product.status":
      return to === "active" ? "Published product" : to === "archived" ? "Archived product" : "Changed status";
    case "product.delete":
      return "Deleted product";
    case "category.create":
      return "Added category";
    case "category.rename":
      return "Renamed category";
    case "category.delete":
      return "Deleted category";
    case "user.role":
      return to === "admin" ? "Made admin" : "Removed admin role";
    case "order.resolve":
      return "Marked order resolved";
    default:
      return `${event.entity} ${event.action}`;
  }
}

function formatValue(field: string, value: unknown, categoryNames: Map<number, string>) {
  if (value === null || value === undefined || value === "") return "—";
  if (field === "price" && typeof value === "number") return formatPrice(value);
  if (field === "categoryId" && typeof value === "number") {
    return categoryNames.get(value) ?? `Category ${value}`;
  }
  if (field === "status" && typeof value === "string") return statusLabels[value] ?? value;
  if (typeof value === "boolean") return value ? "Yes" : "No";
  const text = Array.isArray(value) ? value.join("; ") : String(value);
  return text.length > 120 ? `${text.slice(0, 120)}…` : text;
}

function entityHref(event: AdminEvent) {
  switch (event.entity) {
    case "product":
      return event.action === "delete" ? null : `/admin/products/${event.entityId}/edit`;
    case "category":
      return "/admin/categories";
    case "user":
      return `/admin/customers?q=${encodeURIComponent(event.label)}`;
    case "order":
      return `/admin/orders/${event.entityId}`;
  }
}

type Props = {
  events: AdminEvent[];
  categoryNames: Map<number, string>;
  // On the activity page each row also names and links what changed.
  showEntity?: boolean;
};

export function HistoryList({ events, categoryNames, showEntity = false }: Props) {
  if (events.length === 0) {
    return <p className="border-t pt-6 text-muted">No changes recorded yet.</p>;
  }

  return (
    <ol className="border-t text-body-sm">
      {events.map((event) => {
        const href = showEntity ? entityHref(event) : null;
        const changes = Object.entries(event.changes);
        return (
          <li key={event.id} className="border-b py-4">
            <p>
              {describe(event)}
              {showEntity && (
                <>
                  {" "}
                  {href ? (
                    <Link href={href} className="link">
                      {event.label}
                    </Link>
                  ) : (
                    <span className="font-medium">{event.label}</span>
                  )}
                </>
              )}
            </p>
            <p className="mt-1 text-meta">
              <time dateTime={event.createdAt.toISOString()}>{dateFormat.format(event.createdAt)}</time>{" "}
              · <span className="break-all">{event.actorEmail}</span>
            </p>
            {changes.length > 0 && (
              <dl className="mt-3 grid gap-1 text-caption sm:grid-cols-[9rem_minmax(0,1fr)] sm:gap-x-4">
                {changes.map(([field, { from, to }]) => (
                  <div key={field} className="contents">
                    <dt className="text-muted">{fieldLabels[field] ?? field}</dt>
                    <dd className="min-w-0 break-words">
                      {field === "note" || field === "attention" ? (
                        formatValue(field, field === "note" ? to : from, categoryNames)
                      ) : (
                        <>
                          <span className="text-muted">{formatValue(field, from, categoryNames)}</span>
                          <span aria-hidden="true"> → </span>
                          <span className="sr-only"> changed to </span>
                          {formatValue(field, to, categoryNames)}
                        </>
                      )}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
          </li>
        );
      })}
    </ol>
  );
}
