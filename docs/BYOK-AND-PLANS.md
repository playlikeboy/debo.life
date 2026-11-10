# Your own key, plans and billing

Status: plan, phase 5. Prices here are ideas, not decisions.

## Two ways to use Debo

| | Your own key | Paid plan |
|---|---|---|
| Who pays the AI company | The person, directly | Debo |
| What the person does | Pastes a key from an AI provider | Pays monthly |
| Plain name in the app | "Use your own key" | "Debo Plus" (working name) |

"BYOK" is a developer word. In the app, always say "your own key".

## Plan sketch

| | Free | Plus |
|---|---|---|
| Price | Free | Not decided. The earlier idea was about $15 a month. |
| AI | Your own key | Ours, with a fair monthly limit |
| Journal, uploads, ask | Yes | Yes |
| Storage | Small limit | Larger limit |
| Voice | No | Yes, with a monthly minute limit |
| Connected apps | One | Several |
| See, fix, forget, export, delete | Yes | Yes |

Control over your own data is never a paid feature.

Before setting prices, measure real cost per person: tokens for ingestion and chat, embedding cost, voice minutes, storage. Voice will be the biggest cost. Set limits from real numbers.

## One door for all model calls: `@debo/llm`

Every model call in the codebase goes through this package. It:

1. Looks up the person's plan.
2. Chooses the key: theirs if they are on their own key, ours if they are on a paid plan and under their limit.
3. Makes the call.
4. Writes a `usage` row (who, what kind, how many units, whose key). Never the content.
5. Returns a clear, plain error if the key is wrong, out of credit or over a limit.

Exception today: Mem0 (memories, decision 20) runs its own model calls on its own servers. They do not go through `@debo/llm`, do not write `usage` rows and do not count toward the daily limit. They cost us on the Mem0 bill.

For routing to different AI providers behind one interface, use an existing gateway library or service rather than writing provider code by hand. Candidates: LiteLLM (self-hosted proxy), OpenRouter (hosted), or the provider layer of the Vercel AI SDK. Pick one in phase 1, check its current docs, and record it in [`DECISIONS.md`](./DECISIONS.md).

## Handling a person's own key

A person's AI key is as sensitive as a password.

- Encrypt it before saving, using a well-known library and an encryption key that lives outside the database (`BYOK_ENCRYPTION_KEY`, later a managed key service). Do not invent the encryption.
- Decrypt only on the server, only at the moment of a call.
- Never send it to the browser after it is saved. Show only the last four characters.
- Never log it. Scrub it from error messages.
- Test it once when added, with a tiny call, and say plainly if it does not work.
- Deleting it removes it for good.

Tell the person plainly: "Your key is stored encrypted. Debo uses it only to answer you. You can remove it any time."

What the key cannot cover: some features need a specific kind of model (embeddings, speech). Say clearly which features work with which provider's key, and do not silently fall back to our key and charge for it.

## Limits

- Count usage per person per month from the `usage` table.
- Warn at 80%. At 100%, stop the costly feature and say what to do next. Never cut off access to the person's own data.
- Put a hard daily cap on our key per person to stop runaway cost from bugs or abuse.

## Payments

The founder is based in India, and not every payment company accepts new Indian businesses for international subscriptions. Check current options before building:

- A "merchant of record" (they sell on our behalf and handle tax): for example Paddle, Polar, Dodo Payments.
- Razorpay for payments in India.
- Stripe, if available to the business at that time.

Rules whichever is chosen:

- Use their hosted checkout. Debo never sees or stores card numbers.
- Trust only verified webhooks to change a person's plan.
- Cancelling takes one click and keeps access until the paid period ends.
- Show the price, the renewal date and how to cancel before the person pays.
