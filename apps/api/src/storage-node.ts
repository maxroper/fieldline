import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { Storage } from "./storage";

/** The local adapter: files under a directory on disk. Node only; the entry point installs it. */
export function localDiskStorage(dir: string): Storage {
  return {
    async put(key, bytes) {
      const path = join(dir, key);
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, bytes);
    },
    async get(key) {
      try {
        return new Uint8Array(await readFile(join(dir, key)));
      } catch {
        return null;
      }
    },
  };
}
