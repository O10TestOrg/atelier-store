import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { getUploadHost } from "@/lib/uploads";

describe("getUploadHost", () => {
  test("derives the public Blob host from the read-write token", () => {
    assert.equal(
      getUploadHost("vercel_blob_rw_AbC123xyz_s3cr3tPart"),
      "abc123xyz.public.blob.vercel-storage.com",
    );
  });

  test("is null without a usable token, which turns uploads off", () => {
    for (const token of [undefined, "", "vercel_blob_rw", "vercel_blob_rw_bad.id_x"]) {
      assert.equal(getUploadHost(token), null, String(token));
    }
  });
});
