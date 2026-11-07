"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { clearWishlistCookie } from "@/components/wishlist-state";
import { authClient } from "@/lib/auth-client";

export function SignOutButton({ className = "btn btn-secondary" }: { className?: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function signOut() {
    setPending(true);
    await authClient.signOut();
    clearWishlistCookie();
    router.replace("/");
    // Drops the client router cache, so signed-in pages aren't reused.
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={signOut}
      disabled={pending}
      className={className}
    >
      {pending ? "Signing out…" : "Sign out"}
    </button>
  );
}
