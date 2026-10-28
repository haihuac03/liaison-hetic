import { issueSignedToken } from "@vercel/blob";
import { handleUploadPresigned, type HandleUploadPresignedBody } from "@vercel/blob/client";
import { NextRequest, NextResponse } from "next/server";
import { userFromToken } from "@/lib/server/db";
import { propertyUploadContext } from "@/lib/server/leases";
import { documentMimeFor, DOCUMENT_MAX_BYTES } from "@/lib/document-files";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type UploadPayload = {
  propertyId?: unknown;
  leaseId?: unknown;
  name?: unknown;
  mime?: unknown;
  size?: unknown;
};

const attempts = new Map<string, { count: number; reset: number }>();

function limited(userId: string) {
  const now = Date.now();
  const current = attempts.get(userId);
  if (!current || current.reset <= now) {
    attempts.set(userId, { count: 1, reset: now + 60_000 });
    return false;
  }
  current.count += 1;
  return current.count > 15;
}

function payloadFor(value: string | null): UploadPayload {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as UploadPayload)
      : {};
  } catch {
    return {};
  }
}

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  const expectedOrigin = process.env.APP_ORIGIN || request.nextUrl.origin;
  if ((origin && origin !== expectedOrigin) || request.headers.get("sec-fetch-site") === "cross-site") {
    return NextResponse.json({ error: "Origine non autorisée." }, { status: 403 });
  }
  const user = await userFromToken(request.cookies.get("liaison_session")?.value);
  if (!user) return NextResponse.json({ error: "Connectez-vous pour continuer." }, { status: 401 });
  if (limited(user.id)) return NextResponse.json({ error: "Trop d’envois. Réessayez dans une minute." }, { status: 429 });

  const storeId = process.env.BLOB_STORE_ID?.trim();
  const token = process.env.BLOB_READ_WRITE_TOKEN?.trim();
  if ((!storeId && !token) || !process.env.BLOB_WEBHOOK_PUBLIC_KEY) {
    return NextResponse.json({ error: "L’envoi direct est indisponible." }, { status: 503 });
  }

  try {
    const body = (await request.json()) as HandleUploadPresignedBody;
    const result = await handleUploadPresigned({
      body,
      request,
      webhookPublicKey: process.env.BLOB_WEBHOOK_PUBLIC_KEY,
      getSignedToken: async (pathname, clientPayload) => {
        const diskName = pathname.match(/^liaison\/([a-f0-9]{32})$/i)?.[1];
        if (!diskName) throw new Error("Chemin d’envoi invalide.");

        const payload = payloadFor(clientPayload);
        if (typeof payload.propertyId !== "string" || typeof payload.name !== "string" || typeof payload.size !== "number") {
          throw new Error("Métadonnées du fichier invalides.");
        }
        if (!Number.isSafeInteger(payload.size) || payload.size < 1 || payload.size > DOCUMENT_MAX_BYTES) {
          throw new Error("Le fichier doit faire entre 1 octet et 10 Mo.");
        }

        const name = payload.name.trim().slice(0, 200);
        const mime = documentMimeFor(name, typeof payload.mime === "string" ? payload.mime : null);
        if (!mime) throw new Error("Formats acceptés : JPG, PNG, WebP, PDF.");

        await propertyUploadContext(user, payload.propertyId, payload.leaseId);
        const signed = await issueSignedToken({
          pathname,
          operations: ["put"],
          validUntil: Date.now() + 15 * 60_000,
          allowedContentTypes: [mime],
          maximumSizeInBytes: payload.size,
          ...(token ? { token } : { storeId }),
        });
        return { token: signed };
      },
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error("Direct upload authorization failed", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ error: "L’autorisation d’envoi du document a échoué." }, { status: 400 });
  }
}
