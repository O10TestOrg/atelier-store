// When a control removes its own line (bag, wishlist), its button unmounts and
// focus would drop to <body>. Move it to the page heading instead, and say what
// happened through the page's live region. Both ids are rendered outside the
// page's <Suspense>, so they survive the re-render that removes the line.
// No "use client": server pages import the ids; only clients call the function.
export const PAGE_HEADING_ID = "page-heading";
export const ANNOUNCER_ID = "page-announcer";

export function focusAfterRemoval(message: string) {
  document.getElementById(PAGE_HEADING_ID)?.focus();
  const announcer = document.getElementById(ANNOUNCER_ID);
  if (announcer) {
    // Cleared first so the same message twice in a row is announced again.
    announcer.textContent = "";
    requestAnimationFrame(() => {
      announcer.textContent = message;
    });
  }
}
