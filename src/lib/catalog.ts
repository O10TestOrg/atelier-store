// Editorial content for the storefront, plus pure product helpers.
// Product data lives in the database; see `@/lib/products`.

import type { Product } from "@/lib/products";

export type Collection = {
  slug: string;
  title: string;
  image: string;
  imageAlt: string;
};

export type Campaign = {
  eyebrow: string;
  title: string;
  href: string;
  cta: string;
  image: string;
  imageAlt: string;
};

// Must match the `search` allowed by `images.remotePatterns` in next.config.ts.
export const unsplash = (id: string) =>
  `https://images.unsplash.com/photo-${id}?w=2400&q=80`;

const priceFormat = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

// Prices are stored in cents.
export const formatPrice = (price: number) => priceFormat.format(price / 100);

export const hero = {
  eyebrow: "Autumn–Winter 2026",
  title: "Quiet structure, made to be lived in",
  description:
    "Tailored outerwear, supple leather and soft knits from the new season.",
  image: unsplash("1617019114583-affb34d1b3cd"),
  imageAlt: "Woman in a long ivory coat and sunglasses under an open sky",
};

export const collections: Collection[] = [
  {
    slug: "leather-goods",
    title: "Leather Goods",
    image: unsplash("1584917865442-de89df76afd3"),
    imageAlt: "Red structured top-handle leather bag on a plinth",
  },
  {
    slug: "ready-to-wear",
    title: "Ready-to-Wear",
    image: unsplash("1558769132-cb1aea458c5e"),
    imageAlt: "Neutral knitwear and shirts hanging on a rail",
  },
  {
    slug: "shoes",
    title: "Shoes",
    image: unsplash("1543163521-1bf539c55dd2"),
    imageAlt: "Pair of floral print stiletto heels against a pale blue wall",
  },
  {
    slug: "jewelry",
    title: "Jewelry",
    image: unsplash("1535632066927-ab7c9ab60908"),
    imageAlt: "Pair of drop earrings with blue stones resting on a green leaf",
  },
];

export type StockState = "in-stock" | "low-stock" | "out-of-stock";

const LOW_STOCK_THRESHOLD = 3;

export function getStockState(product: Product): StockState {
  if (product.stock <= 0) return "out-of-stock";
  if (product.stock <= LOW_STOCK_THRESHOLD) return "low-stock";
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
    eyebrow: "Women",
    title: "The new silhouettes",
    href: "/women",
    cta: "Shop women",
    image: unsplash("1509631179647-0177331693ae"),
    imageAlt: "Woman in striped wide-leg trousers posing against a green wall",
  },
  {
    eyebrow: "Men",
    title: "Modern tailoring",
    href: "/men",
    cta: "Shop men",
    image: unsplash("1617137968427-85924c800a22"),
    imageAlt: "Man in a navy suit walking outside a glass building",
  },
];

export const services = [
  {
    title: "Complimentary delivery",
    description: "Free express shipping on every order, signed for on arrival.",
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
