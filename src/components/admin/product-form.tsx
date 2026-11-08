"use client";

import { startTransition, useActionState, useEffect, useRef, type FormEvent } from "react";
import type { ProductActionResult } from "@/app/admin/products/actions";
import { Spinner, SelectField, TextArea, TextField } from "@/components/admin/fields";
import { PRODUCT_LIMITS } from "@/lib/product-form";
import { SignalMessage } from "@/components/signal";

type Category = { id: number; name: string };

export type ProductFormValues = {
  name: string;
  slug: string;
  reference: string;
  categoryId: number;
  price: number;
  image: string;
  imageAlt: string;
  detailFocus: string;
  isNew: boolean;
  colour: string;
  description: string;
  details: string[];
};

type Props = {
  action: (previous: ProductActionResult, formData: FormData) => Promise<ProductActionResult>;
  categories: Category[];
  // Present when editing: slug becomes read-only and stock is managed separately.
  product?: ProductFormValues;
};

// Pence to the pounds admins type ("1250" or "1250.50").
const toPounds = (pence: number) =>
  pence % 100 === 0 ? String(pence / 100) : (pence / 100).toFixed(2);

export function ProductForm({ action, categories, product }: Props) {
  const isEdit = Boolean(product);
  const [result, formAction, pending] = useActionState(action, null);
  const alertRef = useRef<HTMLParagraphElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const errors = result?.fieldErrors ?? {};

  useEffect(() => {
    if (!result || result.ok) return;
    // Focus the first invalid field, or the alert when the error isn't a field's.
    const invalid = formRef.current?.querySelector<HTMLElement>("[aria-invalid=true]");
    (invalid ?? alertRef.current)?.focus();
  }, [result]);

  // Submitted by hand so React doesn't reset the fields after the action: on
  // a validation error the admin's input must stay put.
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => formAction(formData));
  }

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      noValidate
      aria-busy={pending}
      className="flex flex-col gap-8"
    >
      <fieldset disabled={pending} className="grid min-w-0 gap-6 md:grid-cols-2">
        <TextField
          label="Name"
          name="name"
          defaultValue={product?.name}
          maxLength={PRODUCT_LIMITS.name}
          error={errors.name}
          required
        />
        {isEdit ? (
          <TextField
            label="Slug"
            name="slug"
            defaultValue={product?.slug}
            readOnly
            disabled
            hint="Fixed once created: bags and links depend on it."
          />
        ) : (
          <TextField
            label="Slug"
            name="slug"
            maxLength={PRODUCT_LIMITS.slug}
            autoCapitalize="none"
            spellCheck={false}
            error={errors.slug}
            hint="Used in the product URL, like leather-tote. Can’t be changed later."
            required
          />
        )}
        <TextField
          label="Reference"
          name="reference"
          defaultValue={product?.reference}
          maxLength={PRODUCT_LIMITS.reference}
          autoCapitalize="characters"
          spellCheck={false}
          error={errors.reference}
          hint="Unique stock reference, like AT-B0142."
          required
        />
        <SelectField
          label="Category"
          name="categoryId"
          defaultValue={product?.categoryId ?? ""}
          error={errors.categoryId}
          required
        >
          <option value="" disabled>
            Choose a category
          </option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </SelectField>
        <TextField
          label="Price (GBP)"
          name="price"
          inputMode="decimal"
          defaultValue={product ? toPounds(product.price) : undefined}
          error={errors.price}
          hint="In pounds, like 1250 or 1250.50. Includes VAT."
          required
        />
        {!isEdit && (
          <TextField
            label="Opening stock"
            name="stock"
            type="number"
            inputMode="numeric"
            min={0}
            max={PRODUCT_LIMITS.stock}
            step={1}
            defaultValue={0}
            error={errors.stock}
            hint="Units available to sell. 0 shows the piece as sold out."
          />
        )}
        <TextField
          label="Colour"
          name="colour"
          defaultValue={product?.colour}
          maxLength={PRODUCT_LIMITS.colour}
          error={errors.colour}
          required
        />
        <TextField
          label="Image URL"
          name="image"
          type="url"
          defaultValue={product?.image}
          spellCheck={false}
          error={errors.image}
          hint="An Unsplash photo URL ending in ?w=2400&q=80."
          className="md:col-span-2"
          required
        />
        <TextField
          label="Image description"
          name="imageAlt"
          defaultValue={product?.imageAlt}
          maxLength={PRODUCT_LIMITS.imageAlt}
          error={errors.imageAlt}
          hint="Alt text: what the photo shows, for screen readers."
          required
        />
        <TextField
          label="Close-up focus"
          name="detailFocus"
          defaultValue={product?.detailFocus ?? "50% 50%"}
          error={errors.detailFocus}
          hint="Where the detail crop centres, as x% y%."
        />
        <TextArea
          label="Description"
          name="description"
          rows={4}
          defaultValue={product?.description}
          maxLength={PRODUCT_LIMITS.description}
          error={errors.description}
          className="md:col-span-2"
          required
        />
        <TextArea
          label="Details"
          name="details"
          rows={5}
          defaultValue={product?.details.join("\n")}
          error={errors.details}
          hint="One per line."
          className="md:col-span-2"
        />
        <label className="flex items-center gap-3 text-body-sm md:col-span-2">
          <input
            type="checkbox"
            name="isNew"
            defaultChecked={product?.isNew}
            className="size-4 accent-current"
          />
          Show in New arrivals
        </label>
      </fieldset>

      <div className="flex flex-col gap-4 border-t pt-6 sm:flex-row sm:items-center">
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending && <Spinner />}
          {isEdit ? (pending ? "Saving…" : "Save changes") : pending ? "Creating…" : "Create product"}
        </button>
        <SignalMessage
          ref={alertRef}
          tone={result?.ok ? "success" : "danger"}
          role="status"
          tabIndex={-1}
          className="outline-none"
        >
          {result?.message}
        </SignalMessage>
      </div>
    </form>
  );
}
