# OpenFuse feature inventory

The native and web agent core runs locally. This inventory describes the current implementation and remaining extensions. Live providers and optional infrastructure require separate configuration and validation.

## Implemented coverage

| Area | Current implementation | Remaining extension |
| --- | --- | --- |
| Chat / delegated work | Native CopilotKit chat, direct mail and time-bounded primary calendar reads, durable tasks and confirmed outcomes | Live model/provider acceptance testing |
| Ideas / personal context | Source-backed mail/goal rules, accept/edit/dismiss, identity, editable/forgettable memories | Broader model-derived cross-connector suggestions |
| Goals / Tracking | Milestones, recurring watches, observations, retry/backoff, pause and cancellation | Adaptive long-term planning and calendar-driven reminders |
| Browser | Persistent Chromium, public page reads, snapshots, console takeover, PDF downloads | Autonomous interactive booking and per-person VM orchestration |
| Linux computer | Nonroot Docker container, bounded bash/Python/Node/git commands, saved output and exit receipts, persistent workspace files, text editing, PDF import/export | Interactive terminal, desktop apps, controlled egress, disk quotas and stronger VM isolation |
| Gmail / Calendar | Google OAuth; complete threads; saved drafts; calendar/event CRUD with reviewed versions | Live Google acceptance, recurrence editing, other connectors |
| PDF job | Durable import, typed input request, filled-copy preview, reviewed reply, receipt | OCR/scanned forms and additional PDF field types |
| Generated results | Plans/reports/comparisons, finance CSV metrics, and scripts in the private Linux workspace | Managed tool installation/versioning and image/audio generation |
| Debo journal / What Debo knows | Journal (write, find, edit, delete), questions answered only from the person's entries with source chips that open the entry, memories from hosted Mem0 each linked to its entry with fix and forget, activity record. Agent tools `search_my_journal`, `ask_my_life` (read) and `add_journal_entry` (prepares a review; saved only after approval). Uses the shared `@debo/brain`, `@debo/db`, `@debo/memory` packages; routes under `/api/debo`. The writing box keeps a draft on the device (browser storage, or a file on the phone), shows a word count and lets the person change the day; Ctrl or Command with Enter saves on the web | Live acceptance against a real Debo database |
| Journal recordings | Voice notes and videos: record in the browser or add a file, listen or watch before saving, upload straight to a private R2 bucket (in parts for big files), words written in the background by Workers AI Whisper with timed segments, language and a file fingerprint, searchable and cited like a written entry ("Voice note, 11 November"), "Try again" when the words fail, delete removes the file, "Download my data" lists each recording with a 24 hour download link. Speak: dictate into the text in short clips. Limits: 200 MB, 60 minutes, 4 hours and 40 recordings a day. See [JOURNAL-MEDIA.md](JOURNAL-MEDIA.md) | Run against real R2 and Workers AI; recording, dictation and an in-app player on the phone (needs a new native build); Hindi and mixed speech quality |
| Voice and role-play | Talk popup (microphone button in the chat box, or /talk): the same agent and tools as chat, calls saved as chats, risky actions only as on-screen reviews, a role Debo keeps until stopped (Apps screen, A role for Debo), a feeling in her voice | Not tried with a live call or a phone; voice minutes are not counted in usage |
| Notifications | Durable in-app inbox, source-linked change alerts, restart reconciliation | APNs/FCM/device push delivery |
| Connectors | Searchable capability/status catalogue, Google connection, browser worker, apps connected through Composio (reads run, changes wait for your yes; see [CONNECTORS.md](CONNECTORS.md)) | Plaid, health, Instagram, WhatsApp and partner APIs |
| OpenBot | Disabled adapter with pinned protocol/identity tests | Live session bridge, routines and computer backend wiring |

The Linux computer is disabled until configured on the server and has no network access. It is a single-owner container with a persistent `/workspace`, separate from the browser worker; see [computer setup and limits](COMPUTER.md). It is not a graphical desktop or a full OS VM.

Model chat can read the connected primary calendar for an explicit time range of up to 366 days. Missing dates or time zones need clarification. A reply uses at most 20 events and bounded event text; partial results and connection failures are reported. All-day dates keep their calendar time zone and exclusive end date. Calendar changes still require action review. The sample agent's canned replies do not provide this model tool.

The implementation and validation details are in [VERIFICATION.md](VERIFICATION.md). Planned extensions are not claims of current support. Priorities are tracked in the [roadmap](../ROADMAP.md).
