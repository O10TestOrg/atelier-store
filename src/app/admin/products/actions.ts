"use server";

import { updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { FOREIGN_KEY_VIOLATION, UNIQUE_VIOLATION, pgError } from "@/lib/db-errors";
import {
  isValidId,
  parseProductForm,
  parseStock,
  type AdminActionResult,
  type FieldErrors,
  type ProductField,
} from "@/lib/product-form";
import { insertProduct, setStockIfUnchanged, updateProductDetails } from "@/lib/products";
import { assertAdmin } from "@/lib/session";

// Server Actions are public endpoints, whatever page renders them: each one
// checks the role first, before reading any input. Everything after that is
// still untrusted and validated here.

export type ProductActionResult = AdminActionResult<ProductField>;
export type StockActionResult = AdminActionResult;

const INVALID = "Check the highlighted fields.";
const GENERIC_ERROR = "Something went wrong. Please try again.";

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
  await assertAdmin();

  const parsed = parseProductForm(formData, "create");
  if (!parsed.ok) return { ok: false, message: INVALID, fieldErrors: parsed.fieldErrors };

  let id: number;
  try {
    id = await insertProduct(parsed.data);
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
export async function updateProduct(
  id: number,
  _previous: ProductActionResult,
  formData: FormData,
): Promise<ProductActionResult> {
  await assertAdmin();
  if (!isValidId(id)) return { ok: false, message: GENERIC_ERROR };

  const parsed = parseProductForm(formData, "edit");
  if (!parsed.ok) return { ok: false, message: INVALID, fieldErrors: parsed.fieldErrors };

  try {
    if (!(await updateProductDetails(id, parsed.data))) {
      return { ok: false, message: "This product no longer exists." };
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
  await assertAdmin();
  if (!isValidId(id)) return { ok: false, message: GENERIC_ERROR };

  const stock = parseStock(formData.get("stock"));
  const expected = parseStock(formData.get("expectedStock"));
  if (stock === null) return { ok: false, message: "Enter a whole number, 0 or more." };
  if (expected === null) return { ok: false, message: GENERIC_ERROR };
  if (stock === expected) return { ok: true, message: "No change." };

  let result: Awaited<ReturnType<typeof setStockIfUnchanged>>;
  try {
    result = await setStockIfUnchanged(id, expected, stock);
  } catch (error) {
    console.error("Could not update stock", { id, error });
    return { ok: false, message: GENERIC_ERROR };
  }
  if (!result) return { ok: false, message: "This product no longer exists." };

  updateTag("products");
  if (!result.updated) {
    return {
      ok: false,
      message: `Stock changed to ${result.stock} while you were editing. Review and save again.`,
    };
  }
  return { ok: true, message: "Stock updated." };
}
