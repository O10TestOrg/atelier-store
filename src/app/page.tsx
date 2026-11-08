import Image from "next/image";
import Link from "next/link";
import { ProductCard } from "@/components/product-card";
import { campaigns, categoryHref, hero, services, story } from "@/lib/catalog";
import { getCategoryTiles, getNewArrivals } from "@/lib/products";

export default async function Home() {
  const [products, tiles] = await Promise.all([getNewArrivals(8), getCategoryTiles()]);
  const tileSlugs = new Set(tiles.map((tile) => tile.slug));
  const liveCampaigns = campaigns.filter((campaign) => tileSlugs.has(campaign.category));

  return (
    <>
      {/* Hero: full-bleed campaign image with inverse text */}
      <section className="theme-inverse relative h-[min(88svh,60rem)] min-h-[34rem] overflow-hidden bg-background text-foreground">
        <Image
          src={hero.image}
          alt={hero.imageAlt}
          fill
          sizes="100vw"
          loading="eager"
          fetchPriority="high"
          className="object-cover object-[50%_25%]"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-linear-to-t from-black/60 via-black/10 to-transparent"
        />
        <div className="container-page absolute inset-x-0 bottom-0 pb-12 md:pb-16">
          <p className="text-eyebrow">{hero.eyebrow}</p>
          <h1 className="mt-4 max-w-[16ch] text-display">{hero.title}</h1>
          <p className="mt-4 max-w-md text-body-sm md:text-body">
            {hero.description}
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/collections/new" className="btn btn-primary">
              Discover the collection
            </Link>
          </div>
        </div>
      </section>

      {/* Introduction */}
      <section className="section container-prose text-center">
        <p className="text-eyebrow text-muted">The Season</p>
        <h2 className="mt-4 text-heading">
          A wardrobe built on proportion, texture and restraint
        </h2>
        <p className="mt-4 text-muted">
          This season returns to the essentials: softened shoulders, deep
          colours drawn from stone and earth, and leather that carries the
          marks of the hand that shaped it.
        </p>
        <Link href="/collections/new" className="link mt-6 inline-block text-body-sm">
          Explore the season
        </Link>
      </section>

      {/* Featured collections */}
      <section className="container-page pb-section" aria-labelledby="collections-title">
        <div className="mb-6 flex items-end justify-between gap-4">
          <h2 id="collections-title" className="text-heading">
            Explore the collections
          </h2>
        </div>
        <ul className="grid grid-cols-2 gap-x-(--grid-gap-x) gap-y-8 lg:grid-cols-4">
          {tiles.map((tile) => (
            <li key={tile.slug}>
              <Link href={categoryHref(tile.slug)} className="group block">
                <div className="media-cover aspect-editorial">
                  <Image
                    src={tile.image}
                    alt={tile.imageAlt}
                    fill
                    sizes="(min-width: 64rem) 25vw, 50vw"
                    className="transition-transform duration-700 group-hover:scale-[1.03]"
                  />
                </div>
                <h3 className="mt-3 text-body-sm">{tile.name}</h3>
                <span className="link-quiet text-meta group-hover:decoration-current">
                  Discover
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* New arrivals */}
      <section className="container-page pb-section" aria-labelledby="new-title">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <p className="text-eyebrow text-muted">Just in</p>
            <h2 id="new-title" className="mt-2 text-heading">
              New arrivals
            </h2>
          </div>
          <Link href="/collections/new" className="link shrink-0 text-body-sm">
            View all
          </Link>
        </div>
        <div className="grid-products">
          {products.map((product) => (
            <ProductCard key={product.slug} product={product} />
          ))}
        </div>
      </section>

      {/* Editorial story */}
      <section className="container-page pb-section">
        <div className="grid-editorial">
          <div className="media-cover aspect-editorial">
            <Image
              src={story.image}
              alt={story.imageAlt}
              fill
              sizes="(min-width: 48rem) 50vw, 100vw"
              className="object-cover"
            />
          </div>
          <div className="flex flex-col items-start justify-center bg-surface px-gutter py-section md:px-12 lg:px-20">
            <p className="text-eyebrow text-muted">{story.eyebrow}</p>
            <h2 className="mt-4 max-w-[14ch] text-display">{story.title}</h2>
            <p className="mt-6 max-w-md text-muted">{story.description}</p>
          </div>
        </div>
      </section>

      {/* Campaigns, one per featured category */}
      <section className="grid gap-(--grid-gap-x) md:grid-cols-2">
        {liveCampaigns.map((campaign) => (
          <Link
            key={campaign.category}
            href={categoryHref(campaign.category)}
            className="theme-inverse group media-cover relative block aspect-4/5 text-foreground md:aspect-editorial"
          >
            <Image
              src={campaign.image}
              alt={campaign.imageAlt}
              fill
              sizes="(min-width: 48rem) 50vw, 100vw"
              className="transition-transform duration-700 group-hover:scale-[1.03]"
            />
            <div
              aria-hidden="true"
              className="absolute inset-0 bg-linear-to-t from-black/70 via-black/15 via-35% to-transparent"
            />
            <div className="absolute inset-x-0 bottom-0 flex flex-col items-center px-gutter pb-10 text-center md:pb-14">
              <p className="text-eyebrow">{campaign.eyebrow}</p>
              <h2 className="mt-3 text-heading">{campaign.title}</h2>
              <span className="link mt-4 text-body-sm">{campaign.cta}</span>
            </div>
          </Link>
        ))}
      </section>

      {/* Services */}
      <section className="section container-page" aria-labelledby="services-title">
        <h2 id="services-title" className="text-heading text-center">
          Atelier services
        </h2>
        <ul className="mt-10 grid gap-px border bg-line sm:grid-cols-2 lg:grid-cols-4">
          {services.map((service) => (
            <li key={service.title} className="bg-background p-6 md:p-8">
              <h3 className="text-body-sm">{service.title}</h3>
              <p className="mt-2 text-meta">{service.description}</p>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
