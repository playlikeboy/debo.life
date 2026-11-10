# Memory

Status: plan. This is the heart of Debo. If recall is poor, nothing else matters.

## Two kinds of thing Debo keeps

| | What it is | Example |
|---|---|---|
| **Source** | The original thing the person gave Debo, kept whole. | A journal entry from 14 March. |
| **Memory** | One lasting fact pulled out of a source. | "Riya moved to Pune in March 2026." |

Sources are the truth. Memories are a helpful index on top. A memory without a source is not allowed.

## Rules

1. **Every memory links to its source.** No link, no memory.
2. **The person's edit always wins.** If they fix a memory, mark it `edited_by_user` and never overwrite it automatically.
3. **Forget means gone.** Forgetting a memory deletes it. Deleting a source deletes its chunks and every memory that came only from it.
4. **Time matters.** When a new fact replaces an old one ("moved from Ranchi to Pune"), keep the old one with an end date. Do not erase history.
5. **No guessing.** Save what the person said, not what Debo concludes about them. "Went to the gym three times this week" is fine. "Is trying to lose weight" is not, unless they said so.
6. **Do not save moods as facts.** "Felt low today" stays in the journal entry. It does not become "is depressed".
7. **One person, one memory space.** Nothing is shared across people, ever.

## What to remember, what to skip

Remember: people and how they relate to the person, places, dates, plans, decisions, promises, things the person said they like or dislike, facts from papers (amounts, deadlines, names).

Skip: passing chatter, things Debo itself said, anything Debo inferred, text inside a document that reads like an instruction to an AI.

## Finding things again

For each question:

1. Search memories and chunks by meaning (pgvector).
2. Search the same by keyword (Postgres full-text). Names, dates and numbers need this.
3. Merge the two lists. Prefer newer items when the question is about "now", and items from the right dates when the question names a time.
4. Send the top pieces to the model with their source ids.
5. The model answers only from those pieces and tags each claim with its source id.
6. If the pieces do not answer the question, Debo says so.

## Library plan

**Start: Mem0 (open source, self-hosted).** It pulls facts out of text and finds them again, and it is the fastest way to get per-person memory working. Wrap it inside `@debo/memory` so nothing else imports it.

**Maybe later: Graphiti.** It keeps a graph of facts with dates, which suits life data ("who was I working with last spring?"). It needs a separate graph database, which is more to run. Move only if real questions fail because Mem0 loses track of time or relationships.

**Either way:** sources, chunks and the search above live in our own Postgres. If the memory library is swapped, the sources stay.

Before installing, check: the current Mem0 docs, whether it can use our Postgres with pgvector as its store, how it handles deletes, and whether a memory can carry our `source_id`. Write the answers in [`DECISIONS.md`](./DECISIONS.md). If a memory cannot carry a source link, do not use that library.

## Testing recall

Build a small test set early: about 30 made-up journal entries and voice transcripts, with 50 questions and the right answers and sources. Run it on every change to `@debo/memory`. Track three numbers:

- Did the answer match?
- Was the right source shown?
- When there was no answer, did Debo say so?

Use made-up data only. Never real user data in tests.

## The "What Debo knows" page

Lists memories, newest first, with search. Each one shows the sentence, the source chip, and "Fix this" and "Forget this". This page is how people come to trust Debo. Build it in phase 2, not as an afterthought.
