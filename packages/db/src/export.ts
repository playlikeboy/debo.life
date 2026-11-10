// Everything a person owns, read for "Export everything".
// Every query filters by userId. Callers must never log the entry text.
import { asc, and, eq } from "drizzle-orm";
import { withDb } from "./client";
import type { ActivityItem } from "./records";
import { activity, sources } from "./schema";

export type ExportEntry = {
  id: string;
  title: string;
  text: string;
  happenedAt: Date;
  createdAt: Date;
  updatedAt: Date;
};

export type ExportRecords = { entries: ExportEntry[]; activity: ActivityItem[] };

/** All of this person's journal entries and their whole activity record, oldest first. */
export async function exportRecords(connectionString: string, userId: string): Promise<ExportRecords> {
  return withDb(connectionString, async (db) => {
    const entries = await db
      .select({
        id: sources.id,
        title: sources.title,
        text: sources.text,
        happenedAt: sources.happenedAt,
        createdAt: sources.createdAt,
        updatedAt: sources.updatedAt,
      })
      .from(sources)
      .where(and(eq(sources.userId, userId), eq(sources.kind, "journal")))
      .orderBy(asc(sources.happenedAt));
    const items = await db
      .select({
        id: activity.id,
        actor: activity.actor,
        action: activity.action,
        sourceIds: activity.sourceIds,
        createdAt: activity.createdAt,
      })
      .from(activity)
      .where(eq(activity.userId, userId))
      .orderBy(asc(activity.createdAt));
    return { entries, activity: items };
  });
}
