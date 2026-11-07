---
name: build-ui
description: Build or update customer-facing ecommerce UI using the existing design system, components, product patterns and responsive conventions. Use when creating or significantly changing storefront pages, sections or customer-facing components. Not for internal admin screens under /admin (tables, forms, stock tools); follow the Admin section of CLAUDE.md for those.
---

Scope: this skill is written for the storefront. Don't force it onto internal admin workflows, which have different goals (dense data, fast editing) and their own patterns in `src/components/admin/`.

Build or update the following UI:

$ARGUMENTS

1. Inspect the current implementation and related components.
2. Search for reusable components before creating new ones.
3. Reuse the existing design system and patterns.
4. Keep the change focused on the requested feature.
5. Verify responsive behavior.
6. Run and viusally verify the application
7. Run the normal project checks.
8. Fix reproducible issues without expanding scope.
9. Summarize what changed.