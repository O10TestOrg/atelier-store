import Link from "next/link";
import { Suspense } from "react";
import { AccountNav, AccountNavItem } from "@/components/account-nav";
import { getCurrentUser } from "@/lib/session";

// The shell (breadcrumb, nav) is static. Each page checks the session itself
// with `requireUser()` behind <Suspense>, so this layout never blocks on it.
export default function AccountLayout({ children }: LayoutProps<"/account">) {
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
            My account
          </li>
        </ol>
      </nav>

      <div className="container-page grid gap-8 pt-2 pb-section lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-16 lg:pt-6">
        <aside>
          <p className="mb-2 hidden text-eyebrow text-muted lg:block">My account</p>
          <AccountNav
            extra={
              <Suspense>
                <AdminNavItem />
              </Suspense>
            }
          />
        </aside>
        <div className="min-w-0">{children}</div>
      </div>
    </>
  );
}

async function AdminNavItem() {
  const user = await getCurrentUser();
  if (user?.role !== "admin") return null;
  return <AccountNavItem href="/admin">Admin</AccountNavItem>;
}
