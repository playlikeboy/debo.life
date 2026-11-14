# Journal recordings: voice notes, videos and speaking

Status: built and run end to end in sample mode with a fake bucket and a fake speech engine (14 November 2026). **Not yet run against real R2 or real Workers AI.** See "Not checked yet" at the end.

This is what the Journal screen does beyond typing, how it is stored, what it costs, and what the owner must set up before it works.

## What a person can do

- **Write.** One calm box that grows as you write. The draft is kept on the device (browser storage on the web, a small file on the phone) and comes back after a restart. A quiet "Saved on this device" line, a word count, a day you can change ("When did this happen?"), and Ctrl or Command with Enter to save on the web.
- **Speak.** Dictate into the text. A "Listening" box with a Stop button shows the whole time the microphone is on.
- **Record.** A voice note, or a video where the browser can record one. Listen or watch before saving. Progress is shown while it uploads.
- **Add a recording.** Pick an audio or video file you already have. Same review step.

Limits, stated on screen and enforced on the server: **200 MB and 60 minutes per recording; 40 recordings and 4 hours a day** (the day changes at midnight UTC). Allowed types: m4a, mp4, mp3, wav, webm, ogg, aac, flac, 3gp, mov (`apps/server/src/debo/media-limits.ts`).

## Choices, and why

### Writing surface: a plain text box

Chosen: React Native's `TextInput`, multiline, growing with its content, with type size and spacing from the design tokens.
Why: the rich-text editors that work on both web and phone either need a custom native build (for example `react-native-enriched`) or run inside a web view (Lexical, TenTap). A web view is fragile for typing on a phone, and a custom native build is a heavy step for light bold and bullets. A plain box is the same everywhere and never loses a word. Light formatting can come later if it proves its worth.

### Speaking: short clips to Debo's own endpoint

Chosen: record clips of about 8 seconds with the browser's `MediaRecorder`, send each to `POST /api/debo/transcribe`, put the words in the text at the cursor.
Why not the browser's built-in speech recognition: it differs by browser (Chrome sends audio to Google, Safari to Apple, Firefox has none), and it handles Hindi and mixed speech unevenly. One path through Debo's endpoint behaves the same on every browser, uses the same company as recordings (Cloudflare), and the privacy page can say so in one place.
Cost of this choice: words appear a few seconds after you speak, not as you speak, and there is a gap of a few milliseconds between clips.
Limits: 30 clips a minute and 600 a day per person (about 100 minutes), in server memory, so a restart resets them. Dictation does not count against the daily AI token limit, because it uses a different service with its own cost. Clips are not stored.
On the phone: not built. Use the microphone on the keyboard to dictate. In-app dictation needs a native audio module (below).

### Upload route: straight to R2 with short-lived links

Chosen: the app asks the API for upload links, sends the file straight to a private R2 bucket, then tells the API it is done. Big files (over 32 MB) go up in 16 MB parts; each part is retried up to three times.
Why: the API runs in a small container (1/4 vCPU, 1 GiB) and the request limit on the API is 12 MB. Passing 200 MB through it would be slow and could run it out of memory. R2 accepts presigned links over its S3 address ([docs](https://developers.cloudflare.com/r2/api/s3/presigned-urls/)), so the API only signs links and never touches the bytes. The alternative, a private Worker with an R2 binding behind `outboundByHost`, would still carry every byte through the container's network path.
How it stays private:
- The bucket has no public address and no custom domain.
- Object names are made on the server: `<owner id>/<random id>.<ext>`. The app never names a file.
- Every call looks the recording up by owner first. Someone else's id gets "I couldn't find that recording".
- Upload links last 2 hours and are signed for the exact size, so they take only that many bytes. After upload the server checks the real size with a HEAD request and deletes the file if it is wrong or over the limit.
- Playback links last 1 hour and are made only for the owner.
Signing uses [`aws4fetch`](https://github.com/mhart/aws4fetch) (about 3 KB, no AWS SDK).

### Transcription: Cloudflare Workers AI Whisper

Chosen: `@cf/openai/whisper-large-v3-turbo` over the REST API ([model page](https://developers.cloudflare.com/workers-ai/models/whisper-large-v3-turbo/)). It takes base64 audio and returns text, segments with start and end times, and the detected language.
Why: the account is already on Cloudflare, so no new company hears the audio, and the price is low (below). The model detects the language, so English, Hindi and a mix work as well as Whisper allows. Voice-activity filtering is on, so silence does not turn into invented words. Hindi comes back in Devanagari script.
Behind a small interface (`Transcriber` in `transcriber.ts`) with a fake for tests: another engine (Deepgram and others) can replace it by writing one function.
Long audio: the model page gives no file size or length limit, so we do not rely on one. ffmpeg first turns the file into a small mono 16 kHz mp3 (for video, only the sound is kept: `-vn`). The mp3 is cut into 5 minute pieces that overlap by 4 seconds. Each piece is written out (two at a time) and the pieces are joined at the middle of each overlap, so no words repeat or drop. Segment times are kept in the database. Paragraph breaks go at pauses of 2 seconds or more.
The same file added twice is written out once (a SHA-256 of the file is kept, per person).

## How a recording is saved

1. `POST /api/debo/media/uploads` checks type, size, length and the daily limit, makes the object name, and returns upload links. A `media` row is made with `upload_state = uploading`. No entry exists yet.
2. The app sends the file to R2.
3. `POST /api/debo/media/uploads/:id/complete` (with the part tags for a multipart upload) joins the parts, checks the size, and in one step creates the entry (a row in `sources`, kind `voice` or `video`) and sets the transcript to `waiting`. The save never waits for the words.
4. In the background the server downloads a temporary copy, makes the transcript, and saves it: the media row, the entry's text and its pieces for search, in one transaction. Then the entry is made searchable by meaning and sent to memory, the same as a written entry. The temporary copy is deleted.
5. If it fails, the transcript is `failed` with a short reason. The entry stays and can be played. "Try again" (`POST /api/debo/entries/:id/transcript/retry`) puts it back in the queue.
6. If the server stops mid-way, a sweep every 5 minutes picks up `waiting` jobs and jobs stuck `working` for over 10 minutes (at most 4 tries), and clears uploads nobody finished after a day. The existing 5 minute cron already wakes the container.

Transcript states: `waiting`, `working`, `ready`, `failed`. A recording with no speech is `ready` with empty text; the card says "I didn't hear any words in this recording."

## Data model

One new table, `media` (migration `0005_journal_media.sql`). The words stay in `sources.text`, so search, answers with sources, memories, export and delete need no change. `sources.kind` is a plain text column: `voice` and `video` need no migration.

| Column | What |
|---|---|
| `id`, `user_id`, `source_id` | the recording, its owner (cascade delete), its entry (cascade delete; empty until the upload finishes) |
| `kind` | `voice` or `video` |
| `object_key`, `mime_type`, `size_bytes` | where the file is, what it is, how big |
| `duration_ms`, `recorded_at` | length and when it was recorded |
| `device` (jsonb) | only `origin` (recorded or picked), the file name and the file's last-changed time. Never location |
| `upload_state`, `upload_id` | `uploading` or `stored`; the open multipart upload |
| `transcript_status`, `transcript_error`, `transcript_attempts`, `transcript_started_at` | the queue state |
| `language`, `segments` (jsonb) | detected language; `[{start, end, text}]` |
| `content_hash` | SHA-256 of the file |

**What the migration does when CI applies it** (`deploy.yml` runs `pnpm --filter @debo/db db:migrate` on every push to main): one `CREATE TABLE "media"`, two `ALTER TABLE "media" ADD CONSTRAINT … FOREIGN KEY` (to the Neon Auth user and to `sources`), and four `CREATE INDEX` on `media`. It does not touch `sources`, `chunks` or any existing table, drops nothing, and rewrites no row. `tests/journal-media.test.ts` fails if a later migration adds a `DROP`. The web app and the new app both keep working on the old schema until it runs; the recording routes need the table.

## Routes (all under `/api/debo`, owner only, input checked with Zod)

| Route | What |
|---|---|
| `GET /status` | now also `recordings`, `speaking` and the limits |
| `POST /media/uploads` | start an upload; returns links |
| `POST /media/uploads/:id/complete` | finish; saves the entry |
| `GET /entries/:id/playback` | a one-hour link to play the recording |
| `GET /entries/:id/transcript` | status, words, language, timed segments |
| `POST /entries/:id/transcript/retry` | try the words again |
| `POST /transcribe` | dictation: one short clip in, words out. Not stored. Max 3 MB |
| `DELETE /entries/:id` | existing; deletes the file first, then the entry |

Transcript text, file names and audio are never logged. Logs carry ids, counts and error names only.

## Delete and export

- Deleting an entry deletes its R2 object first. If that fails the entry stays, so nothing is left behind unseen.
- "Delete my data" deletes every recording, including unfinished uploads, and everything else under the person's folder in the bucket.
- "Download my data" includes, for each recording: its details, the transcript, the timed segments, and a link that downloads the file, valid for 24 hours. The file itself is not inside the JSON.

## Costs

Prices checked on 14 November 2026. They change: check the pages.

| Item | Price | Source |
|---|---|---|
| Writing out speech (Whisper large v3 turbo) | $0.000513 per audio minute | [model page](https://developers.cloudflare.com/workers-ai/models/whisper-large-v3-turbo/) |
| R2 storage | $0.015 per GB-month (first 10 GB-month free) | [R2 pricing](https://developers.cloudflare.com/r2/pricing/) |
| R2 writes (Class A) | $4.50 per million (first million a month free) | same |
| R2 reads (Class B) | $0.36 per million (first 10 million free) | same |
| R2 download to the internet | free | same |

Examples: one hour of speech costs about $0.03 to write out. A person at the daily cap (4 hours) costs at most about $0.12 a day. A 1-hour voice note is roughly 15 MB as webm or 60 MB as m4a, so 100 hours of notes is a few GB, under $0.10 a month after the free 10 GB. An upload costs a handful of write operations (one, plus one per 16 MB part). Dictation costs the same per minute as recordings. The API container's CPU for ffmpeg is on top and has not been measured.

## Owner setup (nothing here has been done)

1. **Bucket.** `npx wrangler r2 bucket create debo-journal-media` (add `--location apac` to keep it near India; check `npx wrangler r2 bucket create --help` for the flag). Do not enable public access or a custom domain.
2. **CORS** on the bucket, so the browser at `https://my.debo.life` may upload and play. Dashboard: R2, the bucket, Settings, CORS Policy, Add CORS policy, JSON tab:
   ```json
   [
     {
       "AllowedOrigins": ["https://my.debo.life"],
       "AllowedMethods": ["GET", "HEAD", "PUT"],
       "AllowedHeaders": ["Content-Type", "Content-Length"],
       "ExposeHeaders": ["ETag"],
       "MaxAgeSeconds": 3600
     }
   ]
   ```
   `ExposeHeaders: ETag` is required: without it a big upload cannot be joined. The same policy can be set with `npx wrangler r2 bucket cors set debo-journal-media --file cors.json`; wrangler's file uses its own shape (see the [docs](https://developers.cloudflare.com/r2/buckets/cors/)), so the dashboard is the safer route. Add `http://localhost:8081` only on a dev bucket.
3. **R2 API token.** Dashboard, R2, Overview, Account Details, API Tokens, Manage, Create Account API token, permission **Object Read & Write**, scoped to `debo-journal-media` only. Copy the Access Key ID and Secret Access Key (the secret shows once).
4. **Workers AI token.** Dashboard, My Profile, API Tokens, Create Token, the **Workers AI** template. It needs permission to run models. Copy the token.
5. **GitHub secrets** (names only here; set the values yourself, never in a file):
   ```sh
   gh secret set R2_ACCESS_KEY_ID
   gh secret set R2_SECRET_ACCESS_KEY
   gh secret set CF_AI_API_TOKEN
   ```
   `CLOUDFLARE_ACCOUNT_ID` already exists and is used as the R2 account. The bucket name is a plain setting (`R2_BUCKET` in `api/wrangler.jsonc`).
6. **Deploy.** Push to main. `deploy.yml` applies the migration; `deploy-os.yml` builds the API image (now with ffmpeg, about 100 MB larger), passes the secrets into the container, and deploys. Without the three secrets the Journal still works as text only: no Speak, Record or Add buttons appear.
7. **Check by hand** (see "Not checked yet"): add a short voice note at https://my.debo.life, see the words appear, play it, delete it, and look in the bucket to see the object is gone.
8. Optional: an R2 lifecycle rule to abort incomplete multipart uploads sooner than R2's default of 7 days. The server already clears its own unfinished uploads after a day.

## Phone (iOS and Android)

Built: pick a voice or video file (`expo-document-picker`), upload it (single link with `expo-file-system`'s upload task; parts by reading bytes with `File.open()`), the draft kept in a file, the day as a typed date. "Play" opens the signed link in the phone's player.
Not built: recording inside the app, dictation, and an in-app player. To add them:
1. `npx expo install expo-audio` (recording and playback) and `expo-camera` (video). Add their config plugins to `app.json` with microphone and camera permission texts in plain words.
2. Make a new development build (`expo run:ios`, `expo run:android`, or EAS Build). `expo-audio` does not work in the old `expo-av` way, and neither runs in a plain web view.
3. Fill in `debo-capture.native.ts` (`recordingSupport`, `startRecording`, `startDictation`) and `debo-player.native.tsx`. The screens already call them.
None of the phone code has been run on a device.

## Not checked yet

- Real R2: that presigned PUT links with a signed `Content-Length` and `Content-Type` are accepted, that presigned multipart `UploadPart` links work (R2's S3 page lists the operations but does not mention presigned part links), and that CORS and the exposed ETag work from `my.debo.life`. The code, the link shapes and the joining are tested with fakes only. If R2 refuses a signed `Content-Length`, remove it from `beginUpload` in `object-store.ts`; the server's size check after upload still protects the bucket.
- Real Workers AI: the request shape follows the published schema; no call was made. Request size limits for the REST API are not published; 5 minute mp3 pieces are about 1.2 MB.
- ffmpeg inside the container (the Docker image was not built here), and CPU time for an hour of audio on the small instance.
- Whisper quality on Hindi and mixed speech.
- iOS Safari recording (it records `audio/mp4`; not run), and Firefox.
- Phone code (above).
