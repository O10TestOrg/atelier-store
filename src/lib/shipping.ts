// Where we deliver and what it costs. The store is UK-based and charges in
// pounds. Stripe-hosted Checkout can't change rates once the shopper types an
// address, so the shopper picks a country in the bag (a `delivery_country`
// cookie) and `startCheckout` offers only that country's address and rates.
//
// The cookie is a preference, not trusted input: anything unknown reads as
// the UK. `readDeliveryCountry` reads request cookies, so render callers must
// sit inside <Suspense>; `writeDeliveryCountry` only works in Server Actions.
import "server-only";
import { cookies } from "next/headers";
import type Stripe from "stripe";
import { baseCookieOptions } from "@/lib/cookies";

type CountryCode = Stripe.Checkout.SessionCreateParams.ShippingAddressCollection.AllowedCountry;

export type Zone = "uk" | "europe" | "world";

export type DeliveryRate = {
  name: string;
  // Pence.
  amount: number;
  // Working days.
  minDays: number;
  maxDays: number;
};

// Cheapest first: Stripe preselects the first option, and the bag's total
// assumes it.
export const RATES: Record<Zone, DeliveryRate[]> = {
  uk: [
    { name: "Standard delivery", amount: 0, minDays: 2, maxDays: 3 },
    { name: "Next working day", amount: 1000, minDays: 1, maxDays: 1 },
  ],
  europe: [{ name: "Express delivery", amount: 2000, minDays: 3, maxDays: 5 }],
  world: [{ name: "Express delivery", amount: 3000, minDays: 4, maxDays: 7 }],
};

export const COUNTRIES: { code: CountryCode; name: string; zone: Zone }[] = [
  { code: "GB", name: "United Kingdom", zone: "uk" },
  { code: "AU", name: "Australia", zone: "world" },
  { code: "BE", name: "Belgium", zone: "europe" },
  { code: "CA", name: "Canada", zone: "world" },
  { code: "DK", name: "Denmark", zone: "europe" },
  { code: "FR", name: "France", zone: "europe" },
  { code: "DE", name: "Germany", zone: "europe" },
  { code: "IE", name: "Ireland", zone: "europe" },
  { code: "IT", name: "Italy", zone: "europe" },
  { code: "JP", name: "Japan", zone: "world" },
  { code: "NL", name: "Netherlands", zone: "europe" },
  { code: "ES", name: "Spain", zone: "europe" },
  { code: "SE", name: "Sweden", zone: "europe" },
  { code: "CH", name: "Switzerland", zone: "europe" },
  { code: "US", name: "United States", zone: "world" },
];

export type Country = (typeof COUNTRIES)[number];

const HOME = COUNTRIES[0];
const COOKIE = "delivery_country";
const MAX_AGE = 60 * 60 * 24 * 365;

export const findCountry = (code: unknown) =>
  COUNTRIES.find((country) => country.code === code);

export const ratesFor = (country: Country) => RATES[country.zone];

export const formatDays = ({ minDays, maxDays }: DeliveryRate) =>
  minDays === maxDays
    ? `${minDays} working ${minDays === 1 ? "day" : "days"}`
    : `${minDays}–${maxDays} working days`;

export async function readDeliveryCountry(): Promise<Country> {
  return findCountry((await cookies()).get(COOKIE)?.value) ?? HOME;
}

export async function writeDeliveryCountry(country: Country) {
  (await cookies()).set(COOKIE, country.code, {
    ...baseCookieOptions,
    httpOnly: true,
    maxAge: MAX_AGE,
  });
}

// The options for a Checkout Session, as Stripe's inline shipping rates.
export function shippingOptions(
  country: Country,
  currency: string,
): Stripe.Checkout.SessionCreateParams.ShippingOption[] {
  return ratesFor(country).map((rate) => ({
    shipping_rate_data: {
      type: "fixed_amount",
      display_name: rate.name,
      fixed_amount: { amount: rate.amount, currency },
      delivery_estimate: {
        minimum: { unit: "business_day", value: rate.minDays },
        maximum: { unit: "business_day", value: rate.maxDays },
      },
    },
  }));
}
