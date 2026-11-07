// Server-side Stripe client. Use a restricted key (`rk_…`) with write access to
// Checkout Sessions. Created on first use rather than at import, so building
// without Stripe keys still works; calls fail loudly if the key is missing.
import "server-only";
import Stripe from "stripe";

let client: Stripe | null = null;

export function getStripe() {
  if (!client) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
    client = new Stripe(key, { apiVersion: "2026-10-28.endive" });
  }
  return client;
}

export function getWebhookSecret() {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new Error("STRIPE_WEBHOOK_SECRET is not set");
  return secret;
}

// Absolute base for Checkout return URLs.
export function getAppUrl() {
  const url = process.env.APP_URL;
  if (!url) throw new Error("APP_URL is not set");
  return url.replace(/\/+$/, "");
}
