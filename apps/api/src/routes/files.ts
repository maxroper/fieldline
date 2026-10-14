import { schema as s, type Connection } from "@fieldline/db";
import { FILE_KINDS, newId } from "@fieldline/shared";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import type { AppEnv } from "../app";
import { scoped } from "../db";
import { notFound } from "../http";
import { publish } from "../realtime";
import { storage, storageKey } from "../storage";

const MAX_BYTES = 15 * 1024 * 1024;

/** Photos, nameplates and documents. Multipart upload; bytes go to storage, the record to the files table. */
export function filesRoutes(conn: Connection) {
  const r = new Hono<AppEnv>();
  const run = scoped(conn);

  r.post("/", async (c) => {
    const form = await c.req.parseBody();
    const file = form["file"];
    if (!(file instanceof File)) throw new HTTPException(400, { message: "Send a multipart form with a `file` field" });
    if (file.size > MAX_BYTES) throw new HTTPException(413, { message: "File is larger than 15 MB" });
    const kindRaw = typeof form["kind"] === "string" ? form["kind"] : "photo";
    const kind = (FILE_KINDS as readonly string[]).includes(kindRaw) ? (kindRaw as (typeof FILE_KINDS)[number]) : "photo";
    const bytes = new Uint8Array(await file.arrayBuffer());
    const record = await run(c, async (tx, session) => {
      const id = newId();
      const key = storageKey(session.orgId, id, file.type || "application/octet-stream");
      await storage.put(key, bytes);
      const [row] = await tx
        .insert(s.files)
        .values({ id, orgId: session.orgId, kind, workOrderId: typeof form["workOrderId"] === "string" && form["workOrderId"] ? form["workOrderId"] : null, equipmentId: typeof form["equipmentId"] === "string" && form["equipmentId"] ? form["equipmentId"] : null, relatedId: typeof form["relatedId"] === "string" && form["relatedId"] ? form["relatedId"] : null, caption: typeof form["caption"] === "string" ? form["caption"] : "", storageKey: key, mime: file.type || "application/octet-stream", bytes: bytes.byteLength, createdBy: session.userId })
        .returning();
      if (kind === "nameplate" && row!.equipmentId) await tx.update(s.equipment).set({ nameplateFileId: row!.id, source: "nameplate_photo" }).where(eq(s.equipment.id, row!.equipmentId));
      return row!;
    });
    if (record.workOrderId) publish(c.get("session").orgId, "work_order.updated", record.workOrderId);
    return c.json({ file: record }, 201);
  });

  r.get("/:id", async (c) => {
    const id = c.req.param("id");
    const record = await run(c, async (tx) => (await tx.select().from(s.files).where(eq(s.files.id, id)).limit(1))[0]);
    if (!record) notFound("File not found");
    const bytes = await storage.get(record.storageKey);
    if (!bytes) notFound("File bytes are missing");
    return new Response(bytes as unknown as BodyInit, { status: 200, headers: { "Content-Type": record.mime, "Cache-Control": "private, max-age=3600" } });
  });

  r.delete("/:id", async (c) => {
    const id = c.req.param("id");
    await run(c, (tx) => tx.delete(s.files).where(eq(s.files.id, id)));
    return c.json({ ok: true });
  });

  return r;
}
