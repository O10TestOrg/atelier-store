import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { requireAdmin } from "@/lib/session";

export const metadata: Metadata = {
  title: { absolute: "Admin | Atelier" },
};

const sections = [
  {
    href: "/admin/products",
    title: "Products",
    description: "Add pieces, edit details, prices and categories, and set stock.",
  },
  {
    href: "/admin/categories",
    title: "Categories",
    description: "Add, rename and remove the categories products belong to.",
  },
  {
    href: "/admin/orders",
    title: "Orders",
    description: "Look up orders and their items, payment and delivery details.",
  },
];

export default function AdminPage() {
  return (
    <Suspense fallback={<AdminSkeleton />}>
      <AdminOverview />
    </Suspense>
  );
}

// The heading lives behind the check too, so non-admins see only the 404.
async function AdminOverview() {
  const admin = await requireAdmin("/admin");

  return (
    <>
      <header>
        <p className="text-eyebrow text-muted">Admin</p>
        <h1 className="mt-4 text-heading">Overview</h1>
        <p className="mt-4 text-muted">Signed in as {admin.email}.</p>
      </header>
      <ul className="mt-10 grid gap-px border bg-line sm:grid-cols-3">
        {sections.map((section) => (
          <li key={section.href} className="bg-background">
            <Link href={section.href} className="group block h-full p-6 md:p-8">
              <h2 className="text-body-sm">
                {section.title}{" "}
                <span aria-hidden="true" className="inline-block transition-transform group-hover:translate-x-1">
                  →
                </span>
              </h2>
              <p className="mt-2 text-meta">{section.description}</p>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}

function AdminSkeleton() {
  return (
    <div aria-hidden="true">
      <div className="h-4 w-24 animate-pulse bg-surface" />
      <div className="mt-4 h-8 w-48 animate-pulse bg-surface" />
      <div className="mt-10 h-32 animate-pulse bg-surface" />
    </div>
  );
}
