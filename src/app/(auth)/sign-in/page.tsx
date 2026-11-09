import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthForm } from "@/features/account/auth-form";
import { AuthSwitchLink, AuthSwitchLinkFallback } from "@/features/account/auth-switch-link";
import { RedirectIfSignedIn } from "@/features/account/redirect-if-signed-in";

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false },
};

export default function SignInPage({ searchParams }: PageProps<"/sign-in">) {
  return (
    <section className="section container-form">
      <Suspense>
        <RedirectIfSignedIn searchParams={searchParams} />
      </Suspense>

      <header className="text-center">
        <p className="text-eyebrow text-muted">My account</p>
        <h1 className="mt-4 text-heading">Sign in</h1>
        <p className="mt-4 text-muted">Sign in to view your account and orders.</p>
      </header>

      <div className="mt-10">
        <AuthForm mode="sign-in" />
      </div>

      <p className="mt-8 border-t pt-8 text-center text-body-sm text-muted">
        New to Atelier?{" "}
        <Suspense
          fallback={<AuthSwitchLinkFallback href="/sign-up">Create an account</AuthSwitchLinkFallback>}
        >
          <AuthSwitchLink href="/sign-up">Create an account</AuthSwitchLink>
        </Suspense>
      </p>
    </section>
  );
}
