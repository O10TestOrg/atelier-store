import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveAppUrl, vercelAuthHosts } from "@/lib/app-url";

test("uses APP_URL off Vercel and in production", () => {
  assert.equal(resolveAppUrl({ APP_URL: "http://localhost:3000/" }), "http://localhost:3000");
  assert.equal(
    resolveAppUrl({ VERCEL_ENV: "production", APP_URL: "https://shop.example" }),
    "https://shop.example",
  );
  assert.equal(
    resolveAppUrl({ VERCEL_ENV: "production", VERCEL_PROJECT_PRODUCTION_URL: "shop.example" }),
    "https://shop.example",
  );
  assert.equal(resolveAppUrl({}), undefined);
});

test("a preview links back to itself, even with a production APP_URL", () => {
  const preview = { VERCEL_ENV: "preview", APP_URL: "https://shop.example", VERCEL_URL: "atelier-abc.vercel.app" };
  assert.equal(resolveAppUrl(preview), "https://atelier-abc.vercel.app");
  assert.equal(
    resolveAppUrl({ ...preview, VERCEL_BRANCH_URL: "atelier-git-feat.vercel.app" }),
    "https://atelier-git-feat.vercel.app",
  );
});

test("auth hosts are this deployment's own, and only on Vercel", () => {
  assert.equal(vercelAuthHosts({ BETTER_AUTH_URL: "http://localhost:3000" }), null);
  assert.deepEqual(
    vercelAuthHosts({
      VERCEL: "1",
      BETTER_AUTH_URL: "https://shop.example",
      APP_URL: "https://shop.example",
      VERCEL_PROJECT_PRODUCTION_URL: "shop.example",
      VERCEL_URL: "atelier-abc.vercel.app",
    }),
    ["shop.example", "atelier-abc.vercel.app"],
  );
});
