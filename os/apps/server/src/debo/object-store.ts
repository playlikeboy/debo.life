// Where recordings are kept: a private Cloudflare R2 bucket, spoken to over the
// S3 API with `aws4fetch` (a tiny signer, nothing else). The bucket has no
// public address. The app uploads straight to R2 and plays back straight from
// R2 using short-lived signed links that this server hands out, but only to
// the owner of the recording (the service checks that before it asks for one).
//
// `ObjectStore` is the small seam: the real one below, a fake in memory for
// tests and the sample-mode dev server (see dev-store.ts).
import { createWriteStream } from "node:fs";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { AwsClient } from "aws4fetch";

export type UploadPart = { number: number; url: string; headers: Record<string, string> };

/** How the app should send the file. */
export type UploadPlan =
  | { mode: "single"; url: string; headers: Record<string, string> }
  | { mode: "multipart"; uploadId: string; partBytes: number; parts: UploadPart[] };

export interface ObjectStore {
  /** Make links the app can upload to. `size` is exact, so the links only accept that many bytes. */
  beginUpload(input: {
    key: string;
    mimeType: string;
    size: number;
    singleMaxBytes: number;
    partBytes: number;
    expiresSeconds: number;
  }): Promise<UploadPlan>;
  /** Join the parts of a multipart upload. */
  finishUpload(key: string, uploadId: string, parts: { number: number; etag: string }[]): Promise<void>;
  /** Throw away a half-finished multipart upload. Never throws. */
  abortUpload(key: string, uploadId: string): Promise<void>;
  /** Size in bytes, or null when there is no such object. */
  head(key: string): Promise<{ size: number } | null>;
  /** A link that plays the object for a short time. */
  signedGet(key: string, mimeType: string, expiresSeconds: number): Promise<string>;
  /** Delete one object. Deleting something that is not there is fine. */
  delete(key: string): Promise<void>;
  /** Delete every object whose key starts with `prefix`. Returns how many. */
  deletePrefix(prefix: string): Promise<number>;
  /** Copy the object to a file on disk (temporary, for transcription). */
  download(key: string, destination: string): Promise<void>;
}

export type R2Config = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
};

/** The R2 settings from the environment, or undefined when recordings are not set up. */
export function r2ConfigFromEnv(env: Record<string, string | undefined>): R2Config | undefined {
  const accountId = env.R2_ACCOUNT_ID?.trim();
  const accessKeyId = env.R2_ACCESS_KEY_ID?.trim();
  const secretAccessKey = env.R2_SECRET_ACCESS_KEY?.trim();
  const bucket = env.R2_BUCKET?.trim() || "debo-journal-media";
  if (!accountId || !accessKeyId || !secretAccessKey) return undefined;
  return { accountId, accessKeyId, secretAccessKey, bucket };
}

const xml = (text: string, tag: string) => text.match(new RegExp(`<${tag}>([^<]*)</${tag}>`))?.[1];

export function r2Store(config: R2Config, fetchImpl: typeof fetch = fetch): ObjectStore {
  const aws = new AwsClient({
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey,
    service: "s3",
    region: "auto",
  });
  const base = `https://${config.accountId}.r2.cloudflarestorage.com/${config.bucket}`;
  const objectUrl = (key: string) => `${base}/${key.split("/").map(encodeURIComponent).join("/")}`;

  /** A signed link for one request. The headers listed are part of the signature, so the app must send them as given. */
  async function presign(method: string, url: string, expires: number, headers: Record<string, string> = {}) {
    const target = new URL(url);
    target.searchParams.set("X-Amz-Expires", String(expires));
    const signed = await aws.sign(new Request(target, { method, headers }), {
      aws: { signQuery: true, allHeaders: Object.keys(headers).length > 0 },
    });
    return signed.url.toString();
  }

  /** A request we make ourselves, signed in the header. */
  const call = (method: string, url: string, body?: string) =>
    aws.fetch(url, { method, body, headers: body ? { "Content-Type": "application/xml" } : {}, signal: AbortSignal.timeout(30_000) });

  return {
    async beginUpload({ key, mimeType, size, singleMaxBytes, partBytes, expiresSeconds }) {
      const url = objectUrl(key);
      if (size <= singleMaxBytes) {
        const headers = { "Content-Type": mimeType, "Content-Length": String(size) };
        return { mode: "single", url: await presign("PUT", url, expiresSeconds, headers), headers: { "Content-Type": mimeType } };
      }
      const started = await call("POST", `${url}?uploads`);
      const uploadId = xml(await started.text(), "UploadId");
      if (!started.ok || !uploadId) throw new Error("R2 would not start the upload.");
      const count = Math.ceil(size / partBytes);
      const parts: UploadPart[] = [];
      for (let number = 1; number <= count; number++) {
        const length = number === count ? size - partBytes * (count - 1) : partBytes;
        const headers = { "Content-Length": String(length) };
        const partUrl = `${url}?partNumber=${number}&uploadId=${encodeURIComponent(uploadId)}`;
        parts.push({ number, url: await presign("PUT", partUrl, expiresSeconds, headers), headers: {} });
      }
      return { mode: "multipart", uploadId, partBytes, parts };
    },

    async finishUpload(key, uploadId, parts) {
      const body = `<CompleteMultipartUpload>${[...parts]
        .sort((a, b) => a.number - b.number)
        .map((p) => `<Part><PartNumber>${p.number}</PartNumber><ETag>${p.etag.replace(/[<>&]/g, "")}</ETag></Part>`)
        .join("")}</CompleteMultipartUpload>`;
      const response = await call("POST", `${objectUrl(key)}?uploadId=${encodeURIComponent(uploadId)}`, body);
      // S3 can answer 200 with an error in the body.
      if (!response.ok || /<Error>/.test(await response.text())) throw new Error("R2 would not join the parts.");
    },

    async abortUpload(key, uploadId) {
      try {
        await call("DELETE", `${objectUrl(key)}?uploadId=${encodeURIComponent(uploadId)}`);
      } catch {
        // A leftover upload costs nothing until it is joined; R2 clears old ones on its own.
      }
    },

    async head(key) {
      const response = await call("HEAD", objectUrl(key));
      if (response.status === 404) return null;
      if (!response.ok) throw new Error("R2 would not answer.");
      return { size: Number(response.headers.get("content-length") ?? 0) };
    },

    signedGet: (key, _mime, expires) => presign("GET", objectUrl(key), expires),

    async delete(key) {
      const response = await call("DELETE", objectUrl(key));
      if (!response.ok && response.status !== 404) throw new Error("R2 would not delete the file.");
    },

    async deletePrefix(prefix) {
      let removed = 0;
      for (let round = 0; round < 50; round++) {
        const listing = await call("GET", `${base}?list-type=2&prefix=${encodeURIComponent(prefix)}&max-keys=1000`);
        if (!listing.ok) throw new Error("R2 would not list the files.");
        const keys = [...(await listing.text()).matchAll(/<Key>([^<]*)<\/Key>/g)].map((m) => m[1] ?? "");
        if (keys.length === 0) break;
        // One by one: rare (deleting a whole account), and it avoids DeleteObjects' extra header rules.
        for (const key of keys) {
          const response = await call("DELETE", objectUrl(key));
          if (!response.ok && response.status !== 404) throw new Error("R2 would not delete the files.");
        }
        removed += keys.length;
      }
      return removed;
    },

    async download(key, destination) {
      const response = await fetchImpl(await presign("GET", objectUrl(key), 600), { signal: AbortSignal.timeout(10 * 60_000) });
      if (!response.ok || !response.body) throw new Error("R2 would not send the file.");
      await pipeline(Readable.fromWeb(response.body as import("node:stream/web").ReadableStream), createWriteStream(destination));
    },
  };
}
