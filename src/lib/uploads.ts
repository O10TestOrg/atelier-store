// Product photo uploads go straight from the admin's browser to Vercel Blob;
// `/api/admin/uploads` only hands out short-lived upload tokens. Without
// `BLOB_READ_WRITE_TOKEN` uploads are off and product images must be
// Unsplash URLs.
// The type and size limits live in src/lib/product-form.ts, so the client
// field can share them.
import "server-only";

// The token reads `vercel_blob_rw_<storeId>_<secret>`, and the store serves
// public files from `<storeid>.public.blob.vercel-storage.com`. Keep in step
// with `images.remotePatterns` in next.config.ts.
export function getUploadHost(token = process.env.BLOB_READ_WRITE_TOKEN): string | null {
  const storeId = token?.split("_")[3];
  if (!storeId || !/^[A-Za-z0-9]+$/.test(storeId)) return null;
  return `${storeId.toLowerCase()}.public.blob.vercel-storage.com`;
}
