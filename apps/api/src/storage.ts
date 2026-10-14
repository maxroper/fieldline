/**
 * File storage behind one small interface. The Node entry installs the disk adapter from
 * `storage-node.ts`; the browser demo keeps files in memory. An S3-compatible adapter (Supabase
 * Storage, R2, S3) implements the same two functions and is installed the same way.
 */
export interface Storage {
  put(key: string, bytes: Uint8Array): Promise<void>;
  get(key: string): Promise<Uint8Array | null>;
}

export function memoryStorage(): Storage {
  const files = new Map<string, Uint8Array>();
  return {
    async put(key, bytes) {
      files.set(key, bytes);
    },
    async get(key) {
      return files.get(key) ?? null;
    },
  };
}

let current: Storage = memoryStorage();

/** Install the adapter for this process. Called once by the entry point before the app serves. */
export function setStorage(next: Storage): void {
  current = next;
}

export const storage: Storage = {
  put: (key, bytes) => current.put(key, bytes),
  get: (key) => current.get(key),
};

export function storageKey(orgId: string, fileId: string, mime: string): string {
  const ext = mime === "image/jpeg" ? "jpg" : mime === "image/png" ? "png" : mime === "application/pdf" ? "pdf" : "bin";
  return `${orgId}/${fileId}.${ext}`;
}

/** data:image/png;base64,... to bytes and mime. */
export function decodeDataUrl(dataUrl: string): { mime: string; bytes: Uint8Array } | null {
  const match = /^data:([^;,]+);base64,(.+)$/.exec(dataUrl);
  if (!match) return null;
  const binary = atob(match[2]!);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return { mime: match[1]!, bytes };
}
