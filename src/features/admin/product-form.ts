// Parses and validates the admin product and category forms. Pure, so the
// client forms can share the limits; the server is what enforces them.
import type { ProductDetails } from "@/features/catalog/products";

export const PRODUCT_LIMITS = {
  name: 120,
  slug: 120,
  reference: 40,
  colour: 80,
  imageAlt: 200,
  description: 2000,
  details: 20,
  detail: 200,
  stock: 100_000,
  // £1,000,000.00, in pence.
  price: 100_000_000,
  // 50p. Lower prices make Stripe refuse the session or, at £0, complete it
  // without a payment the store would ever treat as paid.
  minPrice: 50,
} as const;

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const PRICE_PATTERN = /^\d+(?:\.\d{1,2})?$/;
const INTEGER_PATTERN = /^\d+$/;
const FOCUS_PATTERN = /^(?:100|\d{1,2})% (?:100|\d{1,2})%$/;
// Must match `unsplash()` in catalog.ts and `images.remotePatterns` in
// next.config.ts, or next/image refuses to load it.
const IMAGE_PATTERN = /^https:\/\/images\.unsplash\.com\/photo-[A-Za-z0-9-]+\?w=2400&q=80$/;
// What `/api/admin/uploads` produces: a file under products/ in our Blob store.
const UPLOAD_PATH_PATTERN = /^\/products\/[A-Za-z0-9._-]+$/;

// What the token route lets `ImageField` upload.
export const UPLOAD_CONTENT_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"];
export const UPLOAD_MAX_BYTES = 10 * 1024 * 1024;

// A product photo next/image will load: a sample Unsplash URL, or an upload
// to this store's Blob host (`getUploadHost()`; null when uploads are off).
export function isAllowedImageUrl(value: string, uploadHost: string | null) {
  if (IMAGE_PATTERN.test(value)) return true;
  if (!uploadHost) return false;
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      url.host === uploadHost &&
      UPLOAD_PATH_PATTERN.test(url.pathname) &&
      !url.search &&
      !url.hash
    );
  } catch {
    return false;
  }
}

export type ProductField =
  | "name"
  | "slug"
  | "reference"
  | "categoryId"
  | "price"
  | "stock"
  | "image"
  | "imageAlt"
  | "detailFocus"
  | "colour"
  | "description"
  | "details";

export type FieldErrors<F extends string> = Partial<Record<F, string>>;

export type AdminActionResult<F extends string = never> = {
  ok: boolean;
  message: string;
  fieldErrors?: FieldErrors<F>;
} | null;

// What every admin action returns to a viewer (the read-only demo login).
export const READ_ONLY = {
  ok: false,
  message: "This is a read-only demo account, so changes aren’t saved.",
} as const;

type Parsed<T, F extends string> =
  | { ok: true; data: T }
  | { ok: false; fieldErrors: FieldErrors<F> };

export const text = (formData: FormData, name: string) => {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
};

export function parseInteger(value: unknown, max = Number.MAX_SAFE_INTEGER) {
  if (typeof value !== "string" || !INTEGER_PATTERN.test(value.trim())) return null;
  const number = Number(value.trim());
  return Number.isSafeInteger(number) && number <= max ? number : null;
}

export const isValidId = (value: unknown): value is number =>
  Number.isSafeInteger(value) && (value as number) > 0;

// Pounds as typed ("1250" or "1250.50") to integer pence.
function parsePrice(value: string) {
  const normalized = value.replace(/[£,\s]/g, "");
  if (!PRICE_PATTERN.test(normalized)) return null;
  const [pounds, pence = ""] = normalized.split(".");
  const price = Number(pounds) * 100 + Number(pence.padEnd(2, "0"));
  return Number.isSafeInteger(price) && price <= PRODUCT_LIMITS.price ? price : null;
}

// Pence to the pounds admins type ("1250" or "1250.50").
export const toPounds = (pence: number) =>
  pence % 100 === 0 ? String(pence / 100) : (pence / 100).toFixed(2);

function required(value: string, label: string, max: number) {
  if (!value) return `Enter ${label}.`;
  if (value.length > max) return `Keep this under ${max} characters.`;
}

export function parseSlug(value: string) {
  if (!value) return { error: "Enter a slug." };
  if (value.length > PRODUCT_LIMITS.slug) {
    return { error: `Keep this under ${PRODUCT_LIMITS.slug} characters.` };
  }
  if (!SLUG_PATTERN.test(value)) {
    return { error: "Use lowercase letters, numbers and single hyphens, like leather-tote." };
  }
  return { slug: value };
}

type ParseOptions = {
  // This store's Blob host, so uploaded photos are accepted.
  uploadHost: string | null;
  // Edit only: the product was never published, so its slug can change.
  slugEditable?: boolean;
};

// `mode: "create"` also reads slug and opening stock. Once the product exists,
// stock is managed separately and slug only comes back while `slugEditable`.
export function parseProductForm(
  formData: FormData,
  mode: "create",
  options: ParseOptions,
): Parsed<ProductDetails & { slug: string; stock: number }, ProductField>;
export function parseProductForm(
  formData: FormData,
  mode: "edit",
  options: ParseOptions,
): Parsed<ProductDetails & { slug?: string }, ProductField>;
export function parseProductForm(
  formData: FormData,
  mode: "create" | "edit",
  options: ParseOptions,
): Parsed<ProductDetails & { slug?: string; stock?: number }, ProductField> {
  const errors: FieldErrors<ProductField> = {};
  const L = PRODUCT_LIMITS;

  const name = text(formData, "name");
  const reference = text(formData, "reference").toUpperCase();
  const colour = text(formData, "colour");
  const image = text(formData, "image");
  const imageAlt = text(formData, "imageAlt");
  const description = text(formData, "description");
  const detailFocus = text(formData, "detailFocus") || "50% 50%";
  const details = text(formData, "details")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  errors.name = required(name, "a name", L.name);
  errors.reference = required(reference, "a reference", L.reference);
  errors.colour = required(colour, "a colour", L.colour);
  errors.imageAlt = required(imageAlt, "a description of the image", L.imageAlt);
  errors.description = required(description, "a description", L.description);

  if (!image) errors.image = options.uploadHost ? "Upload a photo or enter an image URL." : "Enter an image URL.";
  else if (!isAllowedImageUrl(image, options.uploadHost)) {
    errors.image = options.uploadHost
      ? "Upload a photo, or use an Unsplash URL ending in ?w=2400&q=80."
      : "Use an Unsplash URL ending in ?w=2400&q=80.";
  }
  if (!FOCUS_PATTERN.test(detailFocus)) {
    errors.detailFocus = "Use two percentages, like 50% 40%.";
  }
  if (details.length > L.details) errors.details = `Add at most ${L.details} details.`;
  else if (details.some((line) => line.length > L.detail)) {
    errors.details = `Keep each detail under ${L.detail} characters.`;
  }

  const categoryId = parseInteger(formData.get("categoryId"));
  if (!isValidId(categoryId)) errors.categoryId = "Choose a category.";

  const priceText = text(formData, "price");
  const price = parsePrice(priceText);
  if (!priceText) errors.price = "Enter a price.";
  else if (price === null) errors.price = "Enter a price in pounds, like 1250 or 1250.50.";
  else if (price < L.minPrice) errors.price = `Enter at least £${toPounds(L.minPrice)}.`;

  let slug: string | undefined;
  let stock: number | undefined;
  if (mode === "create" || options.slugEditable) {
    const parsedSlug = parseSlug(text(formData, "slug"));
    slug = parsedSlug.slug;
    errors.slug = parsedSlug.error;
  }
  if (mode === "create") {
    stock = parseInteger(text(formData, "stock") || "0", L.stock) ?? undefined;
    if (stock === undefined) {
      errors.stock = `Enter a whole number from 0 to ${L.stock.toLocaleString("en-US")}.`;
    }
  }

  const fieldErrors = Object.fromEntries(
    Object.entries(errors).filter(([, message]) => message),
  ) as FieldErrors<ProductField>;
  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };

  return {
    ok: true,
    data: {
      name,
      reference,
      categoryId: categoryId!,
      price: price!,
      image,
      imageAlt,
      detailFocus,
      isNew: formData.get("isNew") === "on",
      colour,
      description,
      details,
      ...(slug !== undefined && { slug }),
      ...(mode === "create" && { stock }),
    },
  };
}

export function parseStock(value: unknown) {
  return parseInteger(value, PRODUCT_LIMITS.stock);
}

// `/collections/new` is New arrivals, a static route that would shadow a
// category with that slug.
export const RESERVED_CATEGORY_SLUGS: readonly string[] = ["new"];

export function parseCategorySlug(value: unknown) {
  const parsed = parseSlug(typeof value === "string" ? value.trim() : "");
  if (parsed.slug && RESERVED_CATEGORY_SLUGS.includes(parsed.slug)) {
    return { error: `“${parsed.slug}” is reserved for New arrivals. Choose another slug.` };
  }
  return parsed;
}

export const CATEGORY_NAME_MAX = 60;

export function parseCategoryName(value: unknown) {
  const name = typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
  if (!name) return { error: "Enter a name." };
  if (name.length > CATEGORY_NAME_MAX) {
    return { error: `Keep this under ${CATEGORY_NAME_MAX} characters.` };
  }
  return { name };
}
