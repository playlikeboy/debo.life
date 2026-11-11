# Product

## What Debo is

Debo is a friendly assistant that remembers your life.

You give Debo your journals, voice notes, papers and photos. Later you ask, "What did the doctor say in March?" or "When did I last talk to Riya?" Debo answers and shows where the answer came from.

The founder's phrase for it is "your life's MCP": one place that holds your context, which you and the AI tools you choose can use.

## Who it is for

People who want to remember their own life better and do not want to build a system for it. Not developers. Not teams.

The first users are likely to be people who already journal or record voice notes and feel they can never find anything again.

## What makes Debo different

1. **It shows its sources.** No answer about your life without a link to the original.
2. **You can see inside.** Every memory is visible, and you can fix it or forget it.
3. **It is kind.** A warm character, plain words, no pressure.
4. **It is yours.** Export everything. Delete everything. Use your own AI key if you like.

## Features

Status key: **Built**, **Next** (current phase), **Later**.

### Capture

| Feature | What the person gets | Status |
|---|---|---|
| Journal | Write an entry. Debo keeps it. Find, edit and delete entries. | Built (`/home/journal`) |
| Voice notes | Record or upload audio. Debo turns it into text and keeps both. | Next |
| Papers | Upload a PDF or document. Debo reads it. | Next |
| Photos | Upload a photo. Debo describes it and reads any text in it. | Next |
| Quick capture | Send a message to a bot (Telegram first) to save a thought. | Later |
| Share from phone | Share anything to Debo from another app. | Later |
| Browser button | Save a page or a selection. | Later |
| Bring your history | Import an export from another AI assistant so Debo starts with context. | Later |

### Ask

| Feature | What the person gets | Status |
|---|---|---|
| Ask my life | Ask a question in plain words. Get an answer with sources. | Built (home ask box and `/home/chat`) |
| Chat history | Come back to past chats, start a new one, delete one. | Built (`/home/chat`) |
| Rich answers | Debo answers with a timeline, a list or a card when that is clearer than text. | Later |
| Talk to Debo | Speak and hear Debo answer. | Later |
| On this day | What happened on this date in past years. | Later |
| Life timeline | Scroll through your life by date. | Later |
| People | Everyone you mention, and what you have said about them. | Later |

### Control

| Feature | What the person gets | Status |
|---|---|---|
| What Debo knows | A page listing every memory, with its source. | Built (`/home/memories`, no search yet) |
| Fix or forget | Correct a memory or remove it. | Built |
| Activity record | A list of everything Debo read and did. | Built (`/home/activity`) |
| Export | Download everything in open formats. | Built (entries, chats and activity record) |
| Delete account | Remove everything for good. | Next (built with sign-up) |

### Help without being asked

| Feature | What the person gets | Status |
|---|---|---|
| Daily note | A short morning summary: today's plans and things you asked to be reminded of. | Later |
| Weekly look back | What happened this week, in your own words. | Later |
| Gentle reminders | "You said you would call the bank." Only if switched on. | Later |

### Connect

| Feature | What the person gets | Status |
|---|---|---|
| Calendar | Debo knows your plans. | Later |
| Notes apps | Debo reads the notes you choose. | Later |
| Other AI tools | Let another AI assistant read your Debo memories, with your permission. | Later |

### Plans

| Feature | What the person gets | Status |
|---|---|---|
| Your own key | Use Debo free with your own AI key. | Later |
| Paid plan | Pay monthly and use our key, plus voice and connectors. | Later |

## Home and journal: how the signed-in pages fit together

Built 11 November 2026. The aim: a tired, non-technical person can write, find and trust their entries without being taught.

- **One navigation on every page.** Home, Journal, Chat, What Debo knows, What Debo did. The current page is filled in and marked for screen readers. It wraps on small phones. A "Skip to content" link comes first.
- **Home (`/home`) is the calm front door.** A greeting, the "Ask Debo" box (the one primary button), the three newest entries, one card per part of Debo, and the account section (Download everything, Sign out, Delete my account). With no entries yet, it says so and offers "Write your first entry".
- **Journal (`/home/journal`) is for writing and reading.**
  - A large writing box with a word count. Ctrl+Enter (Cmd+Enter on a Mac) saves. No title field: the first line becomes the title used in source chips.
  - The unsaved draft stays only in this browser until it is saved, so a closed tab does not lose words. Saving, "Clear this draft", signing out and deleting the account remove it.
  - When the box is empty, four gentle questions ("What happened today?") help a person start. Picking one shows it above the box; it is not saved into the entry.
  - Entries are grouped by month, newest first, each headed by its full date (UTC, the same as source chips).
  - "Find an entry" shows only the person's entries that contain those words.
  - Edit in place ("Edit this entry", "Save changes", "Keep as it was") and delete with a confirm step ("Delete this entry", "Yes, delete it", "Keep it").
  - Every entry has the anchor `entry-<id>`. Source chips link to `/home/journal#entry-<id>` (`entryHref` in `apps/web/src/lib/links.ts`). Arriving from a chip draws a thick border, shows "The entry you opened" and moves focus there.
- The page shows the newest 500 entries; older ones are reached with "Find an entry".

## Chat with Debo: how it should feel

Built 11 November 2026 at `/home/chat`. The aim: asking Debo feels like asking a calm friend who checks their notes, and the person can always see where an answer came from.

- **Start easy.** A new chat shows Debo and four questions to try ("What plans have I made?"). One press asks it. With an empty journal, it says Debo answers from the journal and offers "Write your first entry" instead.
- **See Debo working.** "Looking through your entries…" shows until the first words arrive. Then the answer appears word by word, in the answer card.
- **Sources first, always.** Debo only starts writing once it knows which entries it is using. Every answer ends with "From your entries:" and mint chips ("Journal, 14 March") that open the entry. If an entry was deleted later, the card says so.
- **Stop any time.** While Debo answers, "Ask Debo" becomes "Stop answering". What was shown stays, with its chips, marked "You stopped this answer here."
- **Every dead end has a next step.** Nothing found: a link to write an entry. Daily limit: when it resets, in the person's own time. No connection: "Try again".
- **Typing.** The question box has a visible label and grows with the text. Enter asks; Shift and Enter makes a new line. Near 500 characters it counts down.
- **Reading.** The page follows new words only while the person is at the bottom. If they scroll up, it stays put and offers "Jump to the newest message". "Copy answer" sits under every finished answer.
- **Coming back.** Every exchange is saved. A reload brings the chat back. "Your chats" lists past chats (below the chat on phones, beside it on wide screens), each with "Delete this chat" and a clear yes. "Start a new chat" clears the screen.
- **Screen readers and keyboards.** A polite status says when Debo starts, reads the whole answer once it is finished (not word by word), and confirms copy, stop and delete. Focus goes back to the question box after asking, stopping and starting a new chat. Everything works with a keyboard; touch targets are at least 44px.
- Not built yet: follow-up questions that use earlier messages in the chat (each question is answered on its own), renaming chats, searching chats.

## What Debo will not do

- Sell, share or advertise against your data.
- Train AI models on your data.
- Guess facts about your life.
- Give medical, legal or financial advice. Debo can tell you what your own notes say.
- Act outside Debo (send, post, pay) without asking first.
- Pretend to be a person.

## How we will know it works

- A new person saves three things and gets one useful answer in their first ten minutes.
- People press source chips. That means they check, and trust grows.
- People come back in week two without a reminder.

These are goals, not results. There are no users yet.
