"use client";

import { useState } from "react";
import { SignalMessage } from "@/components/signal";
import { authClient } from "@/lib/auth-client";

type State = "idle" | "sending" | "sent" | "failed" | "limited";

const messages: Record<State, string> = {
  idle: "",
  sending: "",
  sent: "We’ve sent a new link. Check your inbox.",
  failed: "We couldn’t send the email. Please try again.",
  limited: "We’ve sent a few already. Please wait a minute and try again.",
};

export function ResendVerificationButton({ email }: { email: string }) {
  const [state, setState] = useState<State>("idle");

  async function resend() {
    setState("sending");
    try {
      const { error } = await authClient.sendVerificationEmail({
        email,
        callbackURL: "/account?verified=1",
      });
      setState(error ? (error.status === 429 ? "limited" : "failed") : "sent");
    } catch {
      setState("failed");
    }
  }

  return (
    <div className="mt-3 flex flex-col items-start gap-2">
      <button
        type="button"
        onClick={resend}
        disabled={state === "sending" || state === "sent"}
        className="link text-body-sm disabled:text-muted"
      >
        {state === "sending" ? "Sending…" : "Send a new link"}
      </button>
      <SignalMessage
        tone={state === "sent" ? "success" : "danger"}
        size="caption"
        role="status"
        className="empty:hidden"
      >
        {messages[state]}
      </SignalMessage>
    </div>
  );
}
