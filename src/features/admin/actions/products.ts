"use server";

import { updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { productStatuses, type ProductStatus } from "@/db/schema";
import { FOREIGN_KEY_VIOLATION, UNIQUE_VIOLATION, pgError } from "@/lib/db-errors";
import { BIG_PRICE_CHANGE, diffFields, priceChangeRatio } from "@/lib/field-changes";
import {
  isValidId,
  parseInteger,
  parseProductForm,
  parseStock,
  type AdminActionResult,
  type FieldErrors,
  type ProductField,
} from "@/features/admin/product-form";
import {
  deleteProductIfUnordered,
  getAdminProduct,
  insertProduct,
  productHasOrders,
  setProductStatus,
  setStockIfUnchanged,
  updateProductDetails,
} from "@/features/catalog/products";
import { sendRestockAlerts } from "@/features/restock-alerts/restock-alerts";
import { assertAdmin } from "@/lib/session";
import { getUploadHost } from "@/lib/uploads";

// Server Actions are public endpoints, whatever page renders them: each one
// checks the role first, before reading any input. Everything after that is
// still untrusted and validated here.

export type ProductActionResult =
  | (NonNullable<AdminActionResult<ProductField>> & {
      // A big price move the admin hasn't confirmed yet, in pence.
      confirmPrice?: { from: number; to: number };
    })
  | null;
export type StockActionResult = AdminActionResult;

const INVALID = "Check the highlighted fields.";
const GENERIC_ERROR = "Something went wrong. Please try again.";
const GONE = "This product no longer exists.";
const STALE =
  "Someone changed this product since you opened it. Reload the page to see their changes, then make yours again.";

// Unique slug or reference, or a category deleted while the form was open.
function constraintErrors(error: unknown): FieldErrors<ProductField> | null {
  const { code, constraint } = pgError(error);
  if (code === UNIQUE_VIOLATION && constraint === "products_slug_unique") {
    return { slug: "Another product already uses this slug." };
  }
  if (code === UNIQUE_VIOLATION && constraint === "products_reference_unique") {
    return { reference: "Another product already uses this reference." };
  }
  if (code === FOREIGN_KEY_VIOLATION) return { categoryId: "Choose a category." };
  return null;
}

export async function createProduct(
  _previous: ProductActionResult,
  formData: FormData,
): Promise<ProductActionResult> {
  const admin = await assertAdmin();

  const parsed = parseProductForm(formData, "create", { uploadHost: getUploadHost() });
  if (!parsed.ok) return { ok: false, message: INVALID, fieldErrors: parsed.fieldErrors };

  let id: number;
  try {
    id = await insertProduct(parsed.data, admin);
  } catch (error) {
    const fieldErrors = constraintErrors(error);
    if (fieldErrors) return { ok: false, message: INVALID, fieldErrors };
    console.error("Could not create product", error);
    return { ok: false, message: GENERIC_ERROR };
  }
  updateTag("products");
  redirect(`/admin/products/${id}/edit?created=1`);
}

// `id` is bound on the server, but a bound argument can still be forged.
// The form posts the `version` it was rendered with; the save only applies
// while the product still has it.
export async function updateProduct(
  id: number,
  _previous: ProductActionResult,
  formData: FormData,
): Promise<ProductActionResult> {
  const admin = await assertAdmin();
  if (!isValidId(id)) return { ok: false, message: GENERIC_ERROR };
  const version = parseInteger(formData.get("version"));
  if (version === null) return { ok: false, message: GENERIC_ERROR };

  const current = await getAdminProduct(id);
  if (!current) return { ok: false, message: GONE };
  if (current.version !== version) return { ok: false, message: STALE };

  const parsed = parseProductForm(formData, "edit", {
    uploadHost: getUploadHost(),
    slugEditable: current.publishedAt === null,
  });
  if (!parsed.ok) return { ok: false, message: INVALID, fieldErrors: parsed.fieldErrors };

  const { slug, ...details } = parsed.data;
  const input = slug !== undefined && slug !== current.slug ? { ...details, slug } : details;

  // A typo like 125 for 1250 goes live at once, so a big move needs a second
  // save that repeats the confirmed price.
  const { price } = input;
  if (
    priceChangeRatio(current.price, price) > BIG_PRICE_CHANGE &&
    formData.get("confirmPrice") !== String(price)
  ) {
    return {
      ok: false,
      message: "That’s a big price change. Check it, then confirm.",
      confirmPrice: { from: current.price, to: price },
    };
  }

  const changes = diffFields(current, input);
  if (Object.keys(changes).length === 0) return { ok: true, message: "No changes to save." };

  try {
    if (!(await updateProductDetails(id, version, input, changes, admin))) {
      // The version moved between the read and the write.
      return { ok: false, message: (await getAdminProduct(id)) ? STALE : GONE };
    }
  } catch (error) {
    const fieldErrors = constraintErrors(error);
    if (fieldErrors) return { ok: false, message: INVALID, fieldErrors };
    console.error("Could not update product", { id, error });
    return { ok: false, message: GENERIC_ERROR };
  }
  updateTag("products");
  return { ok: true, message: "Saved." };
}

// Sets stock to an absolute number, but only if it still holds the value the
// admin saw: checkouts take stock concurrently.
export async function updateStock(
  id: number,
  _previous: StockActionResult,
  formData: FormData,
): Promise<StockActionResult> {
  const admin = await assertAdmin();
  if (!isValidId(id)) return { ok: false, message: GENERIC_ERROR };

  const stock = parseStock(formData.get("stock"));
  const expected = parseStock(formData.get("expectedStock"));
  if (stock === null) return { ok: false, message: "Enter a whole number, 0 or more." };
  if (expected === null) return { ok: false, message: GENERIC_ERROR };
  if (stock === expected) return { ok: true, message: "No change." };

  let result: Awaited<ReturnType<typeof setStockIfUnchanged>>;
  try {
    result = await setStockIfUnchanged(id, expected, stock, admin);
  } catch (error) {
    console.error("Could not update stock", { id, error });
    return { ok: false, message: GENERIC_ERROR };
  }
  if (!result) return { ok: false, message: GONE };

  updateTag("products");
  if (!result.updated) {
    return {
      ok: false,
      message: `Stock changed to ${result.stock} while you were editing. Review and save again.`,
    };
  }
  // A restock emails anyone waiting for the piece, after the response.
  if (stock > 0) after(() => sendRestockAlerts());
  return { ok: true, message: "Stock updated." };
}

const isProductStatus = (value: unknown): value is ProductStatus =>
  productStatuses.includes(value as ProductStatus);

const statusMessages: Record<ProductStatus, string> = {
  active: "Published. It’s in the store now.",
  archived: "Archived. It’s out of the store, and you can publish it again any time.",
  draft: "Moved to draft.",
};

// Publish or archive. Products only go back to draft by never having left
// it: once published, archive is the way out of the store. Bound to `id` and
// the target status; both are re-checked.
export async function changeProductStatus(
  id: number,
  to: ProductStatus,
): Promise<AdminActionResult> {
  const admin = await assertAdmin();
  if (!isValidId(id) || !isProductStatus(to) || to === "draft") {
    return { ok: false, message: GENERIC_ERROR };
  }

  const current = await getAdminProduct(id);
  if (!current) return { ok: false, message: GONE };
  if (current.status === to) return { ok: true, message: statusMessages[to] };

  try {
    if (!(await setProductStatus(id, current.status, to, admin, current.name))) {
      return { ok: false, message: "Its status changed while you were looking. Reload and try again." };
    }
  } catch (error) {
    console.error("Could not change product status", { id, to, error });
    return { ok: false, message: GENERIC_ERROR };
  }
  updateTag("products");
  // Shoppers may have asked to hear when it's back.
  if (to === "active" && current.stock > 0) after(() => sendRestockAlerts());
  return { ok: true, message: statusMessages[to] };
}

// Permanent delete, for drafts and archived products no order includes (test
// pieces, duplicates). The statement re-checks both conditions.
export async function deleteProduct(id: number): Promise<AdminActionResult> {
  const admin = await assertAdmin();
  if (!isValidId(id)) return { ok: false, message: GENERIC_ERROR };

  const current = await getAdminProduct(id);
  if (!current) return { ok: false, message: GONE };
  if (current.status === "active") {
    return { ok: false, message: "Archive it first: live products can’t be deleted." };
  }

  let deleted: boolean;
  try {
    deleted = await deleteProductIfUnordered(id, admin, current.name);
  } catch (error) {
    console.error("Could not delete product", { id, error });
    return { ok: false, message: GENERIC_ERROR };
  }
  if (!deleted) {
    return {
      ok: false,
      message: (await productHasOrders(id))
        ? "Orders include this product, so it can only be archived."
        : "It changed while you were looking. Reload and try again.",
    };
  }
  updateTag("products");
  redirect("/admin/products?deleted=1");
}
