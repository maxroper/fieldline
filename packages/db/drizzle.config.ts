import { defineConfig } from "drizzle-kit";

// `generate` only reads the schema; no database connection is needed for it.
// `studio` and `push` connect to DATABASE_URL when set, else the local PGlite folder.
const url = process.env.DATABASE_URL;

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema/index.ts",
  out: "./drizzle",
  ...(url ? { dbCredentials: { url } } : { driver: "pglite", dbCredentials: { url: "../../data/pglite" } }),
  strict: true,
  verbose: false,
});
