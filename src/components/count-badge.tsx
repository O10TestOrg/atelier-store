// The count on the header's bag and wishlist icons, with the full label for
// screen readers. Nothing shows at zero.
export function CountBadge({ label, count }: { label: string; count: number }) {
  return (
    <>
      <span className="sr-only">
        {label}
        {count > 0 && `, ${count} ${count === 1 ? "item" : "items"}`}
      </span>
      {count > 0 && (
        <span
          aria-hidden="true"
          className="absolute top-1.5 right-1 flex h-4 min-w-4 items-center justify-center rounded-pill bg-foreground px-1 text-[0.625rem] leading-none text-background tabular-nums"
        >
          {count > 99 ? "99+" : count}
        </span>
      )}
    </>
  );
}
