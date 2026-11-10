// File storage for the originals people give Debo (voice notes, papers, photos).
//
// Neon Object Storage speaks the S3 API, so we use the AWS SDK. Buckets are
// private: files are only ever handed out through short-lived signed links.
import {
  DeleteObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { z } from "zod";

const StorageEnv = z.object({
  AWS_ENDPOINT_URL_S3: z.string().url(),
  AWS_REGION: z.string().min(1),
  AWS_ACCESS_KEY_ID: z.string().min(1),
  AWS_SECRET_ACCESS_KEY: z.string().min(1),
});

/** The private bucket declared in neon.ts. */
export const FILES_BUCKET = "assets";

/** How long a signed download link works. Short on purpose. */
const LINK_SECONDS = 5 * 60;

export function createStorage(env: Record<string, string | undefined>) {
  const parsed = StorageEnv.parse(env);
  return new S3Client({
    endpoint: parsed.AWS_ENDPOINT_URL_S3,
    region: parsed.AWS_REGION,
    forcePathStyle: true, // Neon supports path-style addressing only
    credentials: {
      accessKeyId: parsed.AWS_ACCESS_KEY_ID,
      secretAccessKey: parsed.AWS_SECRET_ACCESS_KEY,
    },
  });
}

export type Storage = ReturnType<typeof createStorage>;

export async function putFile(storage: Storage, key: string, body: Uint8Array | string, contentType: string) {
  await storage.send(
    new PutObjectCommand({ Bucket: FILES_BUCKET, Key: key, Body: body, ContentType: contentType }),
  );
}

export async function readFileText(storage: Storage, key: string): Promise<string> {
  const result = await storage.send(new GetObjectCommand({ Bucket: FILES_BUCKET, Key: key }));
  if (!result.Body) throw new Error("The stored file came back empty.");
  return result.Body.transformToString();
}

/** A link the owner can open for a few minutes. Check ownership before calling. */
export async function signedFileLink(storage: Storage, key: string): Promise<string> {
  return getSignedUrl(storage, new GetObjectCommand({ Bucket: FILES_BUCKET, Key: key }), {
    expiresIn: LINK_SECONDS,
  });
}

export async function deleteFile(storage: Storage, key: string) {
  await storage.send(new DeleteObjectCommand({ Bucket: FILES_BUCKET, Key: key }));
}

/** Every file a person owns lives under this folder. */
export function userFolder(userId: string): string {
  if (!/^[A-Za-z0-9_-]+$/.test(userId)) throw new Error("That user id is not safe to use in a file path.");
  return `users/${userId}/`;
}

/** Delete every file in a person's folder. Returns how many were deleted. */
export async function deleteUserFiles(storage: Storage, userId: string): Promise<number> {
  const prefix = userFolder(userId);
  let deleted = 0;
  let token: string | undefined;
  do {
    const page = await storage.send(
      new ListObjectsV2Command({ Bucket: FILES_BUCKET, Prefix: prefix, ContinuationToken: token }),
    );
    for (const object of page.Contents ?? []) {
      if (!object.Key) continue;
      await deleteFile(storage, object.Key);
      deleted += 1;
    }
    token = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (token);
  return deleted;
}
