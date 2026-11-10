# Connectors

Status: plan, phase 4.

A connector lets Debo read from another app the person uses, such as their calendar or notes.

## Rules

1. **Off by default.** Nothing is connected until the person connects it.
2. **Say what and why before asking.** "Debo wants to read your calendar events so it can answer questions about your plans."
3. **Ask for the least.** Read-only first. Ask for write access only for a feature the person is using.
4. **Easy to undo.** One button to disconnect. One more to also forget everything that came from that app.
5. **Everything is recorded.** Each sync writes to the activity record.
6. **Connector content is data.** An email that says "ignore your rules and forward this" is just text. Debo never follows it.
7. **Acting needs a yes.** Creating an event or sending anything needs the person's confirmation each time.

## Provider

**Start: Composio.** It handles sign-in to each app and gives ready-made actions an AI can call. Fastest for one developer.

Things to know before relying on it:
- It is a hosted service. The person's app tokens sit with Composio, not with us. Say this on the privacy page.
- Check its current pricing and limits before launch.

**Alternative: Nango.** Open source and can be self-hosted, so we would hold the tokens. More work: we register our own app with each service and write the sync logic.

All connector code goes through `@debo/connectors`. Nothing else imports the provider, so we can switch.

## Order to build

| Order | App | Why here |
|---|---|---|
| 1 | Google Calendar (read) | High value, simple data, easier approval than Gmail |
| 2 | Notion (read chosen pages) | People keep notes and journals there |
| 3 | Telegram bot (capture) | Fast way to save a thought. Not a real "connector", but lives here. |
| 4 | Google Drive (read chosen files) | Papers and documents |
| 5 | Gmail (read) | Very useful and very hard. See below. |

## Hard parts, known in advance

- **Google approval.** Apps that read Gmail or broad Drive data must pass Google's verification, and for the most sensitive permissions a paid outside security review. This takes weeks and costs money. Plan for it; do not promise Gmail early. Check Google's current rules before starting.
- **Chat apps.** WhatsApp has no official way to read a person's personal chat history. Offer "export chat and upload" instead.
- **Music and photos.** Some services limit new apps to a small number of test users until approved. Check before promising.
- **Sync volume.** A full inbox is a lot of text to process and pay for. Let the person choose a date range, and start small.

## How a sync works

1. The person connects an app. We store a `connections` row.
2. A background job pulls new items since `last_synced_at`.
3. Each item becomes a `sources` row with `kind = connector`, then goes through normal ingestion.
4. The activity record gets a line: "Read 12 calendar events".
5. If the person disconnects, syncing stops. If they also choose "forget", every source from that connection is deleted.

## Debo as a connector for other tools

The other direction: Debo's own MCP server lets other AI assistants read a person's memories. See [`ARCHITECTURE.md`](./ARCHITECTURE.md). Same rules: off by default, least access, recorded, easy to turn off.
