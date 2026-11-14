# Accounts: one login per person

This is how Debo's agent platform knows who is asking. Two modes exist. The choice is `AUTH_MODE`.

| Mode | Who it is for | Who owns the data |
|---|---|---|
| `access-key` (default) | A local or sample install | One owner, `local-user`, behind one shared key (`OPENFUSE_ACCESS_KEY` in live mode) |
| `neon` | A shared deployment with real people | One owner per Neon Auth user, named by the user's id |

Live mode with `NEON_AUTH_JWKS_URL` set must use `neon`. The server refuses to start with `AUTH_MODE=access-key` in that case.

## How a request is signed in (neon mode)

1. The app sends email and password to Neon Auth over HTTP (`/sign-in/email`, `/sign-up/email`, `/email-otp/verify-email`). The same code runs on web, iOS and Android.
2. Neon Auth answers with a session token in the `set-auth-token` header. The app keeps it in the Keychain or Keystore (`expo-secure-store`) on a phone, and in `localStorage` on the web.
3. The app calls `GET /get-session` with that token and reads a short-lived JWT from the `set-auth-jwt` header. If the header is missing it calls `GET /token`. The JWT lasts 15 minutes. The app swaps in a new one 90 seconds before it runs out.
4. The app sends the JWT to the Debo API as `Authorization: Bearer <jwt>`.
5. The API checks the JWT with `jose` against the public keys at `NEON_AUTH_JWKS_URL`: algorithm EdDSA only, issuer equal to the origin of `NEON_AUTH_BASE_URL`, audience equal to that origin when the token has one, expiry required. The `sub` claim must be a uuid. It becomes the owner of every row the request touches. Nothing is stored for the session on the API side, and no token is logged.

`POST /api/session` is closed in this mode. `GET /api/health` reports `auth: { mode, neonAuthUrl }` so the app picks the right sign-in screen.

Signed links for files and the browser console carry the owner and an HMAC over owner, path and expiry. They work per user and expire after 15 minutes.

## Settings

| Name | Meaning |
|---|---|
| `AUTH_MODE` | `neon` or `access-key`. Default: `neon` in live mode when `NEON_AUTH_JWKS_URL` is set, otherwise `access-key`. |
| `NEON_AUTH_BASE_URL` | The Neon Auth URL. Required for `neon`. Public. |
| `NEON_AUTH_JWKS_URL` | The key set URL. Defaults to `<base>/.well-known/jwks.json`. |
| `OS_DB_SCHEMA` | Postgres schema for the `records` table. Default `os` in `neon` mode. Created on start with `CREATE SCHEMA IF NOT EXISTS`. |
| `DATABASE_URL` | Debo's Neon Postgres. The table is `os.records`, so it never touches Debo's tables in `public` or Neon Auth's `neon_auth` schema. |
| `ALLOWED_ORIGINS` | Must list the web app's origin. Neon Auth's trusted origins must list it too, or the browser's sign-in call is refused. |

Live mode in `neon` mode does not need `OPENFUSE_ACCESS_KEY`. It still needs `TOKEN_ENCRYPTION_KEY`.

## Many people in one table

Every `Store` query filters by `owner`, with two deliberate exceptions that act on the whole table: `scan(kind)` (the task worker finds due work for all people and gets each owner back) and `recoverInterruptedActions()` (marks actions that were running when the server stopped). Nothing in the HTTP layer calls either. The `owner` is always taken from the verified token, never from the request body or query.

## Export and deletion

- `GET /api/account/export` returns every row the signed-in person owns as JSON. It leaves out `credentials` (encrypted Google tokens) and `sessions`.
- `DELETE /api/account` with body `{"confirm": true}` deletes every `os.records` row for that person and the PDF files stored for them on the API's disk. The app has "Download my data" and "Delete my data" on the Apps screen.

Deleting rows is not the whole job. These live elsewhere and need their own step:

1. **The login** in Neon Auth (`neon_auth.user`). The API cannot remove it. Remove it from Neon Auth, or from Debo's web account page once that exists.
2. **Google access.** The stored Google tokens are deleted with the rows, but the app stays listed in the person's Google account until they remove it there. Revoke the token at Google before the wipe if you want it gone at once.
3. **The Linux computer or E2B desktop** for that owner: its Docker volume or VM and the files in it. Stop it first, then remove the volume or VM by hand.
4. **Browser worker sessions** for that owner. They close on their own when idle.
5. **Rich Threads (CopilotKit Intelligence).** Chat threads live in that service, keyed by the user id. Delete them there.
6. **Backups and logs.** Neon's point-in-time history keeps old rows until it ages out. Logs carry ids only.
7. **Anything Debo's own app stores** for the same person in `public` tables. Those are a separate wipe.

## What is not verified yet

- The sign-in calls follow Better Auth's documented routes and the way `@neon/auth` 0.8 reads `set-auth-jwt`. They have not been run against Debo's live Neon Auth branch. Check that sign-in responses carry `set-auth-token` and that `get-session` carries `set-auth-jwt`.
- The `aud` claim is checked only when the token has one. Neon documents it as the auth URL's origin.
