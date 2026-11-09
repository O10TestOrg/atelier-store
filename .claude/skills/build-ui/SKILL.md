---
name: build-ui
description: Build or update customer-facing ecommerce UI using the existing design system, components, product patterns and responsive conventions. Use when creating or significantly changing storefront pages, sections or customer-facing components. Not for internal admin screens under /admin (tables, forms, stock tools); follow the Admin section of CLAUDE.md for those.
---

Scope: this skill is written for the storefront. Don't force it onto internal admin workflows, which have different goals (dense data, fast editing) and their own patterns in `src/features/admin/components/`.

Build or update the following UI:

$ARGUMENTS

Project rules that are easy to miss (details in CLAUDE.md):

- `/products/[slug]` and `/collections/[slug]` are `ensureStatic = "navigation"`, so anything they render (including the shared header) can't read cookies or the session on the server. Per-visitor state there is read on the client, like `bag-count.tsx` and `wishlist-state.tsx`.
- Client code that calls a cart or wishlist action must call `notifyCartChange()` / `notifyWishlistChange()` afterwards.
- Signal state with `SignalMessage`, `Notice` or `StatusDot` from `src/components/signal.tsx` and a `tone`, not coloured text.
- The mobile menu and the Collections dropdown (`HeaderMenu`) close on link tap, Escape, outside click and path change; keep that true for any new header menu.
- Show dates with `src/lib/dates.ts` (UK time).

1. Inspect the current implementation and related components.
2. Search for reusable components before creating new ones.
3. Reuse the existing design system and patterns.
4. Keep the change focused on the requested feature.
5. Verify responsive behavior.
6. Run and visually verify the application
7. Run the normal project checks.
8. Fix reproducible issues without expanding scope.
9. Summarize what changed.