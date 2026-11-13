// One row of settings per person. The values live in one JSON column,
// checked by the UserSettings schema in settings.ts on every read and write,
// so a new setting needs no migration.
import { jsonb, pgTable, timestamp, uuid } from "drizzle-orm/pg-core";
import { authUsers } from "./schema";

export const userSettings = pgTable("user_settings", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => authUsers.id, { onDelete: "cascade" }),
  values: jsonb("values").notNull().default({}),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
