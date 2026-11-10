# Memory

Status: mostly plan. Built so far: meaning and keyword search over journal entries, merged (steps 1 to 3), and answers only from those pieces, with source ids, or "I don't have anything about that yet" (steps 4 to 6). Mem0 is built in `@debo/memory` but not used by the web app yet (decision 18). This is the heart of Debo. If recall is poor, nothing else matters.

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

Built: `@debo/recall` (see its README). 21 made-up journal entries for one made-up person, and 26 questions with the entries that must be found: 9 keyword questions, 12 paraphrases only meaning search can find, and 5 questions the journal cannot answer. It tests search only (`searchPieces`), not the answer model, so it is cheap.

Run it before each release and after any change to search, chunking or embeddings. Never against production; the script refuses.

```bash
export RECALL_DATABASE_URL="$(neon connection-string dev-ai --project-id sweet-dream-71477162)"
pnpm --filter @debo/recall recall
```

It fails (exit 1) if recall@6 drops below 90% or more than one "not in the journal" question is matched by meaning search.

First run, 2026-11-10, on a local Postgres 17 with pgvector 0.8.7 (same migrations, same search code, real `qwen3-embedding-0-6b` embeddings through the gateway; the `dev-ai` branch could not be reached because the Neon CLI was not signed in on that machine):

| | recall@1 | recall@3 | recall@6 |
|---|---|---|---|
| Keyword only, all 21 answerable | 33% | 43% | 43% |
| Keyword + meaning, all 21 answerable | 67% | 90% | 90% |
| Keyword + meaning, 9 keyword questions | 89% | 100% | 100% |
| Keyword + meaning, 12 paraphrases | 50% | 83% | 83% |

What it showed:

- Meaning search is doing real work: paraphrases go from 0 of 12 found to 10 of 12.
- Missed: "What present did I get my sister?" (the entry names Noor, never "sister") and "Do I do any charity work?" (food bank volunteering, nothing within the 0.60 cut-off).
- "Not in the journal": 2 of 5 found something. "How much did the wedding cost?" matched the boiler entry by the word "cost" (keyword search; the model should then say it does not know). "What did I plant in the vegetable patch?" matched the dog entry by meaning, inside the 0.60 cut-off, so the cut-off is loose for some pairs.

Still to do: run it on `dev-ai` and record those numbers here; add voice transcripts and papers once uploads exist; grow toward 50 questions; score the answers too (did the answer match, was the right source shown, did Debo say it did not know). Track three numbers:

- Did the answer match?
- Was the right source shown?
- When there was no answer, did Debo say so?

Use made-up data only. Never real user data in tests.

## The "What Debo knows" page

Lists memories, newest first, with search. Each one shows the sentence, the source chip, and "Fix this" and "Forget this". This page is how people come to trust Debo. Build it in phase 2, not as an afterthought.
