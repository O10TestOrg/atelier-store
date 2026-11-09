import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { changeRole } from "@/app/admin/customers/actions";
import { ConfirmAction } from "@/components/admin/confirm-action";
import { AdminPager, AdminSearch, listHref, param } from "@/components/admin/list-controls";
import { SignalIcon } from "@/components/signal";
import { ADMIN_CUSTOMERS_PER_PAGE, getAdminCustomers, type Role } from "@/lib/customers";
import { formatShortDate } from "@/lib/dates";
import { parseInteger } from "@/lib/product-form";
import { requireAdmin } from "@/lib/session";

export const metadata: Metadata = {
  title: "Customers",
};

const roleFilters: { value: Role | undefined; label: string }[] = [
  { value: undefined, label: "Everyone" },
  { value: "customer", label: "Customers" },
  { value: "admin", label: "Admins" },
];

export default function AdminCustomersPage({ searchParams }: PageProps<"/admin/customers">) {
  return (
    <>
      <header>
        <p className="text-eyebrow text-muted">Admin</p>
        <h1 className="mt-4 text-heading">Customers</h1>
        <p className="mt-4 max-w-prose text-muted">
          Admins first. Only <strong>verified</strong> accounts can be made admins, and you
          can’t change your own role or remove the last admin.
        </p>
      </header>
      <Suspense fallback={<div aria-hidden="true" className="mt-10 h-96 animate-pulse bg-surface" />}>
        <CustomerList searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function CustomerList({ searchParams }: Pick<PageProps<"/admin/customers">, "searchParams">) {
  const admin = await requireAdmin("/admin/customers");

  const params = await searchParams;
  const roleParam = param(params.role);
  const role = roleFilters.find((f) => f.value === roleParam)?.value;
  const q = param(params.q).slice(0, 200);
  const page = Math.max(1, parseInteger(param(params.page)) ?? 1);
  const { customers, total } = await getAdminCustomers({ q, role, page });
  const pages = Math.max(1, Math.ceil(total / ADMIN_CUSTOMERS_PER_PAGE));
  const href = (changes: { role?: Role; page?: number }) =>
    listHref("/admin/customers", { role, q, ...changes });

  return (
    <>
      <div className="mt-8">
        <AdminSearch
          action="/admin/customers"
          label="Search customers"
          placeholder="Name or email"
          defaultValue={q}
          keep={{ role }}
        />
      </div>
      <nav aria-label="Filter by role" className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-body-sm">
        {roleFilters.map((f) => (
          <Link
            key={f.label}
            href={href({ role: f.value, page: 1 })}
            className="link-quiet aria-[current=page]:underline"
            aria-current={role === f.value ? "page" : undefined}
          >
            {f.label}
          </Link>
        ))}
      </nav>

      {customers.length === 0 ? (
        <p className="mt-6 border-t pt-10 text-muted">No accounts match.</p>
      ) : (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[46rem] border-t text-left text-body-sm">
            <caption className="sr-only">Accounts, admins first, then newest</caption>
            <thead className="text-meta">
              <tr className="border-b">
                <th scope="col" className="py-3 pr-4 font-normal">Account</th>
                <th scope="col" className="py-3 pr-4 font-normal">Joined</th>
                <th scope="col" className="py-3 pr-4 text-right font-normal">Paid orders</th>
                <th scope="col" className="py-3 pr-4 font-normal">Role</th>
                <th scope="col" className="py-3 font-normal">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {customers.map((customer) => {
                const isSelf = customer.id === admin.id;
                return (
                  <tr key={customer.id} className="border-b align-top">
                    <th scope="row" className="max-w-72 py-4 pr-4 font-normal">
                      {customer.name}
                      {isSelf && <span className="text-muted"> (you)</span>}
                      <p className="mt-1 break-all text-meta">{customer.email}</p>
                      {!customer.emailVerified && (
                        <p className="mt-1 flex items-center gap-1.5 text-caption">
                          <SignalIcon tone="warning" size="caption" />
                          Not verified
                        </p>
                      )}
                    </th>
                    <td className="py-4 pr-4 whitespace-nowrap">
                      <time dateTime={customer.createdAt.toISOString()}>
                        {formatShortDate(customer.createdAt)}
                      </time>
                    </td>
                    <td className="py-4 pr-4 text-right tabular-nums">
                      {customer.orderCount > 0 ? (
                        <Link
                          href={listHref("/admin/orders", { status: "all", q: customer.email })}
                          className="link-quiet"
                        >
                          {customer.orderCount}
                          <span className="sr-only"> orders from {customer.email}</span>
                        </Link>
                      ) : (
                        <span className="text-muted">0</span>
                      )}
                    </td>
                    <td className="py-4 pr-4">{customer.role === "admin" ? "Admin" : "Customer"}</td>
                    <td className="max-w-80 py-3">
                      {!isSelf && (
                        <RoleControl
                          id={customer.id}
                          name={customer.name}
                          email={customer.email}
                          role={customer.role}
                          verified={customer.emailVerified}
                        />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <AdminPager page={page} pages={pages} href={(p) => href({ page: p })} />
    </>
  );
}

function RoleControl({
  id,
  name,
  email,
  role,
  verified,
}: {
  id: string;
  name: string;
  email: string;
  role: Role;
  verified: boolean;
}) {
  if (role === "admin") {
    return (
      <ConfirmAction
        action={changeRole.bind(null, id, "customer")}
        label="Remove admin"
        size="sm"
        variant="ghost"
        confirm={`Remove admin rights from ${name} (${email})? They lose access to /admin on their next page load.`}
        confirmLabel="Remove admin"
      />
    );
  }
  return (
    <ConfirmAction
      action={changeRole.bind(null, id, "admin")}
      label="Make admin"
      size="sm"
      variant="ghost"
      confirm={`Make ${name} (${email}) an admin? They can change products, prices, stock and roles, and see every order.`}
      confirmLabel="Make admin"
      disabled={!verified}
      disabledReason={verified ? undefined : "Verify email first"}
    />
  );
}
