"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { SignalMessage } from "@/components/signal";
import { clearWishlistCookie } from "@/components/wishlist-state";
import { authClient } from "@/lib/auth-client";

export function SignOutButton({ className = "btn btn-secondary" }: { className?: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  async function signOut() {
    setPending(true);
    setFailed(false);
    try {
      const { error } = await authClient.signOut();
      if (error) throw error;
    } catch {
      // Still signed in: stay put so the shopper can try again.
      setFailed(true);
      setPending(false);
      return;
    }
    clearWishlistCookie();
    router.replace("/");
    // Drops the client router cache, so signed-in pages aren't reused.
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        onClick={signOut}
        disabled={pending}
        className={className}
      >
        {pending ? "Signing out…" : "Sign out"}
      </button>
      <SignalMessage tone="danger" size="caption" role="status" className="mt-2 whitespace-normal empty:hidden">
        {failed ? "We couldn't sign you out. Check your connection and try again." : ""}
      </SignalMessage>
    </>
  );
}
