import Link from "next/link";

const columns = [
  {
    title: "Help",
    links: [
      { label: "Contact us", href: "/help/contact" },
      { label: "Shipping & delivery", href: "/help/shipping" },
      { label: "Returns & exchanges", href: "/help/returns" },
      { label: "Product care", href: "/help/care" },
    ],
  },
  {
    title: "Services",
    links: [
      { label: "Book an appointment", href: "/services/appointments" },
      { label: "Repairs", href: "/services/repairs" },
      { label: "Personalisation", href: "/services/personalisation" },
      { label: "Gift cards", href: "/services/gift-cards" },
    ],
  },
  {
    title: "The House",
    links: [
      { label: "Our story", href: "/about" },
      { label: "Craftsmanship", href: "/about/craft" },
      { label: "Sustainability", href: "/about/sustainability" },
      { label: "Careers", href: "/about/careers" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Terms of sale", href: "/legal/terms" },
      { label: "Privacy policy", href: "/legal/privacy" },
      { label: "Cookie settings", href: "/legal/cookies" },
      { label: "Accessibility", href: "/legal/accessibility" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-t">
      <div className="container-page section grid grid-cols-2 gap-x-6 gap-y-10 lg:grid-cols-4">
        {columns.map((column) => (
          <div key={column.title}>
            <h2 className="text-eyebrow text-muted">{column.title}</h2>
            <ul className="mt-4 flex flex-col gap-3 text-body-sm">
              {column.links.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="link-quiet">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t">
        <div className="container-page flex flex-col items-center gap-2 py-6 text-caption text-muted sm:flex-row sm:justify-between">
          <span className="text-body-sm tracking-[0.35em] text-foreground uppercase">
            Atelier
          </span>
          <span>United States (USD)</span>
          <span>© 2026 Atelier. All rights reserved.</span>
        </div>
      </div>
    </footer>
  );
}
