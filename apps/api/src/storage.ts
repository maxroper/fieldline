import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { env } from "./env";

/**
 * File storage behind one small interface. The local adapter writes under FILES_DIR.
 * An S3-compatible adapter (Supabase Storage, R2, S3) implements the same two functions.
 */
export interface Storage {
  put(key: string, bytes: Uint8Array): Promise<void>;
  get(key: string): Promise<Uint8Array | null>;
}

export const localStorage: Storage = {
  async put(key, bytes) {
    const path = join(env.filesDir, key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, bytes);
  },
  async get(key) {
    try {
      return await readFile(join(env.filesDir, key));
    } catch {
      return null;
    }
  },
};

export const storage: Storage = localStorage;

export function storageKey(orgId: string, fileId: string, mime: string): string {
  const ext = mime === "image/jpeg" ? "jpg" : mime === "image/png" ? "png" : mime === "application/pdf" ? "pdf" : "bin";
  return `${orgId}/${fileId}.${ext}`;
}

/** data:image/png;base64,... to bytes and mime. */
export function decodeDataUrl(dataUrl: string): { mime: string; bytes: Uint8Array } | null {
  const match = /^data:([^;,]+);base64,(.+)$/.exec(dataUrl);
  if (!match) return null;
  return { mime: match[1]!, bytes: Buffer.from(match[2]!, "base64") };
}
