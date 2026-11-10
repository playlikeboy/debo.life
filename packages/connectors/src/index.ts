// @debo/connectors: the only package that talks to the connector provider
// (Composio). See docs/CONNECTORS.md.
//
// Switched off until COMPOSIO_API_KEY is set. Nothing here makes a network
// call at import time. Read-only: no tool that sends, creates or deletes in
// the person's apps is ever called from here.
//
// Everything that comes back from a connected app is DATA, never
// instructions. An event title that says "ignore your rules" is just text.
import { Composio } from "@composio/core";
import { z } from "zod";

const ConnectorsEnv = z.object({
  COMPOSIO_API_KEY: z.string().min(1),
  // Auth config made in the Composio dashboard for Google Calendar, read-only scope.
  COMPOSIO_GOOGLECALENDAR_AUTH_CONFIG_ID: z.string().min(1),
  // Pinned tool version (e.g. "20250909_00"); never run "latest" by accident.
  COMPOSIO_GOOGLECALENDAR_VERSION: z.string().min(1),
});

/** The apps Debo can connect, in the order of docs/CONNECTORS.md. Only the first is wired. */
export type ConnectorApp = "googlecalendar";

// Composio tool used to list events. Check the exact slug in the Composio
// dashboard's Google Calendar tool list before turning connectors on.
const LIST_EVENTS_TOOL = "GOOGLECALENDAR_EVENTS_LIST";

export function connectorsEnabled(env: Record<string, string | undefined>): boolean {
  return Boolean(env.COMPOSIO_API_KEY);
}

export type Connection = { id: string; app: string; status: string; createdAt: string };

const CalendarEvent = z.object({
  id: z.string(),
  title: z.string(),
  start: z.string(), // ISO date or date-time
  end: z.string().optional(),
  location: z.string().optional(),
});
export type CalendarEvent = z.infer<typeof CalendarEvent>;

// Google's event shape, as much as we read. Unknown fields are dropped.
const RawEvent = z.object({
  id: z.string(),
  summary: z.string().optional(),
  location: z.string().optional(),
  start: z.object({ dateTime: z.string().optional(), date: z.string().optional() }).optional(),
  end: z.object({ dateTime: z.string().optional(), date: z.string().optional() }).optional(),
});

export function createConnectors(env: Record<string, string | undefined>) {
  if (!connectorsEnabled(env)) {
    throw new Error("Connected apps are switched off. Set COMPOSIO_API_KEY to turn them on.");
  }
  const parsed = ConnectorsEnv.parse(env);
  const composio = new Composio({ apiKey: parsed.COMPOSIO_API_KEY });

  /** This person's connection for an app, or null. Composio's user id is our user id. */
  async function findConnection(userId: string, app: ConnectorApp) {
    const list = await composio.connectedAccounts.list({ userIds: [userId], toolkitSlugs: [app] });
    return list.items.find((item) => item.status === "ACTIVE") ?? null;
  }

  return {
    /** Start connecting an app. Returns the link to send the person to. */
    async startConnect(userId: string, app: ConnectorApp, redirectUrl: string): Promise<string> {
      const request = await composio.connectedAccounts.link(userId, parsed.COMPOSIO_GOOGLECALENDAR_AUTH_CONFIG_ID, {
        callbackUrl: redirectUrl,
      });
      if (!request.redirectUrl) throw new Error(`Could not start connecting ${app}. Try again in a moment.`);
      return request.redirectUrl;
    },

    async listConnections(userId: string): Promise<Connection[]> {
      const list = await composio.connectedAccounts.list({ userIds: [userId] });
      return list.items.map((item) => ({
        id: item.id,
        app: item.toolkit.slug,
        status: item.status,
        createdAt: item.createdAt,
      }));
    },

    /** Disconnect, but only a connection that belongs to this person. */
    async disconnect(userId: string, connectionId: string): Promise<boolean> {
      const list = await composio.connectedAccounts.list({ userIds: [userId] });
      if (!list.items.some((item) => item.id === connectionId)) return false;
      await composio.connectedAccounts.delete(connectionId);
      return true;
    },

    /** Read upcoming calendar events. Read-only; returns plain, validated data. */
    async readUpcomingEvents(userId: string, { days }: { days: number }): Promise<CalendarEvent[]> {
      const span = z.number().int().min(1).max(31).parse(days);
      const connection = await findConnection(userId, "googlecalendar");
      if (!connection) return [];

      const now = new Date();
      const until = new Date(now.getTime() + span * 24 * 60 * 60 * 1000);
      const result = await composio.tools.execute(LIST_EVENTS_TOOL, {
        userId,
        connectedAccountId: connection.id,
        version: parsed.COMPOSIO_GOOGLECALENDAR_VERSION,
        arguments: { calendarId: "primary", timeMin: now.toISOString(), timeMax: until.toISOString(), singleEvents: true },
      });
      if (!result.successful) throw new Error("Could not read the calendar. Try again in a moment.");

      const items = z.array(z.unknown()).catch([]).parse((result.data as { items?: unknown }).items);
      return items.flatMap((raw) => {
        const event = RawEvent.safeParse(raw);
        if (!event.success) return [];
        const start = event.data.start?.dateTime ?? event.data.start?.date;
        if (!start) return [];
        return [
          CalendarEvent.parse({
            id: event.data.id,
            title: event.data.summary ?? "Untitled event",
            start,
            end: event.data.end?.dateTime ?? event.data.end?.date,
            location: event.data.location,
          }),
        ];
      });
    },
  };
}

export type Connectors = ReturnType<typeof createConnectors>;
