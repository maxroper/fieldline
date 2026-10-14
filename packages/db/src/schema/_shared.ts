import { sql } from "drizzle-orm";
import { numeric, timestamp, uuid } from "drizzle-orm/pg-core";

/** Column helpers so every table reads the same way. */
export const idCol = () => uuid("id").primaryKey().default(sql`gen_random_uuid()`);
export const createdAt = () => timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().defaultNow();
export const updatedAt = () => timestamp("updated_at", { withTimezone: true, mode: "string" }).notNull().defaultNow();
export const stamp = (name: string) => timestamp(name, { withTimezone: true, mode: "string" });
export const money = (name: string) => numeric(name, { precision: 12, scale: 2, mode: "number" });
export const hours = (name: string) => numeric(name, { precision: 8, scale: 2, mode: "number" });
export const qty = (name: string) => numeric(name, { precision: 12, scale: 3, mode: "number" });
export const percent = (name: string) => numeric(name, { precision: 6, scale: 3, mode: "number" });
