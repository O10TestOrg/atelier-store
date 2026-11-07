import type { Metadata } from "next";
import { Suspense } from "react";
import { requireAdmin } from "@/lib/session";

export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false },
};

export default function AdminPage() {
  return (
    <section className="section container-page">
      <Suspense>
        <AdminDashboard />
      </Suspense>
    </section>
  );
}

// The heading lives behind the check too, so non-admins see only the 404.
async function AdminDashboard() {
  const admin = await requireAdmin("/admin");

  return (
    <header>
      <p className="text-eyebrow text-muted">Admin</p>
      <h1 className="mt-4 text-heading">Dashboard</h1>
      <p className="mt-4 text-muted">Signed in as {admin.email}.</p>
    </header>
  );
}
