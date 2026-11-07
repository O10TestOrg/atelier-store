"use client";

import { startTransition, useActionState, useId, type FormEvent } from "react";
import type { CategoryActionResult } from "@/app/admin/categories/actions";
import { Spinner, TextField } from "@/components/admin/fields";
import { CATEGORY_NAME_MAX, PRODUCT_LIMITS } from "@/lib/product-form";

type Action<Args extends unknown[]> = (
  previous: CategoryActionResult,
  ...args: Args
) => Promise<CategoryActionResult>;

// Submitted by hand so React keeps the typed values after a failed attempt.
function submitWith(formAction: (formData: FormData) => void) {
  return (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => formAction(formData));
  };
}

export function CreateCategoryForm({ action }: { action: Action<[FormData]> }) {
  const [result, formAction, pending] = useActionState(action, null);
  const errors = result?.fieldErrors ?? {};

  return (
    <form
      onSubmit={submitWith(formAction)}
      noValidate
      aria-busy={pending}
      // Remounts, clearing the fields, once a category has been added.
      key={result?.ok ? result.message : "form"}
      className="flex flex-col gap-6"
    >
      <fieldset disabled={pending} className="grid min-w-0 gap-6 sm:grid-cols-2">
        <TextField label="Name" name="name" maxLength={CATEGORY_NAME_MAX} error={errors.name} required />
        <TextField
          label="Slug"
          name="slug"
          maxLength={PRODUCT_LIMITS.slug}
          autoCapitalize="none"
          spellCheck={false}
          error={errors.slug}
          hint="Its collection URL, like /collections/bags. Can’t be changed later."
          required
        />
      </fieldset>
      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending && <Spinner />}
          {pending ? "Adding…" : "Add category"}
        </button>
        <p role="status" className={`text-body-sm ${result?.ok ? "text-success" : "text-danger"}`}>
          {result?.message}
        </p>
      </div>
    </form>
  );
}

type RowProps = {
  name: string;
  productCount: number;
  rename: Action<[FormData]>;
  remove: Action<[]>;
};

// Inline rename, plus delete for categories with no products. The server
// enforces that too: the foreign key refuses to delete a category in use.
export function CategoryRow({ name, productCount, rename, remove }: RowProps) {
  const [renameResult, renameAction, renaming] = useActionState(rename, null);
  const [removeResult, removeAction, removing] = useActionState(remove, null);
  const id = useId();
  const result = removeResult ?? renameResult;
  const busy = renaming || removing;

  return (
    <div className="flex flex-col gap-2 py-4">
      <div className="flex flex-wrap items-end gap-3">
        <form onSubmit={submitWith(renameAction)} noValidate className="flex items-end gap-2">
          <div>
            <label htmlFor={id} className="sr-only">
              Name of {name}
            </label>
            <input
              id={id}
              name="name"
              defaultValue={name}
              maxLength={CATEGORY_NAME_MAX}
              disabled={busy}
              aria-invalid={renameResult && !renameResult.ok ? true : undefined}
              aria-describedby={`${id}-status`}
              className="block h-10 w-56 max-w-full border bg-background px-3 text-body outline-none transition-colors hover:border-line-strong focus-visible:border-line-strong disabled:bg-surface aria-invalid:border-danger"
            />
          </div>
          <button type="submit" className="btn btn-secondary btn-sm h-10" disabled={busy}>
            {renaming && <Spinner />}
            Rename
          </button>
        </form>
        <form action={removeAction}>
          <button
            type="submit"
            className="btn btn-ghost btn-sm h-10"
            disabled={busy || productCount > 0}
            title={productCount > 0 ? "Move or remove its products first" : undefined}
          >
            {removing && <Spinner />}
            Delete<span className="sr-only"> {name}</span>
          </button>
        </form>
      </div>
      <p
        id={`${id}-status`}
        role="status"
        className={`text-caption empty:hidden ${result?.ok ? "text-muted" : "text-danger"}`}
      >
        {result?.message}
      </p>
    </div>
  );
}
