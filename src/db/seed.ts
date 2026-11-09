// Seeds the catalog with sample products. Safe to re-run: rows upsert on slug.
// Run with `pnpm db:seed`.
import { loadEnvConfig } from "@next/env";
import { sql } from "drizzle-orm";
import { unsplash } from "../lib/catalog";
import { categories, products } from "./schema";

loadEnvConfig(process.cwd());

const categoryData = [
  { slug: "bags", name: "Bags" },
  { slug: "travel", name: "Travel" },
  { slug: "ready-to-wear", name: "Clothing" },
  { slug: "accessories", name: "Accessories" },
];

type ProductSeed = Omit<
  typeof products.$inferInsert,
  "id" | "categoryId" | "createdAt" | "updatedAt"
> & { category: string };

// Prices are in pence.
const productData: ProductSeed[] = [
  {
    slug: "lumen-chain-bag",
    name: "Lumen Chain Bag",
    reference: "AT-B0142",
    category: "bags",
    price: 285000,
    stock: 12,
    image: unsplash("1566150905458-1bf1fc113f0d"),
    imageAlt: "Blush pink leather shoulder bag with a chain strap",
    detailFocus: "62% 45%",
    isNew: true,
    colour: "Blush with butter chevron",
    description:
      "A compact flap bag in smooth calfskin, finished with a painted chevron and a fine chain that wears on the shoulder or across the body.",
    details: [
      "Smooth calfskin with painted edges",
      "Magnetic flap closure",
      "Detachable chain strap, 120 cm drop",
      "Interior flat pocket",
      "22 × 15 × 6 cm",
    ],
  },
  {
    slug: "panier-woven-tote",
    name: "Panier Woven Tote",
    reference: "AT-B0157",
    category: "bags",
    price: 195000,
    stock: 2,
    image: unsplash("1590874103328-eac38a683ce7"),
    imageAlt: "Tan woven leather handbag with a top handle",
    detailFocus: "50% 70%",
    isNew: true,
    colour: "Tan",
    description:
      "Hand-woven leather strips form a structured basket body, closed with a smooth leather flap and polished turn-lock.",
    details: [
      "Hand-woven vegetable-tanned leather",
      "Turn-lock closure",
      "Rolled top handle",
      "Cotton canvas lining",
      "28 × 22 × 14 cm",
    ],
  },
  {
    slug: "maree-satchel",
    name: "Marée Satchel",
    reference: "AT-B0098",
    category: "bags",
    price: 320000,
    stock: 0,
    image: unsplash("1594223274512-ad4803739b7c"),
    imageAlt: "Teal leather satchel with a gold clasp",
    detailFocus: "55% 72%",
    colour: "Lagoon",
    description:
      "A structured satchel in grained leather with a sculpted handle and a push-lock clasp in brushed gold-tone metal.",
    details: [
      "Grained calfskin",
      "Push-lock clasp, gold-tone hardware",
      "Top handle and adjustable shoulder strap",
      "Two interior compartments",
      "27 × 20 × 11 cm",
    ],
  },
  {
    slug: "voyage-backpack",
    name: "Voyage Leather Backpack",
    reference: "AT-T0021",
    category: "travel",
    price: 240000,
    stock: 7,
    image: unsplash("1622560480605-d83c853bc5c3"),
    imageAlt: "Brown grained leather backpack",
    detailFocus: "50% 40%",
    colour: "Cognac",
    description:
      "A softly structured backpack in full-grain leather that darkens and polishes with use. Sized for a laptop and a change of clothes.",
    details: [
      "Full-grain leather",
      "Zip closure with leather pulls",
      "Padded laptop sleeve, fits 15 inch",
      "Adjustable padded shoulder straps",
      "30 × 42 × 14 cm",
    ],
  },
  {
    slug: "field-bomber",
    name: "Field Bomber Jacket",
    reference: "AT-R0310",
    category: "ready-to-wear",
    price: 210000,
    stock: 1,
    image: unsplash("1591047139829-d91aecb6caea"),
    imageAlt: "Rust bomber jacket held up on a hanger",
    detailFocus: "50% 30%",
    isNew: true,
    colour: "Rust",
    description:
      "A relaxed bomber in technical silk-blend twill with ribbed trims and a utility sleeve pocket.",
    details: [
      "Silk and nylon twill, 60% silk",
      "Two-way zip front",
      "Ribbed collar, cuffs and hem",
      "Sleeve zip pocket",
      "Regular fit, true to size",
    ],
  },
  {
    slug: "lambskin-biker-jacket",
    name: "Lambskin Biker Jacket",
    reference: "AT-R0288",
    category: "ready-to-wear",
    price: 460000,
    stock: 5,
    image: unsplash("1551028719-00167b16eac5"),
    imageAlt: "Black leather biker jacket laid flat on white fabric",
    detailFocus: "45% 35%",
    colour: "Black",
    description:
      "The classic asymmetric biker, cut from supple lambskin and lined in silk. Light enough to layer, tailored close to the body.",
    details: [
      "Lambskin leather",
      "Silk twill lining",
      "Asymmetric zip front with snap lapels",
      "Three zip pockets",
      "Slim fit; size up for layering",
    ],
  },
  {
    slug: "fringed-knit-poncho",
    name: "Fringed Knit Poncho",
    reference: "AT-R0275",
    category: "ready-to-wear",
    price: 165000,
    stock: 9,
    image: unsplash("1434389677669-e08b4cac3105"),
    imageAlt: "Cream knitted poncho with fringed hem on a hanger",
    detailFocus: "50% 80%",
    colour: "Ecru",
    description:
      "An open-stitch poncho knitted from cashmere and cotton, finished with a hand-knotted fringe.",
    details: [
      "70% cotton, 30% cashmere",
      "Open pointelle stitch",
      "Hand-knotted fringe hem",
      "One size",
    ],
  },
  {
    slug: "rondo-sunglasses",
    name: "Rondo Sunglasses",
    reference: "AT-A0064",
    category: "accessories",
    price: 52000,
    stock: 24,
    image: unsplash("1511499767150-a48a237f0083"),
    imageAlt: "Round gold-rimmed sunglasses with green lenses",
    detailFocus: "35% 50%",
    isNew: true,
    colour: "Gold with bottle green lenses",
    description:
      "Round metal frames with fine temples and mineral glass lenses, made in a family-run workshop in the Dolomites.",
    details: [
      "Titanium frame, gold finish",
      "Mineral glass lenses, 100% UV protection",
      "Adjustable nose pads",
      "Supplied with leather case and cloth",
    ],
  },
];

// Overwrite every column except the conflict key with the incoming row.
const excluded = (columns: string[]) =>
  Object.fromEntries(
    columns.map((column) => [column, sql.raw(`excluded.${column}`)]),
  );

async function main() {
  // Imported after loading env: `db` throws when DATABASE_URL is missing.
  const { db } = await import("./index");

  const insertedCategories = await db
    .insert(categories)
    .values(categoryData)
    .onConflictDoUpdate({ target: categories.slug, set: excluded(["name"]) })
    .returning({ id: categories.id, slug: categories.slug });

  const categoryIds = new Map(
    insertedCategories.map((category) => [category.slug, category.id]),
  );

  const rows = productData.map(({ category, ...product }) => {
    const categoryId = categoryIds.get(category);
    if (!categoryId) throw new Error(`Unknown category "${category}"`);
    // Live on first insert. The upsert leaves `status` alone, so re-seeding
    // never brings back a product an admin archived.
    return { ...product, categoryId, status: "active" as const, publishedAt: new Date() };
  });

  await db
    .insert(products)
    .values(rows)
    .onConflictDoUpdate({
      target: products.slug,
      set: {
        ...excluded([
          "reference",
          "name",
          "category_id",
          "price",
          "stock",
          "image",
          "image_alt",
          "detail_focus",
          "is_new",
          "colour",
          "description",
          "details",
        ]),
        updatedAt: new Date(),
      },
    });

  console.log(
    `Seeded ${categoryData.length} categories and ${rows.length} products.`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
