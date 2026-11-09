"use client";

import { upload } from "@vercel/blob/client";
import { useId, useRef, useState, type ChangeEvent } from "react";
import { Spinner, TextField } from "@/features/admin/components/fields";
import { SignalMessage } from "@/components/signal";
import { UPLOAD_CONTENT_TYPES, UPLOAD_MAX_BYTES, isAllowedImageUrl } from "@/features/admin/product-form";

const ACCEPT = UPLOAD_CONTENT_TYPES.join(",");

// Lowercase letters, digits, dots and hyphens; Blob adds a random suffix.
const uploadName = (file: File) =>
  `products/${
    file.name
      .toLowerCase()
      .replace(/[^a-z0-9.]+/g, "-")
      .replace(/^[-.]+|[-.]+$/g, "")
      .slice(0, 80) || "photo"
  }`;

type Props = {
  defaultValue?: string;
  error?: string;
  // This store's Blob host, or null when uploads are off (no token).
  uploadHost: string | null;
};

// The product image: upload a photo, or paste an Unsplash URL. Either way the
// form posts a URL in `image`, which the server validates again.
export function ImageField({ defaultValue = "", error, uploadHost }: Props) {
  const [url, setUrl] = useState(defaultValue);
  const [progress, setProgress] = useState<number | null>(null);
  const [uploadError, setUploadError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const id = useId();
  const uploading = progress !== null;

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setUploadError("");
    if (!UPLOAD_CONTENT_TYPES.includes(file.type)) {
      setUploadError("Choose a JPEG, PNG, WebP or AVIF photo.");
      return;
    }
    if (file.size > UPLOAD_MAX_BYTES) {
      setUploadError("Choose a photo under 10 MB.");
      return;
    }

    setProgress(0);
    try {
      const blob = await upload(uploadName(file), file, {
        access: "public",
        handleUploadUrl: "/api/admin/uploads",
        onUploadProgress: ({ percentage }) => setProgress(percentage),
      });
      setUrl(blob.url);
    } catch (uploadFailure) {
      console.error(uploadFailure);
      setUploadError("The upload didn’t finish. Check your connection and try again.");
    } finally {
      setProgress(null);
    }
  }

  return (
    <div className="grid gap-4 md:col-span-2 md:grid-cols-[minmax(0,1fr)_8rem]">
      <div className="flex flex-col gap-3">
        <TextField
          label="Image"
          name="image"
          type="url"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          spellCheck={false}
          error={error}
          hint={
            uploadHost
              ? "Upload a photo (JPEG, PNG, WebP or AVIF, up to 10 MB), or paste an Unsplash URL ending in ?w=2400&q=80."
              : "An Unsplash photo URL ending in ?w=2400&q=80. Set BLOB_READ_WRITE_TOKEN to upload photos."
          }
          required
        />
        {uploadHost && (
          <div className="flex flex-wrap items-center gap-3">
            <input
              ref={fileRef}
              id={`${id}-file`}
              type="file"
              accept={ACCEPT}
              onChange={handleFile}
              className="sr-only"
              tabIndex={-1}
            />
            <button
              type="button"
              className="btn btn-secondary btn-sm h-10"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
            >
              {uploading && <Spinner />}
              {uploading ? `Uploading… ${Math.round(progress)}%` : "Upload photo"}
            </button>
            <SignalMessage tone="danger" size="caption" role="status" className="empty:hidden">
              {uploadError}
            </SignalMessage>
          </div>
        )}
      </div>
      <div aria-hidden="true" className="aspect-[4/5] w-32 overflow-hidden bg-surface md:mt-7">
        {isAllowedImageUrl(url, uploadHost) && (
          // A plain <img>: the Blob host only reaches next/image's allowed
          // hosts at build time, and a preview mustn't throw before that.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="" className="size-full object-cover" />
        )}
      </div>
    </div>
  );
}
