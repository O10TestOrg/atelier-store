import type { Metadata } from "next";
import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { HistoryList, kindStyles } from "@/features/admin/components/history-list";
import {
  AdminPager,
  listHref,
  pageCount,
  pageParam,
  param,
} from "@/features/admin/components/list-controls";
import {
  adminEventAreas,
  adminEventKinds,
  isAdminEventArea,
  isAdminEventKind,
  type AdminEventArea,
  type AdminEventKind,
} from "@/lib/admin-event-kinds";
import { ADMIN_EVENTS_PER_PAGE, getAdminEvents } from "@/features/admin/admin-events";
import { getAdminCategories } from "@/features/catalog/products";
import { requireAdmin } from "@/lib/session";

export const metadata: Metadata = {
  title: "Activity",
};

const areaLabels: Record<AdminEventArea, string> = {
  product: "Products",
  category: "Categories",
  user: "Customers",
  order: "Orders",
};

type Filters = { kind?: AdminEventKind; area?: AdminEventArea };

const activityHref = ({ kind, area }: Filters, page = 1) =>
  listHref("/admin/activity", { kind, area, page });

export default function AdminActivityPage({ searchParams }: PageProps<"/admin/activity">) {
  return (
    <>
      <header>
        <p className="text-eyebrow text-muted">Admin</p>
        <h1 className="mt-4 text-heading">Activity</h1>
        <p className="mt-4 max-w-prose text-muted">
          Every admin change, newest first, with before and after values. The log{" "}
          <strong>can’t be edited</strong> and keeps deleted items.
        </p>
      </header>
      <Suspense fallback={<div aria-hidden="true" className="mt-10 h-96 animate-pulse bg-surface" />}>
        <Activity searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Activity({ searchParams }: Pick<PageProps<"/admin/activity">, "searchParams">) {
  await requireAdmin("/admin/activity");

  const params = await searchParams;
  const kindParam = param(params.kind);
  const areaParam = param(params.area);
  const filters: Filters = {
    kind: isAdminEventKind(kindParam) ? kindParam : undefined,
    area: isAdminEventArea(areaParam) ? areaParam : undefined,
  };
  const page = pageParam(params.page);
  const [{ events, total }, categories] = await Promise.all([
    getAdminEvents(page, filters),
    getAdminCategories(),
  ]);
  const pages = pageCount(total, ADMIN_EVENTS_PER_PAGE);
  const filtered = Boolean(filters.kind || filters.area);

  return (
    <div className="mt-10">
      <div className="grid gap-3">
        <FilterRow label="Change">
          <Chip href={activityHref({ ...filters, kind: undefined })} current={!filters.kind}>
            All
          </Chip>
          {adminEventKinds.map((kind) => {
            const { Glyph, color, label } = kindStyles[kind];
            return (
              <Chip
                key={kind}
                href={activityHref({ ...filters, kind })}
                current={filters.kind === kind}
              >
                <Glyph strokeWidth={1.5} className={`size-3.5 ${color}`} />
                {label}
              </Chip>
            );
          })}
        </FilterRow>
        <FilterRow label="Area">
          <Chip href={activityHref({ ...filters, area: undefined })} current={!filters.area}>
            All
          </Chip>
          {adminEventAreas.map((area) => (
            <Chip
              key={area}
              href={activityHref({ ...filters, area })}
              current={filters.area === area}
            >
              {areaLabels[area]}
            </Chip>
          ))}
        </FilterRow>
      </div>

      <div className="mt-8">
        <h2 className="sr-only">Changes</h2>
        <HistoryList
          events={events}
          categoryNames={new Map(categories.map((c) => [c.id, c.name]))}
          showEntity
          empty={filtered ? "No changes match these filters." : undefined}
        />
      </div>
      <AdminPager
        page={page}
        pages={pages}
        href={(p) => activityHref(filters, p)}
        newer="Newer"
        older="Older"
      />
    </div>
  );
}

function FilterRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <nav aria-label={`Filter by ${label.toLowerCase()}`} className="flex flex-wrap items-center gap-2">
      <span aria-hidden="true" className="w-16 shrink-0 text-eyebrow text-muted">
        {label}
      </span>
      {children}
    </nav>
  );
}

function Chip({ href, current, children }: { href: string; current: boolean; children: ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={current ? "page" : undefined}
      className="inline-flex h-8 items-center gap-1.5 rounded-pill border px-3 text-caption transition-colors hover:border-line-strong aria-[current=page]:border-line-strong aria-[current=page]:bg-surface"
    >
      {children}
    </Link>
  );
}
