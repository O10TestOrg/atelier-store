import Form from "next/form";
import Link from "next/link";
import { ArrowLeftIcon, ArrowRightIcon } from "@/components/icons";
import { parseInteger } from "@/lib/product-form";

// Search box and pager for the admin lists. Both are plain GET links and
// forms, so filters live in the URL and work without JavaScript.

type SearchProps = {
  action: string;
  label: string;
  placeholder?: string;
  defaultValue?: string;
  // Other filters to keep when searching.
  keep?: Record<string, string | undefined>;
};

export function AdminSearch({ action, label, placeholder, defaultValue, keep = {} }: SearchProps) {
  return (
    <Form action={action} role="search" className="flex max-w-xl items-end gap-2">
      {Object.entries(keep).map(([name, value]) =>
        value ? <input key={name} type="hidden" name={name} value={value} /> : null,
      )}
      <label className="min-w-0 flex-1 text-body-sm">
        <span className="sr-only">{label}</span>
        <input
          type="search"
          name="q"
          defaultValue={defaultValue}
          placeholder={placeholder}
          maxLength={200}
          spellCheck={false}
          autoCapitalize="none"
          className="block h-10 w-full border bg-background px-3 text-body outline-none transition-colors hover:border-line-strong focus-visible:border-line-strong"
        />
      </label>
      <button type="submit" className="btn btn-secondary btn-sm h-10">
        Search
      </button>
    </Form>
  );
}

type PagerProps = {
  page: number;
  pages: number;
  href: (page: number) => string;
  newer?: string;
  older?: string;
};

export function AdminPager({ page, pages, href, newer = "Previous", older = "Next" }: PagerProps) {
  if (pages <= 1) return null;
  return (
    <nav aria-label="Pages" className="mt-8 flex items-center justify-between gap-4 text-body-sm">
      {page > 1 ? (
        <Link href={href(page - 1)} className="link-quiet">
          <ArrowLeftIcon /> {newer}
        </Link>
      ) : (
        <span />
      )}
      <p className="text-meta">
        Page {Math.min(page, pages)} of {pages}
      </p>
      {page < pages ? (
        <Link href={href(page + 1)} className="link-quiet">
          {older} <ArrowRightIcon />
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}

// Builds a list URL from its filters, leaving out empty values and page 1.
export function listHref(path: string, params: Record<string, string | number | undefined>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === "" || (key === "page" && value === 1)) continue;
    search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `${path}?${query}` : path;
}

// First value of a search param, as a string.
export const param = (value: string | string[] | undefined) =>
  (Array.isArray(value) ? value[0] : value)?.trim() ?? "";

// The `page` search param as a page number; 1 when missing or invalid.
export const pageParam = (value: string | string[] | undefined) =>
  Math.max(1, parseInteger(param(value)) ?? 1);

// How many pages `total` rows fill, at least one so an empty list has a page.
export const pageCount = (total: number, perPage: number) =>
  Math.max(1, Math.ceil(total / perPage));
