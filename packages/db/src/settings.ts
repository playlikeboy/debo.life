// A person's settings. Reads always return every setting: anything missing
// or invalid falls back to its default, so a bad row never breaks a page.
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { withDb } from "./client";
import { userSettings } from "./schema-settings";

/**
 * How much Debo may do on its own (see docs/CONTRACTS.md, "Tools").
 * 0: answer only, never act. 1: prepare actions and ask before anything
 * outside Debo (the default). 2: run low-risk actions within the scopes the
 * person set, ask for the rest. 3: also run recurring routines the person set up.
 */
export const Autonomy = z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]);

export const UserSettings = z.object({
  autonomy: Autonomy.catch(1).default(1),
  voice: z
    .object({
      /** Text-to-speech voice id, or "device" to use the browser's own voice. */
      voice: z.string().min(1).max(80).catch("default").default("default"),
      /** Speaking speed, 0.75 to 1.5. */
      speed: z.number().min(0.75).max(1.5).catch(1).default(1),
      /** Keep a written transcript of voice conversations in Chat. Audio is never kept. */
      keepTranscripts: z.boolean().catch(true).default(true),
    })
    .catch({ voice: "default", speed: 1, keepTranscripts: true })
    .default({ voice: "default", speed: 1, keepTranscripts: true }),
  proactive: z
    .object({
      /** A short daily briefing on the Today page. Off until the person turns it on. */
      dailyBriefing: z.boolean().catch(false).default(false),
    })
    .catch({ dailyBriefing: false })
    .default({ dailyBriefing: false }),
});
export type UserSettings = z.infer<typeof UserSettings>;

export const DEFAULT_SETTINGS: UserSettings = UserSettings.parse({});

/** This person's settings, with defaults for anything not set. */
export async function getUserSettings(connectionString: string, userId: string): Promise<UserSettings> {
  return withDb(connectionString, async (db) => {
    const [row] = await db.select({ values: userSettings.values }).from(userSettings).where(eq(userSettings.userId, userId));
    return UserSettings.parse(row?.values ?? {});
  });
}

/** Change some settings and keep the rest. Returns the settings as saved. */
export async function updateUserSettings(
  connectionString: string,
  userId: string,
  change: (current: UserSettings) => UserSettings,
): Promise<UserSettings> {
  return withDb(connectionString, async (db) =>
    db.transaction(async (tx) => {
      const [row] = await tx
        .select({ values: userSettings.values })
        .from(userSettings)
        .where(eq(userSettings.userId, userId))
        .for("update");
      const next = UserSettings.parse(change(UserSettings.parse(row?.values ?? {})));
      await tx
        .insert(userSettings)
        .values({ userId, values: next })
        .onConflictDoUpdate({ target: userSettings.userId, set: { values: next, updatedAt: sql`now()` } });
      return next;
    }),
  );
}
