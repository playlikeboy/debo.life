# Writing rules

Every word a person reads in Debo follows these rules. So do the docs in this repo.

The goal: a person who is tired, busy and not technical understands the screen the first time.

## The rules

1. **Use short, common words.** "Use", not "utilise". "Start", not "initialise". "About", not "regarding".
2. **Keep sentences short.** Aim for under 20 words. One idea per sentence.
3. **Say the main thing first.** Then the detail, if it is needed.
4. **Talk to the person as "you".** Debo is "Debo" or "I" when it speaks in chat.
5. **Use active voice.** "Debo saved your note", not "Your note has been saved".
6. **No jargon.** If a technical word is needed, explain it in the same sentence.
7. **Be specific.** "Deleted for good in 30 days", not "Deleted soon".
8. **Be honest.** If Debo does not know, cannot do it, or it is not built yet, say so.
9. **One name per thing.** If it is a "memory" on one screen, it is a "memory" on all of them.
10. **Sentence case.** Capital letter at the start and for names only.

## Words we use

| Say | Not |
|---|---|
| memory | embedding, fact node, vector |
| source | citation, provenance, reference chunk |
| connect an app | integrate, authorise, OAuth |
| your own key | BYOK, API credential |
| forget | purge, hard delete |
| what Debo knows | knowledge graph, context |
| voice note | audio asset, recording file |
| sign in | log in, authenticate |
| plan | tier, subscription SKU |

## Buttons

A button says exactly what will happen.

| Good | Bad |
|---|---|
| Save entry | Submit |
| Forget this memory | Remove |
| Connect Google Calendar | Continue |
| Not now | Cancel |

The same action keeps the same name from button to confirmation: "Forget this memory" then "Memory forgotten".

## Errors

Say what happened, then what to do. No blame. No codes on their own.

- Good: "That file is too big. Try one under 25 MB."
- Bad: "Error 413: payload too large."
- Good: "I couldn't reach Google Calendar. Check your connection and try again."
- Bad: "Oops! Something went wrong."

## Empty screens

Tell the person the first thing to do.

- Good: "Nothing here yet. Write your first entry or record a voice note."
- Bad: "No data."

## Debo's voice

- Warm, calm, a little playful. Like a kind friend, not a cartoon.
- Never pretends to be human. Never claims feelings it does not have.
- Never guesses about a person's life. If there is no source, Debo says it does not know.
- Never pushes: no "Are you sure you want to miss out?".
- At most one emoji in a message, and none in errors or anything about money, privacy or deleting.

## Privacy and money text

This text gets the most care.

- Say plainly what is stored, where, and who can read it.
- Say plainly what something costs and when the person is charged.
- Never soften a risk. Never hide a limit.
- If a promise is not built yet, write "planned", not the promise.

## A quick test

Before shipping text, ask:

- Would my grandmother understand this?
- Is every claim true today?
- Can I cut a word? Then cut it.
