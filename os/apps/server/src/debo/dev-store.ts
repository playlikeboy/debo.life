// DEV AND TEST ONLY. A bucket that lives in memory, standing in for R2.
//
// Tests use it directly. The sample-mode dev server (DEBO_DEV_MEMORY=1) also
// serves it over HTTP under /api/dev-r2, so the screens can upload and play
// back without a Cloudflare account. Everything is forgotten when the server
// stops. It never runs in a live workspace (createDebo refuses).
import { createHash, randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { Hono } from "hono";
import type { ObjectStore, UploadPart, UploadPlan } from "./object-store.ts";

type Grant = { op: "put" | "part" | "get"; key: string; uploadId?: string; part?: number; mimeType?: string; size?: number; expires: number };

export type MemoryStore = ObjectStore & {
  objects: Map<string, Uint8Array>;
  /** Test helper: put bytes straight in, as if the app had uploaded them. */
  put(key: string, bytes: Uint8Array): void;
  /** Every link handed out, by kind, to check that nothing is issued to the wrong person. */
  issued: { op: string; key: string }[];
  routes(): Hono;
};

export function memoryStore(baseUrl = "http://localhost:8787"): MemoryStore {
  const objects = new Map<string, Uint8Array>();
  const uploads = new Map<string, Map<number, Uint8Array>>();
  const grants = new Map<string, Grant>();
  const issued: { op: string; key: string }[] = [];

  const grant = (g: Omit<Grant, "expires">, seconds: number) => {
    const token = randomUUID();
    grants.set(token, { ...g, expires: Date.now() + seconds * 1000 });
    issued.push({ op: g.op, key: g.key });
    return `${baseUrl}/api/dev-r2/${token}`;
  };

  const store: MemoryStore = {
    objects,
    issued,
    put: (key, bytes) => void objects.set(key, bytes),
    async beginUpload({ key, mimeType, size, singleMaxBytes, partBytes, expiresSeconds }): Promise<UploadPlan> {
      if (size <= singleMaxBytes)
        return { mode: "single", url: grant({ op: "put", key, size }, expiresSeconds), headers: { "Content-Type": mimeType } };
      const uploadId = randomUUID();
      uploads.set(uploadId, new Map());
      const count = Math.ceil(size / partBytes);
      const parts: UploadPart[] = Array.from({ length: count }, (_, i) => ({
        number: i + 1,
        url: grant({ op: "part", key, uploadId, part: i + 1 }, expiresSeconds),
        headers: {},
      }));
      return { mode: "multipart", uploadId, partBytes, parts };
    },
    async finishUpload(key, uploadId, parts) {
      const held = uploads.get(uploadId);
      if (!held) throw new Error("No such upload.");
      const chunks = parts
        .slice()
        .sort((a, b) => a.number - b.number)
        .map((p) => {
          const bytes = held.get(p.number);
          if (!bytes || etag(bytes) !== p.etag.replaceAll('"', "")) throw new Error("A part is missing.");
          return bytes;
        });
      objects.set(key, Buffer.concat(chunks));
      uploads.delete(uploadId);
    },
    async abortUpload(_key, uploadId) {
      uploads.delete(uploadId);
    },
    async head(key) {
      const bytes = objects.get(key);
      return bytes ? { size: bytes.byteLength } : null;
    },
    async signedGet(key, mimeType, seconds) {
      issued.push({ op: "get-requested", key });
      return grant({ op: "get", key, mimeType }, seconds);
    },
    async delete(key) {
      objects.delete(key);
    },
    async deletePrefix(prefix) {
      let n = 0;
      for (const key of [...objects.keys()]) if (key.startsWith(prefix)) (objects.delete(key), n++);
      return n;
    },
    async download(key, destination) {
      const bytes = objects.get(key);
      if (!bytes) throw new Error("No such object.");
      await writeFile(destination, bytes);
    },
    routes() {
      const app = new Hono();
      const find = (token: string, ops: Grant["op"][]) => {
        const g = grants.get(token);
        return g && g.expires > Date.now() && ops.includes(g.op) ? g : undefined;
      };
      app.put("/:token", async (c) => {
        const g = find(c.req.param("token"), ["put", "part"]);
        if (!g) return c.text("Link expired", 403);
        const bytes = new Uint8Array(await c.req.arrayBuffer());
        if (g.op === "put") {
          if (g.size !== undefined && bytes.byteLength !== g.size) return c.text("Wrong size", 403);
          objects.set(g.key, bytes);
        } else {
          uploads.get(g.uploadId ?? "")?.set(g.part ?? 0, bytes);
        }
        c.header("ETag", `"${etag(bytes)}"`);
        return c.body(null, 200);
      });
      app.on(["GET", "HEAD"], "/:token", (c) => {
        const g = find(c.req.param("token"), ["get"]);
        const bytes = g ? objects.get(g.key) : undefined;
        if (!g || !bytes) return c.text("Not found", 404);
        const headers = { "Content-Type": g.mimeType ?? "application/octet-stream", "Accept-Ranges": "bytes" };
        const range = /^bytes=(\d*)-(\d*)$/.exec(c.req.header("range") ?? "");
        if (range) {
          const start = range[1] ? Number(range[1]) : 0;
          const end = range[2] ? Math.min(Number(range[2]), bytes.byteLength - 1) : bytes.byteLength - 1;
          return new Response(Buffer.from(bytes.slice(start, end + 1)), {
            status: 206,
            headers: { ...headers, "Content-Range": `bytes ${start}-${end}/${bytes.byteLength}` },
          });
        }
        return new Response(c.req.method === "HEAD" ? null : Buffer.from(bytes), { headers: { ...headers, "Content-Length": String(bytes.byteLength) } });
      });
      return app;
    },
  };
  return store;
}

const etag = (bytes: Uint8Array) => createHash("md5").update(bytes).digest("hex");
