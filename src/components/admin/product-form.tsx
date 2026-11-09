"use client";

import { startTransition, useActionState, useEffect, useRef, type FormEvent } from "react";
import type { ProductActionResult } from "@/app/admin/products/actions";
import { Spinner, SelectField, TextArea, TextField } from "@/components/admin/fields";
import { ImageField } from "@/components/admin/image-field";
import { formatPrice } from "@/lib/catalog";
import { PRODUCT_LIMITS, toPounds } from "@/lib/product-form";
import { Notice, SignalMessage } from "@/components/signal";

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
  // Edit only. The save applies only while the product still has this.
  version: number;
  // Never published, so nobody has it in a bag or a link yet.
  publishedAt: Date | null;
};

type Props = {
  action: (previous: ProductActionResult, formData: FormData) => Promise<ProductActionResult>;
  categories: Category[];
  // Present when editing: stock is managed separately, and the slug is fixed
  // once the product has been published.
  product?: ProductFormValues;
  uploadHost: string | null;
};

export function ProductForm({ action, categories, product, uploadHost }: Props) {
  const isEdit = Boolean(product);
  const slugFixed = Boolean(product?.publishedAt);
  const [result, formAction, pending] = useActionState(action, null);
  const alertRef = useRef<HTMLParagraphElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const errors = result?.fieldErrors ?? {};

  const confirmPrice = result?.confirmPrice;

  useEffect(() => {
    if (!result || result.ok || result.confirmPrice) return;
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
      {product && <input type="hidden" name="version" value={product.version} />}
      <fieldset disabled={pending} className="grid min-w-0 gap-6 md:grid-cols-2">
        <TextField
          label="Name"
          name="name"
          defaultValue={product?.name}
          maxLength={PRODUCT_LIMITS.name}
          error={errors.name}
          required
        />
        {slugFixed ? (
          <TextField
            label="Slug"
            name="slug"
            defaultValue={product?.slug}
            readOnly
            disabled
            hint="Fixed since it was published: bags and links depend on it. To replace a mistaken one, archive this product and add a new one."
          />
        ) : (
          <TextField
            label="Slug"
            name="slug"
            defaultValue={product?.slug}
            maxLength={PRODUCT_LIMITS.slug}
            autoCapitalize="none"
            spellCheck={false}
            error={errors.slug}
            hint="Used in the product URL, like leather-tote. You can change it until the product is first published."
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
          hint={`In pounds, like 1250 or 1250.50, and at least £${toPounds(PRODUCT_LIMITS.minPrice)}. Includes VAT.`}
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
        <ImageField defaultValue={product?.image} error={errors.image} uploadHost={uploadHost} />
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

      {confirmPrice && (
        <Notice tone="warning" role="alert">
          <input type="hidden" name="confirmPrice" value={confirmPrice.to} />
          <p>
            The price changes from {formatPrice(confirmPrice.from)} to{" "}
            <strong className="font-medium">{formatPrice(confirmPrice.to)}</strong>. Shoppers see
            the new price as soon as you save. If that’s right, confirm below; otherwise correct
            the price.
          </p>
        </Notice>
      )}

      <div className="flex flex-col gap-4 border-t pt-6 sm:flex-row sm:items-center">
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending && <Spinner />}
          {isEdit
            ? pending
              ? "Saving…"
              : confirmPrice
                ? "Confirm price and save"
                : "Save changes"
            : pending
              ? "Creating…"
              : "Create product"}
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
