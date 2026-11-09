import Image from "next/image";

// Small 4:5 product photo for lists (admin tables, order items). Decorative:
// the name beside it says what it is. Without a photo it keeps its space as
// an empty surface so rows stay aligned.
export function ProductThumb({
  image,
  className = "w-10",
  sizes = "3rem",
}: {
  image: string | null | undefined;
  className?: string;
  sizes?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={`relative block aspect-[4/5] shrink-0 overflow-hidden bg-surface ${className}`}
    >
      {image && <Image src={image} alt="" fill sizes={sizes} className="object-cover" />}
    </span>
  );
}

// An order's first few pieces as overlapping thumbnails, for order lists.
export function OrderItemThumbs({
  items,
  max = 3,
}: {
  items: { id: number; product: { image: string } | null }[];
  max?: number;
}) {
  const extra = items.length - max;
  return (
    <span aria-hidden="true" className="flex shrink-0 items-center">
      {items.slice(0, max).map((item, i) => (
        <ProductThumb
          key={item.id}
          image={item.product?.image}
          className={`w-8 ring-2 ring-background ${i > 0 ? "-ml-3" : ""}`}
          sizes="2.5rem"
        />
      ))}
      {extra > 0 && <span className="ml-1.5 text-caption text-muted">+{extra}</span>}
    </span>
  );
}
