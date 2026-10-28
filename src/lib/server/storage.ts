import { chmod, mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { del, get, put } from "@vercel/blob";

const localDirectory = path.join(process.env.DATA_DIR || path.join(process.cwd(), "data"), "uploads");
const blobPrefix = "liaison";

function storageKey(key: string): string {
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,199}$/.test(key)) {
    throw new Error("Clé de stockage invalide.");
  }
  return key;
}

function blobConfiguration() {
  const token = process.env.BLOB_READ_WRITE_TOKEN?.trim() || undefined;
  const storeId = process.env.BLOB_STORE_ID?.trim() || undefined;
  const hostedOnVercel = process.env.VERCEL === "1" || Boolean(process.env.VERCEL_ENV);
  if (hostedOnVercel && !token && !storeId) {
    throw new Error("BLOB_STORE_ID ou BLOB_READ_WRITE_TOKEN est requis sur Vercel.");
  }
  return { token, storeId, hostedOnVercel, useBlob: Boolean(token || storeId) };
}

function localPath(key: string): string {
  return path.join(localDirectory, storageKey(key));
}

export async function storeFile(key: string, bytes: Buffer, contentType: string): Promise<void> {
  const pathname = `${blobPrefix}/${storageKey(key)}`;
  const { token, storeId, hostedOnVercel, useBlob } = blobConfiguration();
  if (useBlob) {
    await put(pathname, bytes, {
      access: "private",
      contentType,
      ...(token ? { token } : { storeId }),
      addRandomSuffix: false,
      allowOverwrite: false,
    });
    return;
  }
  if (hostedOnVercel) throw new Error("BLOB_READ_WRITE_TOKEN est requis sur Vercel.");
  await mkdir(localDirectory, { recursive: true, mode: 0o700 });
  await chmod(localDirectory, 0o700).catch(() => undefined);
  await writeFile(localPath(key), bytes, { flag: "wx", mode: 0o600 });
}

export async function readStoredFile(key: string): Promise<Buffer> {
  const pathname = `${blobPrefix}/${storageKey(key)}`;
  const { token, storeId, hostedOnVercel, useBlob } = blobConfiguration();
  if (useBlob) {
    const result = await get(pathname, { access: "private", ...(token ? { token } : { storeId }), useCache: false });
    if (!result || result.statusCode !== 200) throw new Error("Fichier introuvable.");
    return Buffer.from(await new Response(result.stream).arrayBuffer());
  }
  if (hostedOnVercel) throw new Error("BLOB_READ_WRITE_TOKEN est requis sur Vercel.");
  return readFile(localPath(key));
}

export async function removeStoredFile(key: string): Promise<void> {
  const pathname = `${blobPrefix}/${storageKey(key)}`;
  const { token, storeId, hostedOnVercel, useBlob } = blobConfiguration();
  if (useBlob) {
    await del(pathname, token ? { token } : { storeId }).catch(() => undefined);
    return;
  }
  if (hostedOnVercel) throw new Error("BLOB_READ_WRITE_TOKEN est requis sur Vercel.");
  await unlink(localPath(key)).catch(() => undefined);
}
