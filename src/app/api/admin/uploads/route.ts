import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { getAppUrl } from "@/lib/stripe";
import { AuthorizationError, assertAdmin } from "@/lib/session";
import { UPLOAD_CONTENT_TYPES, UPLOAD_MAX_BYTES, getUploadHost } from "@/lib/uploads";

// Issues client upload tokens for product photos (`ImageField`). The browser
// then uploads to Blob directly, so large files never pass through here.
// Route Handlers get no Server Action origin check, so this does its own
// before the role check: cookies alone don't prove the admin sent it.
export async function POST(request: Request) {
  if (!getUploadHost()) return Response.json({ error: "Uploads are off." }, { status: 404 });
  if (request.headers.get("origin") !== new URL(getAppUrl()).origin) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: HandleUploadBody;
  try {
    body = (await request.json()) as HandleUploadBody;
  } catch {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }
  // Only token requests: there's no `onUploadCompleted`, so no callbacks to take.
  if (body?.type !== "blob.generate-client-token") {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }

  try {
    const result = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        await assertAdmin();
        if (!/^products\/[A-Za-z0-9._-]{1,100}$/.test(pathname)) {
          throw new Error("Invalid upload path");
        }
        return {
          allowedContentTypes: UPLOAD_CONTENT_TYPES,
          maximumSizeInBytes: UPLOAD_MAX_BYTES,
          addRandomSuffix: true,
        };
      },
    });
    return Response.json(result);
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("Could not issue upload token", error);
    return Response.json({ error: "Upload could not start." }, { status: 400 });
  }
}
