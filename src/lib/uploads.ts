// Product photo uploads go straight from the admin's browser to Vercel Blob;
// `/api/admin/uploads` only hands out short-lived upload tokens. Without
// `BLOB_READ_WRITE_TOKEN` uploads are off and product images must be
// Unsplash URLs.
import "server-only";

export const UPLOAD_CONTENT_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"];
export const UPLOAD_MAX_BYTES = 10 * 1024 * 1024;

// The token reads `vercel_blob_rw_<storeId>_<secret>`, and the store serves
// public files from `<storeid>.public.blob.vercel-storage.com`. Keep in step
// with `images.remotePatterns` in next.config.ts.
export function getUploadHost(token = process.env.BLOB_READ_WRITE_TOKEN): string | null {
  const storeId = token?.split("_")[3];
  if (!storeId || !/^[A-Za-z0-9]+$/.test(storeId)) return null;
  return `${storeId.toLowerCase()}.public.blob.vercel-storage.com`;
}
