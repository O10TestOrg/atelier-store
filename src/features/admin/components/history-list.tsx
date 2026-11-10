import Link from "next/link";
import {
  ArchiveIcon,
  ArrowRightIcon,
  CheckIcon,
  ChevronDownIcon,
  MinusIcon,
  PencilIcon,
  PlusIcon,
  TrashIcon,
} from "@/components/icons";
import { adminEventKind, type AdminEventKind } from "@/lib/admin-event-kinds";
import { displayEmail } from "@/lib/roles";
import type { AdminEvent } from "@/features/admin/admin-events";
import { formatPrice } from "@/features/catalog/catalog";
import { STORE_TIME_ZONE as timeZone } from "@/lib/dates";

// Admin history (`admin_events`) as a timeline, newest first, grouped by day
// in UK time. Shared by the product edit page and /admin/activity.

const dayKey = new Intl.DateTimeFormat("en-CA", { timeZone, dateStyle: "short" });
const dayFormat = new Intl.DateTimeFormat("en-GB", {
  timeZone,
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});
const timeFormat = new Intl.DateTimeFormat("en-GB", { timeZone, timeStyle: "short" });

// Rows with more changes than this fold them behind a toggle.
const OPEN_CHANGES = 2;

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

// Each kind of change gets a glyph whose colour says what happened: added or
// published reads green, edits blue, archived or demoted amber, deleted red.
// The copy stays ink.
export const kindStyles = {
  add: { Glyph: PlusIcon, color: "text-success", label: "Added" },
  publish: { Glyph: CheckIcon, color: "text-success", label: "Published" },
  edit: { Glyph: PencilIcon, color: "text-change", label: "Edited" },
  archive: { Glyph: ArchiveIcon, color: "text-warning", label: "Archived or removed" },
  delete: { Glyph: TrashIcon, color: "text-danger", label: "Deleted" },
} satisfies Record<AdminEventKind, unknown>;

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

// Splits newest-first events into days, labelling today and yesterday.
function groupByDay(events: AdminEvent[]) {
  const now = Date.now();
  const today = dayKey.format(now);
  const yesterday = dayKey.format(now - 24 * 60 * 60 * 1000);
  const days: { key: string; label: string; events: AdminEvent[] }[] = [];
  for (const event of events) {
    const key = dayKey.format(event.createdAt);
    let day = days.at(-1);
    if (day?.key !== key) {
      const label =
        key === today ? "Today" : key === yesterday ? "Yesterday" : dayFormat.format(event.createdAt);
      day = { key, label, events: [] };
      days.push(day);
    }
    day.events.push(event);
  }
  return days;
}

function maskEvent(event: AdminEvent): AdminEvent {
  return {
    ...event,
    actorEmail: displayEmail(event.actorEmail, true),
    label: event.entity === "user" ? displayEmail(event.label, true) : event.label,
  };
}

type Props = {
  events: AdminEvent[];
  categoryNames: Map<number, string>;
  // On the activity page each row also names and links what changed.
  showEntity?: boolean;
  // Masks admins' addresses, and the customer named in a role change, for the
  // read-only demo login.
  viewer?: boolean;
  empty?: string;
};

export function HistoryList({
  events,
  categoryNames,
  showEntity = false,
  empty = "No changes recorded yet.",
  viewer = false,
}: Props) {
  if (viewer) events = events.map((event) => maskEvent(event));

  if (events.length === 0) {
    return <p className="border-t pt-6 text-muted">{empty}</p>;
  }

  return (
    <div className="border-t text-body-sm">
      {groupByDay(events).map((day) => (
        <section key={day.key} aria-label={day.label}>
          <h3 className="sticky top-header z-10 -mx-1 bg-background px-1 pt-6 pb-3 text-eyebrow text-muted">
            {day.label}
          </h3>
          <ol className="relative before:absolute before:top-3 before:bottom-6 before:left-3.5 before:w-px before:bg-line">
            {day.events.map((event) => (
              <HistoryItem
                key={event.id}
                event={event}
                categoryNames={categoryNames}
                showEntity={showEntity}
              />
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}

function HistoryItem({
  event,
  categoryNames,
  showEntity,
}: {
  event: AdminEvent;
  categoryNames: Map<number, string>;
  showEntity: boolean;
}) {
  const href = showEntity ? entityHref(event) : null;
  const changes = Object.entries(event.changes);
  const kind = adminEventKind(event);
  const { color } = kindStyles[kind];
  // Losing the admin role reads as a minus rather than an archive box.
  const Glyph = event.entity === "user" && kind === "archive" ? MinusIcon : kindStyles[kind].Glyph;

  const list = (
    <dl className="mt-2 grid gap-1 text-caption sm:grid-cols-[9rem_minmax(0,1fr)] sm:gap-x-4">
      {changes.map(([field, { from, to }]) => (
        <div key={field} className="contents">
          <dt className="text-muted">{fieldLabels[field] ?? field}</dt>
          <dd className="min-w-0 break-words">
            {field === "note" || field === "attention" ? (
              formatValue(field, field === "note" ? to : from, categoryNames)
            ) : (
              <>
                <span className="text-muted">{formatValue(field, from, categoryNames)}</span>{" "}
                <ArrowRightIcon className="text-muted" />
                <span className="sr-only"> changed to </span>{" "}
                {formatValue(field, to, categoryNames)}
              </>
            )}
          </dd>
        </div>
      ))}
    </dl>
  );

  return (
    <li className="relative flex gap-4 pb-6">
      <span className="flex size-7 shrink-0 items-center justify-center rounded-full border bg-background">
        <Glyph strokeWidth={1.5} className={`size-3.5 ${color}`} />
      </span>
      <div className="min-w-0 flex-1 pt-0.5">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4">
          <p className="min-w-0">
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
          <time dateTime={event.createdAt.toISOString()} className="text-meta tabular-nums">
            {timeFormat.format(event.createdAt)}
          </time>
        </div>
        <p className="mt-0.5 text-meta break-all">{event.actorEmail}</p>
        {changes.length > OPEN_CHANGES ? (
          <details className="group mt-2">
            <summary className="inline-flex cursor-pointer list-none items-center gap-1 text-meta transition-colors hover:text-foreground [&::-webkit-details-marker]:hidden">
              <span className="group-open:hidden">Show {changes.length} changes</span>
              <span className="hidden group-open:inline">Hide changes</span>
              <ChevronDownIcon className="size-3.5 transition-transform group-open:rotate-180" />
            </summary>
            {list}
          </details>
        ) : (
          changes.length > 0 && list
        )}
      </div>
    </li>
  );
}
