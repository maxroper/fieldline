import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import type { ZodType } from "zod";

/** Validate a request body or query against a Zod schema; 400 with the issues when it fails. */
export function parse<T>(schema: ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new HTTPException(400, { message: "Invalid request", cause: result.error.issues });
  }
  return result.data;
}

export function notFound(what = "Not found"): never {
  throw new HTTPException(404, { message: what });
}

export function conflict(message: string): never {
  throw new HTTPException(409, { message });
}

export function forbidden(message = "Not allowed"): never {
  throw new HTTPException(403, { message });
}

export async function jsonBody(c: Context): Promise<unknown> {
  try {
    return await c.req.json();
  } catch {
    return {};
  }
}

export function todayParam(value: string | undefined, fallback: string): string {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : fallback;
}
