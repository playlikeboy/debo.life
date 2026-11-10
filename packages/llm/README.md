# @debo/llm

Status: answers work. Anthropic is tried first (`ANTHROPIC_API_KEY`, model `claude-haiku-5-5`); if that call fails, the Neon AI Gateway is tried. No usage rows or "your own key" yet.

The one place for model calls. See `docs/BYOK-AND-PLANS.md` and decision 16 in `docs/DECISIONS.md`.

## Public functions

| Function | What it does |
|---|---|
| `createLlm(env)` | Sets up the providers from the environment. Needs `ANTHROPIC_API_KEY` or the `NEON_AI_GATEWAY_*` values. |
| `llm.generate(prompt)` | One short text answer. |
| `llm.answerFromSources(question, pieces)` | Answers only from the person's own pieces, which are passed to the model as quoted data, never as instructions. Returns `{ found, answer, sourceIds, provider }`. Ids the model returns that were not in the pieces are dropped. If `found` is false or no ids are left, the app says "I don't have anything about that yet." |

Never log prompts, answers or the pieces: they hold a person's notes.

Read [`docs/MONOREPO.md`](../../docs/MONOREPO.md) before adding code here.
