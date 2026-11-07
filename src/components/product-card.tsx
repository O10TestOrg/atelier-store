import Image from "next/image";
import Link from "next/link";
import { HeartIcon } from "@/components/icons";
import { formatPrice, getStockState } from "@/lib/catalog";
import type { Product } from "@/lib/products";

export function ProductCard({ product }: { product: Product }) {
  const isSoldOut = getStockState(product) === "out-of-stock";

  return (
    <article className="group relative">
      <Link href={`/products/${product.slug}`} className="block">
        <div className="media-cover aspect-product">
          <Image
            src={product.image}
            alt={product.imageAlt}
            fill
            sizes="(min-width: 80rem) 25vw, (min-width: 64rem) 33vw, 50vw"
            className="transition-transform duration-700 group-hover:scale-[1.03]"
          />
        </div>
        <div className="mt-3 flex flex-col gap-1 pr-2">
          {isSoldOut ? (
            <p className="text-eyebrow text-muted">Sold out</p>
          ) : (
            product.isNew && <p className="text-eyebrow text-muted">New</p>
          )}
          <h3 className="text-body-sm">{product.name}</h3>
          <p className="text-meta">{formatPrice(product.price)}</p>
        </div>
      </Link>
      <button
        type="button"
        className="btn-icon absolute top-1 right-1 bg-background/0 hover:bg-background/80"
        aria-label={`Add ${product.name} to wishlist`}
      >
        <HeartIcon />
      </button>
    </article>
  );
}
