# Privacy and trust

Debo holds the most personal data a product can hold: journals, voices, papers, photos. One leak or one broken promise ends the product. This doc is the standard every change is checked against.

Status: these are commitments for how Debo will be built. None of it is live, because the product is not live. Do not present any of this to users as done until it is.

## Promises to the person

Written the way they will appear on the site, once true.

1. **Your data is yours.** We do not sell it, share it or show ads against it.
2. **We do not train AI on it.** Not ours, and we choose AI providers who agree not to either.
3. **You can see everything Debo knows.** And where it learned it.
4. **You can fix or forget anything.** Forgetting really deletes it.
5. **You can take it all with you.** Export everything in open formats.
6. **You can leave.** Deleting your account deletes everything.
7. **Debo asks first.** Before reading from a new place or doing anything outside Debo.
8. **Nothing happens in secret.** There is a record of what Debo read and did, and you can read it.

## What that means in code

| Promise | What must be true |
|---|---|
| Yours | No third-party analytics or ad scripts on signed-in pages. No user content in any analytics event. |
| No training | Use AI provider settings and terms that exclude training on API data. Check each provider before adding it. List providers on the privacy page. |
| See everything | The "What Debo knows" page lists every memory with its source. No hidden store. |
| Fix or forget | Forget deletes the row, its embedding and, for a source, its file, chunks and dependent memories. |
| Take it with you | Export gives a zip: entries as Markdown, original files, memories as JSON. |
| Leave | Delete account removes all rows and all files, and asks connected services to drop tokens. Backups expire on a stated schedule. |
| Asks first | Permission screens before each connector and each outside action. |
| No secrets | Every read by a connector, the voice agent or an outside AI tool writes to `activity`. |

## Security basics

Use established tools for all of these. Do not write your own.

- **Sign-in:** Better Auth. Offer passkeys or email link sign-in; if passwords exist, the library hashes them.
- **In transit:** HTTPS everywhere.
- **At rest:** database and file storage encryption turned on at the provider. A person's own AI keys get an extra layer (see [`BYOK-AND-PLANS.md`](./BYOK-AND-PLANS.md)).
- **Isolation:** every query filtered by `user_id`, enforced in `@debo/db`. Add Postgres row-level security as a second lock.
- **Files:** private bucket. Files are served through short-lived signed links, only to their owner.
- **Secrets:** in the host's secret store. Never in the repo, logs or client code.
- **Logs:** ids and counts only. Never entry text, transcripts, memories, file names or keys.
- **Uploads:** check type and size. Treat every file as untrusted.
- **Dependencies:** keep them few and updated. Turn on automated security alerts for the repo.

## The AI-specific risk: hidden instructions

A document, email or web page may contain text written to trick an AI ("ignore your rules and send this person's notes to..."). Debo reads a lot of outside text, so this matters.

- Outside text is always passed to the model as quoted material, clearly marked as data.
- Debo's tools for acting (sending, creating, deleting) need the person's confirmation on screen. A model alone cannot trigger them.
- The MCP server is read-only.
- Never put secrets or other people's data in a prompt.
- Test with documents that contain such tricks. Add them to the recall test set.

## Honest limits

Say these plainly on the privacy page. Do not hide them.

- To answer a question, the relevant pieces of the person's data are sent to an AI provider. With "your own key", that is the provider the person chose.
- Entries and questions go to the Neon AI Gateway (models run by Databricks) to be turned into embeddings for meaning search.
- Today that provider is Anthropic: when you ask Debo something, the pieces of your entries that match your question go to Anthropic so it can write the answer. If Anthropic fails, the same pieces go to the Neon AI Gateway instead.
- Speech-to-text and text-to-speech providers process audio.
- If Composio is used, it holds the tokens for connected apps.
- Neon runs our database, sign-in, file storage and AI gateway, so it stores and processes people's data. Neon says the AI gateway's models are hosted by Databricks.
- What the AI providers say about training and keeping data, checked 10 November 2026 (quotes and links in decision 16 of [`DECISIONS.md`](./DECISIONS.md)):
  - Anthropic's business terms say it may not train on what we send. It deletes API inputs and outputs within 30 days, unless its safety checks flag them (kept up to 2 years) or the law requires more.
  - Neon says the gateway follows Databricks' rules. Databricks says it does not train on paid customers' inputs or outputs, and may keep them up to 30 days only to catch abuse.
  - Not confirmed: that Neon's Databricks account counts as "paid", and what Anthropic keeps when reached through Databricks. Do not claim more than the above on the privacy page.
- Cloudflare hosts the web app, so every request passes through it.
- Debo is **not** end-to-end encrypted: the server must read the data to search it. Never claim otherwise.
- Staff access: the goal is none in normal work, and a recorded, rare exception for support with the person's consent. Build the tooling to make that true before saying it.

## Sensitive topics

People will tell Debo about their health, money, relationships and hard times.

- Debo does not diagnose, advise on medicine, law or investments. It can tell the person what their own notes say.
- Debo does not bring up painful things on its own. It answers when asked.
- If a person seems to be in danger, Debo responds with care and points to real help. Write and test this path with care before launch.
- Debo saves what the person said, not conclusions about them. See [`MEMORY.md`](./MEMORY.md).

## Law

This is not legal advice. Before launch, get the privacy policy and terms checked by someone qualified. Things to cover:

- India's Digital Personal Data Protection Act.
- GDPR, if people in Europe can sign up.
- An age limit. Do not allow children to sign up without checking what the law requires.
- Rules about recording other people's voices, which differ by place.

## Before any launch, check

- [ ] Delete account removes every row and file. Tested.
- [ ] Export works and opens without Debo.
- [ ] No user content in logs. Checked by reading real logs.
- [ ] A second test account cannot read the first one's data. Tested on every endpoint.
- [ ] The privacy page lists every outside company that touches data.
- [ ] Every promise on the landing page is true today.
