"use client";

import { useId, useOptimistic, useState, useTransition } from "react";
import { setDeliveryCountry } from "@/app/bag/actions";
import { SignalMessage } from "@/components/signal";

type Props = {
  countries: { code: string; name: string }[];
  current: string;
};

// Changing country re-renders the bag with that zone's delivery and notices.
export function DeliveryCountrySelect({ countries, current }: Props) {
  const id = useId();
  const [pending, startTransition] = useTransition();
  const [shown, setShown] = useOptimistic(current);
  const [error, setError] = useState<string | null>(null);

  function change(code: string) {
    setError(null);
    startTransition(async () => {
      setShown(code);
      const result = await setDeliveryCountry(code);
      if (result && !result.ok) setError(result.message);
    });
  }

  return (
    <div aria-busy={pending} className="flex flex-col gap-2">
      <label htmlFor={id} className="text-muted">
        Delivering to
      </label>
      <select
        id={id}
        value={shown}
        disabled={pending}
        onChange={(event) => change(event.target.value)}
        className="h-10 w-full border bg-background px-3 outline-none transition-colors hover:border-line-strong focus-visible:border-line-strong disabled:text-muted"
      >
        {countries.map((country) => (
          <option key={country.code} value={country.code}>
            {country.name}
          </option>
        ))}
      </select>
      <SignalMessage tone="danger" size="caption" role="status" className="empty:hidden">
        {error}
      </SignalMessage>
    </div>
  );
}
