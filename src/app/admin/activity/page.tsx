import type { Metadata } from "next";
import { Suspense } from "react";
import { HistoryList } from "@/components/admin/history-list";
import { AdminPager, listHref, param } from "@/components/admin/list-controls";
import { ADMIN_EVENTS_PER_PAGE, getAdminEvents } from "@/lib/admin-events";
import { parseInteger } from "@/lib/product-form";
import { getAdminCategories } from "@/lib/products";
import { requireAdmin } from "@/lib/session";

export const metadata: Metadata = {
  title: "Activity",
};

export default function AdminActivityPage({ searchParams }: PageProps<"/admin/activity">) {
  return (
    <>
      <header>
        <p className="text-eyebrow text-muted">Admin</p>
        <h1 className="mt-4 text-heading">Activity</h1>
        <p className="mt-4 max-w-prose text-muted">
          Every admin change, newest first: products, stock, categories, roles and resolved
          orders, with the values before and after. It can’t be edited, and it keeps rows for
          things since deleted.
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

  const page = Math.max(1, parseInteger(param((await searchParams).page)) ?? 1);
  const [{ events, total }, categories] = await Promise.all([
    getAdminEvents(page),
    getAdminCategories(),
  ]);
  const pages = Math.max(1, Math.ceil(total / ADMIN_EVENTS_PER_PAGE));

  return (
    <div className="mt-10">
      <HistoryList
        events={events}
        categoryNames={new Map(categories.map((c) => [c.id, c.name]))}
        showEntity
      />
      <AdminPager
        page={page}
        pages={pages}
        href={(p) => listHref("/admin/activity", { page: p })}
        newer="Newer"
        older="Older"
      />
    </div>
  );
}
