import type { NextConfig } from "next";

// A script-src CSP needs per-request nonces, which rules out the static shell
// (see the Next CSP guide), so this sticks to directives that don't: no
// framing (clickjacking), no <base> or plugin injection, and forms may only
// post here or redirect to Stripe Checkout.
const contentSecurityPolicy = [
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "object-src 'none'",
  "form-action 'self' https://checkout.stripe.com",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
];

// Uploaded product photos (`/api/admin/uploads`), served from this project's
// Blob store. Same derivation as `getUploadHost()` in src/lib/uploads.ts,
// which can't be imported here; set BLOB_READ_WRITE_TOKEN before building.
const blobStoreId = process.env.BLOB_READ_WRITE_TOKEN?.split("_")[3];
const uploadPatterns =
  blobStoreId && /^[A-Za-z0-9]+$/.test(blobStoreId)
    ? [
        {
          protocol: "https" as const,
          hostname: `${blobStoreId.toLowerCase()}.public.blob.vercel-storage.com`,
          pathname: "/products/**",
        },
      ]
    : [];

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  images: {
    // Sample imagery; sources must use the exact query string from `unsplash()`.
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
        pathname: "/photo-*",
        search: "?w=2400&q=80",
      },
      ...uploadPatterns,
    ],
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
