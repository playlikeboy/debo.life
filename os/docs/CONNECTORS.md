# Connected apps (Composio)

A person can connect apps such as Gmail, Slack, Notion, GitHub and Google Drive, then ask Debo to use them from chat, tasks and voice. Debo reaches the apps through [Composio](https://composio.dev). The product plan for connectors is in [`docs/CONNECTORS.md`](../../docs/CONNECTORS.md) at the repo root; this file describes what is built in `os/`.

## What the person sees

- **Apps screen, "Connect your apps".** A first list of apps with one honest line each, one search box that narrows the list and also searches the whole catalogue, and a connected state with **Disconnect** (it asks first).
- **Connecting.** The person signs in on the app's own page, hosted by Composio. Debo never sees the password. On the web the page opens in a new tab; on a phone it opens in an in-app browser sheet that closes itself. The screen checks again when they come back.
- **Chat.** A card says which app was used ("Looked in Gmail"). A change shows "Asked to send a message in Slack: waiting for your yes" and a button that opens the exact review.
- **Not set up.** Without `COMPOSIO_API_KEY` the section says "Connecting apps is not set up yet." Nothing else changes.

## How it works

Code: `apps/server/src/connectors/`.

| File | Job |
|---|---|
| `types.ts` | Shapes shared by the rest. The `ConnectorBackend` interface is the one edge to the provider. |
| `composio.ts` | The real backend. The only file that imports `@composio/core`. |
| `fake.ts` | An in-memory backend for tests and for practice mode. |
| `service.ts` | The rules: owner scoping, catalogue cache, risk, previews, wrapping, rate limits, logs. |
| `risk.ts` | Read, write or destructive, from the provider's hints. |
| `tools.ts` | The two agent tools, for chat and for tasks. |
| `routes.ts` | The HTTP routes and the public callback page. |
| `curated.ts` | The first list and its one-line descriptions. |

### The Composio approach, and why

Composio has three ways to give an agent its tools: a session that hands the model a few meta tools, a session over MCP, and direct execution (legacy). Debo uses **a session for the person, driven from the server**, with its own two tools on top:

- `find_app_tools` calls `session.search({ query, toolkits })`, limited to apps the person has connected.
- `use_app_tool` calls `session.execute(slug, args)` after Debo's own checks.

Why not hand the model Composio's meta tools (`COMPOSIO_MULTI_EXECUTE_TOOL` and friends) directly: they would let the model run a tool in one step, and they include a remote shell and a code workbench. Debo needs to look at every call first to decide whether it only reads or changes something, and to put changes through its own review, which a person approves on screen. Composio's own Approvals feature is experimental and asks the person inside the model client; Debo's review flow is the one every other change already uses. Two small tools also keep the model's context small, which is the point of Composio's "search, then execute" design, and the same code serves chat, tasks and voice.

Docs used (checked November 2026): [sessions](https://docs.composio.dev/docs/configuring-sessions.md), [session methods](https://docs.composio.dev/reference/sdk-reference/typescript/session.md), [manual authentication](https://docs.composio.dev/docs/authentication/manually-authenticating.md), [tool hints](https://docs.composio.dev/docs/governance/tool-hints.md), [rate limits](https://docs.composio.dev/reference/rate-limits.md).

Package: `@composio/core` pinned at 0.27.0. 0.28.0 and 0.29.0 were under two weeks old when this was added; the repo's release-age rule applies. Telemetry in the SDK is turned off (`allowTracking: false`).

### Who is who

Each Debo person is exactly one Composio user: their **owner id** (a Neon Auth uuid). The id always comes from the signed-in session. Nothing the client sends can name another person. Disconnect looks the connection up in the caller's own accounts, so another person's connection id gets the same "not found" as one that does not exist. Every tool call runs in a session limited to that person's connected accounts, and each app is pinned to the account id Debo checked.

### Routes

| Route | Job |
|---|---|
| `GET /api/connectors` | The person's connections (with state) and the first list. |
| `GET /api/connectors/search?q=` | Search the whole catalogue. Apps that can be connected come first. |
| `POST /api/connectors/:toolkit/connect` | Starts a connection. Returns Composio's hosted link. Body `{ "to": "web" \| "native" }`. |
| `DELETE /api/connectors/:id` | Disconnects and really deletes the connected account at Composio. |
| `GET /api/connectors/callback` | Public. Where Composio sends people after sign-in. Fixed words only; changes nothing. |
| `DELETE /api/account` | Also deletes every connected account the person has at Composio, before anything else is removed. |
| `GET /api/account/export` | Adds `connectedApps`: app, state and date. Never a token. |

Connection states in plain words: connected; waiting ("Waiting for you to finish signing in"); failed; expired (a link nobody finished after 30 minutes, or a sign-in that ran out). Trying to connect again removes the old unfinished attempt.

### Catalogue

The list comes from `GET https://backend.composio.dev/api/v3/toolkits` and is cached in memory for six hours (the SDK's list call stops at 1,000 rows, so Debo pages the REST API). In November 2026 it held 1,742 apps. **Only 128 have Composio-managed sign-in**, so only those can be connected with one tap. The others need the owner to register their own OAuth app and an auth config in the Composio dashboard; until then they show as "Not available yet". Among the 16 apps in the first list, Telegram (bot token only) and Spotify have no managed sign-in today.

### Gmail and Google Calendar

Debo already has a built-in Google connection (`google-auth.ts`) with richer tools (full threads, drafts, PDFs, calendar edits with reviews). **That stays the one place for Gmail and Google Calendar.** When this Debo has its own Google sign-in (or in a sample workspace), the new list leaves those two out, so there is never a second "Gmail" card. When a person has connected the built-in Google, the agent uses it and ignores a Composio Gmail. When Debo has no Google sign-in of its own, Gmail and Google Calendar appear in the new list and work through Composio.

## Safety rules

1. **Reads run, changes wait.** Risk comes from Composio's hints on each tool (`readOnlyHint`, `createHint`, `updateHint`, `destructiveHint`), never from the model. A tool with no hints is a change. A tool whose name says send, delete, create and so on is a change even if a hint says read. The meta tools (`COMPOSIO_*`) cannot be reached at all.
2. **A change becomes a review.** It does not run. Debo prepares an action of kind `connector.call` and shows the person which app, what will happen and the exact values, in the same review sheet as an email. It runs only after they approve on screen. The proposal is bound to the exact arguments (a hash) and to the connected account; if the app was disconnected meanwhile the approval fails and nothing runs. Reviews expire after 30 minutes.
3. **Voice cannot approve** (`docs/VOICE.md`, rule 4). Voice can ask Debo to prepare a change, but approval is only the signed-in HTTP route, from the app.
4. **No autonomy setting yet.** Debo has no "act without asking" setting, so every change asks, every time.
5. **Results are data, not instructions.** What an app returns is wrapped in `<<<APP DATA … END APP DATA>>>` with a notice, any marker characters inside it are neutralised, and it is cut to 24,000 characters. Even a model that obeys text inside a result can only prepare a review; it can never send.
6. **Logs hold ids and outcomes only**: person id, app, tool name, success, Composio's log id. Never arguments or results. Tests check this.
7. **Rate limits per person**: 40 tool calls a minute, 10 connect links in ten minutes. (Composio also limits the whole organisation: 2,000 requests a minute on Hobby, 10,000 on Pro.)
8. **The person owns it.** Disconnect deletes at the provider. Account wipe deletes every connected account first, and stops with nothing else deleted if Composio cannot. Export lists apps and dates.

## Costs and plan limits

Composio bills the project (Debo), not each person. Sources: [composio.dev/pricing](https://composio.dev/pricing) and the [rate limits page](https://docs.composio.dev/reference/rate-limits.md).

- Rate limits, from the docs: Hobby 2,000 requests a minute for the whole organisation, Pro 10,000, Enterprise custom. Every call to Composio counts, including listing connections.
- The pricing page I could read shows the plans for Composio **For You** (free: up to 3 members, 10,000 tool calls a month, up to 10 linked accounts per app; Standard: $18 per seat a month; extra tool calls $0.005 each). **Debo uses the Platform product** (SDK sessions, `ak_…` project key), whose plan table I could not read from the page. Check Platform plan quotas and price in the dashboard under Billing before launch. Not verified.
- The docs say private custom MCP toolkits need Pro. Debo does not use them.
- Each tool call is one billed call. A single request can make a few Composio calls: a session create, a search, the hints lookup, the run. Debo caches tool hints for 10 minutes and the catalogue for 6 hours to keep this down.
- Each connected app also has its own quota (for example Slack). Managed sign-in shares one quota across all of Debo's people. If that bites, register Debo's own OAuth app for that app.

## Owner setup

1. In the [Composio dashboard](https://dashboard.composio.dev) open Platform, choose the project, and copy the project API key (`COMPOSIO_API_KEY`). Set it as a GitHub secret named `COMPOSIO_API_KEY`. It is optional: if the secret is empty the deploy still works and the feature says it is not set up.
2. No auth configs are needed for the 128 managed apps. For anything else, add an auth config with your own OAuth app, then expect the new app to appear as connectable only after Debo is changed to look for it. Today Debo lists only managed apps as connectable.
3. **Callback address.** Debo asks Composio to send people back to `https://api.debo.life/api/connectors/callback` (it is `PUBLIC_API_URL` plus that path). If the dashboard has a list of allowed redirect or callback URLs for the project, add that address.
4. For phones, the in-app browser returns to `debo://connectors`. The app scheme `debo` is already set in `app.json`. Adding `expo-web-browser` needs a new native build.
5. Optional: Composio's Firewall (blocks prompt injection in tool results) is a paid-plan feature and is not used; Debo's own wrapper and review flow do the work.
6. Privacy page: `apps/web/src/app/privacy/page.tsx` says what Composio holds. Keep it true if the setup changes.

## Trying it without Composio

In a sample workspace, `DEBO_SAMPLE_CONNECTORS=1` swaps in a practice copy with a few fake tools (Gmail, Slack, Notion, Todoist, GitHub). It never reaches a real app. A live workspace refuses this switch. Tests use the same fake: `tests/connectors.test.ts`.

The one live test (`COMPOSIO_LIVE=1`, needs `COMPOSIO_API_KEY`) lists the catalogue and makes a connect link for a random test user, completes no sign-in, then deletes the account it made. It never runs a tool.

## Known limits

- One account per app per person. Connecting a second Slack workspace is not supported yet.
- A change that times out after it may have reached the app is recorded as "outcome unknown", not retried.
- No triggers or background watching of connected apps yet.
- Tool schemas shown to the model are shortened to 14 arguments each.
