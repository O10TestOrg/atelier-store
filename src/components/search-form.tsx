"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  useEffect,
  useRef,
  useState,
  useTransition,
  type FormEvent,
  type Ref,
} from "react";
import { CloseIcon, SearchIcon } from "@/components/icons";
import { MAX_SEARCH_LENGTH, normalizeSearchQuery } from "@/lib/catalog";

const DEBOUNCE_MS = 300;

// Results update as you type (debounced). Without JS it's a plain GET form.
export function SearchForm() {
  const router = useRouter();
  const pathname = usePathname();
  const urlQuery = useSearchParams().get("q") ?? "";
  const [value, setValue] = useState(urlQuery);
  const [isPending, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const inputRef = useRef<HTMLInputElement>(null);

  // Follow URL changes we didn't make (Back button, suggestion links).
  const [syncedQuery, setSyncedQuery] = useState(urlQuery);
  if (urlQuery !== syncedQuery) {
    setSyncedQuery(urlQuery);
    if (normalizeSearchQuery(value) !== normalizeSearchQuery(urlQuery)) setValue(urlQuery);
  }

  useEffect(() => () => clearTimeout(timer.current), []);

  function search(next: string) {
    clearTimeout(timer.current);
    const q = normalizeSearchQuery(next);
    if (q === normalizeSearchQuery(urlQuery)) return;
    startTransition(() => {
      router.replace(q ? `${pathname}?q=${encodeURIComponent(q)}` : pathname, {
        scroll: false,
      });
    });
  }

  function handleChange(next: string) {
    setValue(next);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => search(next), DEBOUNCE_MS);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    search(value);
    // Closes the on-screen keyboard on mobile once results are requested.
    inputRef.current?.blur();
  }

  function clear() {
    setValue("");
    search("");
    inputRef.current?.focus();
  }

  return (
    <SearchFormFields
      value={value}
      pending={isPending}
      inputRef={inputRef}
      onChange={handleChange}
      onSubmit={handleSubmit}
      onClear={value ? clear : undefined}
    />
  );
}

// Static version for the prerendered shell, before the URL is known.
export function SearchFormFallback() {
  return <SearchFormFields />;
}

function SearchFormFields({
  value,
  pending = false,
  inputRef,
  onChange,
  onSubmit,
  onClear,
}: {
  value?: string;
  pending?: boolean;
  inputRef?: Ref<HTMLInputElement>;
  onChange?: (value: string) => void;
  onSubmit?: (event: FormEvent<HTMLFormElement>) => void;
  onClear?: () => void;
}) {
  return (
    <form role="search" action="/search" onSubmit={onSubmit}>
      <label htmlFor="search-query" className="sr-only">
        Search products
      </label>
      <div className="relative">
        <SearchIcon className="pointer-events-none absolute top-1/2 left-0 -translate-y-1/2 text-muted" />
        <input
          ref={inputRef}
          id="search-query"
          name="q"
          type="search"
          value={value}
          defaultValue={value === undefined ? "" : undefined}
          onChange={onChange && ((event) => onChange(event.target.value))}
          placeholder="Search bags, colours, materials…"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          enterKeyHint="search"
          maxLength={MAX_SEARCH_LENGTH}
          className="block h-14 w-full border-0 border-b border-line-strong bg-transparent pr-12 pl-8 text-heading-sm outline-none placeholder:text-muted [&::-webkit-search-cancel-button]:hidden"
        />
        <div className="absolute top-1/2 right-0 flex -translate-y-1/2 items-center">
          {pending ? (
            <span className="flex size-11 items-center justify-center" role="status">
              <span className="sr-only">Searching…</span>
              <span
                aria-hidden="true"
                className="size-4 animate-spin rounded-full border border-current border-t-transparent text-muted"
              />
            </span>
          ) : (
            onClear && (
              <button type="button" onClick={onClear} className="btn-icon" aria-label="Clear search">
                <CloseIcon />
              </button>
            )
          )}
        </div>
      </div>
    </form>
  );
}
