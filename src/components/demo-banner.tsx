import { SignalMessage } from "@/components/signal";

// Shown on every page of the public demo (NEXT_PUBLIC_DEMO_MODE=1). Read at
// build time, so it stays in the static shell: redeploy after changing the
// variables. The login is the read-only viewer from `pnpm db:seed-demo`.
export function DemoBanner() {
  if (process.env.NEXT_PUBLIC_DEMO_MODE !== "1") return null;
  const email = process.env.DEMO_VIEWER_EMAIL;
  const password = process.env.DEMO_VIEWER_PASSWORD;

  return (
    <div className="border-b bg-surface">
      <SignalMessage tone="info" size="caption" className="container-page py-2">
        Demo store: nothing ships and no money is taken. Pay with card{" "}
        <span className="whitespace-nowrap tabular-nums">4242 4242 4242 4242</span>, any future
        date and any CVC, and use a made-up email.
        {email && password && (
          <>
            {" "}
            To look around the admin, sign in as <span className="break-all">{email}</span> with
            password <span className="whitespace-nowrap">{password}</span> (read-only).
          </>
        )}
      </SignalMessage>
    </div>
  );
}
