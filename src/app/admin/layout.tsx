import type { Metadata } from "next";
import Link from "next/link";
import { AdminNav } from "@/features/admin/components/admin-nav";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s | Admin | Atelier" },
  robots: { index: false, follow: false },
};

// Static shell only. It doesn't check the role: layouts don't re-render on
// client navigation, so each page checks with `requireAdmin()` behind
// <Suspense>, and each action with `assertAdmin()`. proxy.ts only sends
// visitors without a session cookie to sign-in.
export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <>
      <nav aria-label="Breadcrumb" className="container-page py-4 md:py-6">
        <ol className="flex flex-wrap items-center gap-2 text-caption text-muted">
          <li>
            <Link href="/" className="link-quiet">
              Home
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li aria-current="page" className="text-foreground">
            Admin
          </li>
        </ol>
      </nav>

      <div className="container-page grid gap-8 pt-2 pb-section lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-16 lg:pt-6">
        <aside>
          <p className="mb-2 hidden text-eyebrow text-muted lg:block">Admin</p>
          <AdminNav />
        </aside>
        <div className="min-w-0">{children}</div>
      </div>
    </>
  );
}
