"use server";

import { updateTag } from "next/cache";
import {
  FOREIGN_KEY_VIOLATION,
  RESTRICT_VIOLATION,
  UNIQUE_VIOLATION,
  pgError,
} from "@/lib/db-errors";
import {
  isValidId,
  parseCategoryName,
  parseCategorySlug,
  type AdminActionResult,
} from "@/features/admin/product-form";
import { deleteCategory, insertCategory, renameCategory } from "@/features/catalog/products";
import { assertAdmin } from "@/lib/session";

// Same rules as the product actions: check the role first, then validate.

export type CategoryActionResult = AdminActionResult<"name" | "slug">;

const GENERIC_ERROR = "Something went wrong. Please try again.";

export async function createCategory(
  _previous: CategoryActionResult,
  formData: FormData,
): Promise<CategoryActionResult> {
  const admin = await assertAdmin();

  const { name, error: nameError } = parseCategoryName(formData.get("name"));
  const { slug, error: slugError } = parseCategorySlug(formData.get("slug"));
  if (!name || !slug) {
    return {
      ok: false,
      message: "Check the highlighted fields.",
      fieldErrors: { name: nameError, slug: slugError },
    };
  }

  try {
    await insertCategory({ name, slug }, admin);
  } catch (error) {
    if (pgError(error).code === UNIQUE_VIOLATION) {
      return {
        ok: false,
        message: "Check the highlighted fields.",
        fieldErrors: { slug: "Another category already uses this slug." },
      };
    }
    console.error("Could not create category", error);
    return { ok: false, message: GENERIC_ERROR };
  }
  updateTag("products");
  return { ok: true, message: `Added ${name}.` };
}

export async function updateCategoryName(
  id: number,
  _previous: CategoryActionResult,
  formData: FormData,
): Promise<CategoryActionResult> {
  const admin = await assertAdmin();
  if (!isValidId(id)) return { ok: false, message: GENERIC_ERROR };

  const { name, error } = parseCategoryName(formData.get("name"));
  if (!name) return { ok: false, message: "Check the name.", fieldErrors: { name: error } };

  try {
    if (!(await renameCategory(id, name, admin))) {
      return { ok: false, message: "This category no longer exists." };
    }
  } catch (error) {
    console.error("Could not rename category", { id, error });
    return { ok: false, message: GENERIC_ERROR };
  }
  updateTag("products");
  return { ok: true, message: "Saved." };
}

// Bound to `id`; the previous state useActionState passes is ignored.
export async function removeCategory(id: number): Promise<CategoryActionResult> {
  const admin = await assertAdmin();
  if (!isValidId(id)) return { ok: false, message: GENERIC_ERROR };

  try {
    if (!(await deleteCategory(id, admin))) {
      return { ok: false, message: "This category no longer exists." };
    }
  } catch (error) {
    const { code } = pgError(error);
    if (code === RESTRICT_VIOLATION || code === FOREIGN_KEY_VIOLATION) {
      return { ok: false, message: "Move or remove this category’s products first." };
    }
    console.error("Could not delete category", { id, error });
    return { ok: false, message: GENERIC_ERROR };
  }
  updateTag("products");
  return { ok: true, message: "Deleted." };
}
