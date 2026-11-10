// Usage (for daily limits) and the activity record (for the person to read).
// Every function takes userId and filters by it. Numbers and ids only.
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { withDb } from "./client";
import { activity, usage } from "./schema";

export type UsageRow = { provider: "anthropic" | "neon"; units: number };

export async function recordUsage(connectionString: string, userId: string, row: UsageRow) {
  await withDb(connectionString, (db) =>
    db.insert(usage).values({ userId, kind: "chat", provider: row.provider, keyOwner: "debo", units: row.units }),
  );
}

/** Tokens this person has used on our key since midnight UTC today. */
export async function tokensUsedToday(connectionString: string, userId: string): Promise<number> {
  return withDb(connectionString, async (db) => {
    const [row] = await db
      .select({ total: sql<number>`coalesce(sum(${usage.units}), 0)::int` })
      .from(usage)
      .where(
        and(
          eq(usage.userId, userId),
          eq(usage.keyOwner, "debo"),
          gte(usage.createdAt, sql`date_trunc('day', now() at time zone 'utc') at time zone 'utc'`),
        ),
      );
    return row?.total ?? 0;
  });
}

export type ActivityAction = "saved" | "edited" | "deleted" | "answered" | "did-not-know" | "exported";
export type ActivityItem = {
  id: string;
  actor: "you" | "debo";
  action: ActivityAction;
  sourceIds: string[];
  createdAt: Date;
};

export async function recordActivity(
  connectionString: string,
  userId: string,
  item: { actor: "you" | "debo"; action: ActivityAction; sourceIds?: string[] },
) {
  await withDb(connectionString, (db) =>
    db.insert(activity).values({ userId, actor: item.actor, action: item.action, sourceIds: item.sourceIds ?? [] }),
  );
}

/** The person's activity record, newest first. */
export async function listActivity(connectionString: string, userId: string, limit = 200): Promise<ActivityItem[]> {
  return withDb(connectionString, (db) =>
    db
      .select({
        id: activity.id,
        actor: activity.actor,
        action: activity.action,
        sourceIds: activity.sourceIds,
        createdAt: activity.createdAt,
      })
      .from(activity)
      .where(eq(activity.userId, userId))
      .orderBy(desc(activity.createdAt))
      .limit(limit),
  );
}
