import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthForm } from "@/components/auth-form";
import { AuthSwitchLink, AuthSwitchLinkFallback } from "@/components/auth-switch-link";
import { RedirectIfSignedIn } from "../redirect-if-signed-in";

export const metadata: Metadata = {
  title: "Create an account",
  robots: { index: false },
};

export default function SignUpPage() {
  return (
    <section className="section container-form">
      <Suspense>
        <RedirectIfSignedIn />
      </Suspense>

      <header className="text-center">
        <p className="text-eyebrow text-muted">My account</p>
        <h1 className="mt-4 text-heading">Create an account</h1>
        <p className="mt-4 text-muted">Save your details for faster checkout.</p>
      </header>

      <div className="mt-10">
        <AuthForm mode="sign-up" />
      </div>

      <p className="mt-8 border-t pt-8 text-center text-body-sm text-muted">
        Already have an account?{" "}
        <Suspense
          fallback={<AuthSwitchLinkFallback href="/sign-in">Sign in</AuthSwitchLinkFallback>}
        >
          <AuthSwitchLink href="/sign-in">Sign in</AuthSwitchLink>
        </Suspense>
      </p>
    </section>
  );
}
