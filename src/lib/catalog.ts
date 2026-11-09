// Editorial content for the storefront, plus pure product helpers.
// Product data lives in the database; see `@/lib/products`.

import type { Product } from "@/lib/products";

// Campaigns link to a category by slug; the home page drops any whose category
// no longer exists, so a deleted category can't leave a dead link.
export type Campaign = {
  category: string;
  eyebrow: string;
  title: string;
  cta: string;
  image: string;
  imageAlt: string;
};

// Must match the `search` allowed by `images.remotePatterns` in next.config.ts.
export const unsplash = (id: string) =>
  `https://images.unsplash.com/photo-${id}?w=2400&q=80`;

// The store is UK-based: products are priced, and charged, in pounds.
export const STORE_CURRENCY = "gbp";

const formatters = new Map<string, { whole: Intl.NumberFormat; exact: Intl.NumberFormat }>();

function formattersFor(currency: string) {
  let pair = formatters.get(currency);
  if (!pair) {
    const options = { style: "currency", currency: currency.toUpperCase() } as const;
    pair = {
      whole: new Intl.NumberFormat("en-GB", { ...options, maximumFractionDigits: 0 }),
      exact: new Intl.NumberFormat("en-GB", options),
    };
    formatters.set(currency, pair);
  }
  return pair;
}

// Prices are stored in minor units (pence). Whole-pound prices drop the ".00";
// anything with pence shows them, so the page always matches what Stripe
// charges. Orders pass their own currency: early orders were taken in USD.
export const formatPrice = (price: number, currency: string = STORE_CURRENCY) => {
  const { whole, exact } = formattersFor(currency);
  return (price % 100 === 0 ? whole : exact).format(price / 100);
};

export const hero = {
  eyebrow: "Autumn–Winter 2026",
  title: "Quiet structure, made to be lived in",
  description:
    "Tailored outerwear, supple leather and soft knits from the new season.",
  image: unsplash("1617019114583-affb34d1b3cd"),
  imageAlt: "Woman in a long ivory coat and sunglasses under an open sky",
};

export type StockState = "in-stock" | "low-stock" | "out-of-stock";

// At or below this many units, the shop says "Only N left" and the admin
// lists the product under "Low stock".
export const LOW_STOCK = 3;

export function getStockState(product: Pick<Product, "stock">): StockState {
  if (product.stock <= 0) return "out-of-stock";
  if (product.stock <= LOW_STOCK) return "low-stock";
  return "in-stock";
}

export const categoryHref = (categorySlug: string) =>
  `/collections/${categorySlug}`;

export const MAX_SEARCH_LENGTH = 100;

// Trims, collapses whitespace and caps length so equivalent queries share a
// cache entry.
export function normalizeSearchQuery(value: unknown) {
  if (typeof value !== "string") return "";
  return value.trim().replace(/\s+/g, " ").slice(0, MAX_SEARCH_LENGTH);
}

export const story = {
  eyebrow: "The Atelier",
  title: "Cut, stitched and finished by hand",
  description:
    "Every coat begins as a paper pattern in our workshop. Each piece passes through the same small team, from first cut to final press, so it wears in rather than out.",
  image: unsplash("1539109136881-3be0616acf4b"),
  imageAlt: "Woman in a pale blue coat standing in a cathedral square",
};

export const campaigns: Campaign[] = [
  {
    category: "ready-to-wear",
    eyebrow: "Clothing",
    title: "The new silhouettes",
    cta: "Shop clothing",
    image: unsplash("1509631179647-0177331693ae"),
    imageAlt: "Woman in striped wide-leg trousers posing against a green wall",
  },
  {
    category: "travel",
    eyebrow: "Travel",
    title: "Made for the journey",
    cta: "Shop travel",
    image: unsplash("1617137968427-85924c800a22"),
    imageAlt: "Man in a navy suit walking outside a glass building",
  },
];

// Where the contact page, receipts and account pages send customers. Emails
// sent by the store use it as their reply-to address. Read at build time on
// the static contact page, so set it before building.
export const CLIENT_SERVICES_EMAIL =
  process.env.CLIENT_SERVICES_EMAIL || "clientservices@atelier.example";

export const services = [
  {
    title: "Complimentary UK delivery",
    description: "Free standard delivery in the UK, signed for on arrival.",
  },
  {
    title: "Returns within 30 days",
    description: "Return or exchange unworn pieces online or in store.",
  },
  {
    title: "Signature packaging",
    description: "Every order arrives in our gift box, ready to give.",
  },
  {
    title: "Private appointments",
    description: "Meet a client advisor in store or by video call.",
  },
];
