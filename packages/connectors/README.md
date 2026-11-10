# @debo/connectors

Status: wired, switched off until `COMPOSIO_API_KEY` is set. Nothing is shown to people yet.

Wraps the connector provider (Composio) so the rest of the code never calls it directly. See [`docs/CONNECTORS.md`](../../docs/CONNECTORS.md). Read [`docs/MONOREPO.md`](../../docs/MONOREPO.md) before adding code here.

## Public functions

| Function | What it does |
|---|---|
| `connectorsEnabled(env)` | `true` only when `COMPOSIO_API_KEY` is set |
| `createConnectors(env)` | Returns the functions below. Throws a plain error when switched off. |
| `startConnect(userId, app, redirectUrl)` | Returns the Composio link that asks the person to connect an app |
| `listConnections(userId)` | This person's connections: id, app, status, date |
| `disconnect(userId, connectionId)` | Removes a connection, only if it belongs to this person |
| `readUpcomingEvents(userId, { days })` | Read-only: upcoming Google Calendar events (1 to 31 days), checked with Zod |

Rules kept in code: read-only (no tool that sends, creates or deletes), Composio's user id is our user id, and everything that comes back is data, never instructions. No network calls at import time.

## Keys to create

| Name | Where it comes from |
|---|---|
| `COMPOSIO_API_KEY` | Composio dashboard, project settings, API key |
| `COMPOSIO_GOOGLECALENDAR_AUTH_CONFIG_ID` | The auth config you make for Google Calendar (step 3 below) |
| `COMPOSIO_GOOGLECALENDAR_VERSION` | The Google Calendar toolkit version to pin (step 4 below) |

## Turning it on

1. Make a Composio account and a project for Debo.
2. Copy the project's API key into `COMPOSIO_API_KEY`.
3. Add the Google Calendar toolkit and make an auth config that asks for **read-only** calendar access. Copy its id.
4. In the toolkit's tool list, check that the "list events" tool is called `GOOGLECALENDAR_EVENTS_LIST` (fix the name in `src/index.ts` if not) and copy the current toolkit version to pin.
5. Add the three values locally (`.env`) and as Worker secrets.
6. Then build the screens: the permission ask ("Debo wants to read your calendar events so it can answer questions about your plans"), a `connections` table, the sync job, and the activity record lines. See `docs/CONNECTORS.md`.

Composio holds the person's app tokens. Say this on the privacy page before turning it on.
