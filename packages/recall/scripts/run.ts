// Run the recall test set against a NON-production database.
//
//   RECALL_DATABASE_URL="$(neon connection-string dev-ai --project-id <id>)" \
//     pnpm --filter @debo/recall recall
//
// What it does:
// 1. Refuses to run unless RECALL_DATABASE_URL is set and is not the
//    production database (DATABASE_URL / DATABASE_URL_UNPOOLED in .env).
// 2. Makes a throwaway user in neon_auth."user".
// 3. Saves the made-up entries with createEntry and embeds them with
//    indexSource, the same functions the app uses.
// 4. Asks every question with searchPieces, the search the ask pipeline
//    uses. Retrieval only: the answer model is never called.
// 5. Prints recall@k (keyword only, and keyword + meaning), the misses, and
//    "not in the journal" questions that still found something.
// 6. Deletes the throwaway user with deleteAccount (everything cascades),
//    even when a step above fails.
//
// Exits 1 if the scores fall below the thresholds below, 2 if meaning search
// could not run (keyword-only numbers are still printed, labelled as such).
// Never prints a connection string, a key or any database row.
import { randomUUID } from "node:crypto";
import { createEntry, deleteAccount, searchPieces, withDb } from "@debo/db";
import { indexSource } from "@debo/ingest";
import { createLlm } from "@debo/llm";
import { sql } from "drizzle-orm";
import { entries, questions, score, type QuestionResult, type Report } from "../src/index";

/** Set from the first real run (see docs/MEMORY.md, "Testing recall"). */
const MIN_RECALL_AT_6 = 0.9;
/**
 * "Not in the journal" questions that meaning search still matched within
 * the cosine cut-off. Keyword matches on a shared word ("cost") are not
 * counted: the answer model is there to say no to those.
 */
const MAX_MEANING_FALSE_HITS = 1;
const KS = [1, 3, 6];

try {
  process.loadEnvFile("../../.env");
} catch {
  // In CI the values come from the environment.
}

const url = requireSafeUrl();
const env = process.env;
const userId = randomUUID();
let exitCode = 0;

try {
  await withDb(url, (db) =>
    db.execute(
      sql`insert into neon_auth."user" (id, name, email, "emailVerified", "createdAt", "updatedAt")
          values (${userId}, 'Recall test', ${`recall-${userId}@example.com`}, false, now(), now())`,
    ),
  );
  console.log(`throwaway user ${userId} created`);

  const keyBySource = new Map<string, string>();
  let meaningReady = true;
  for (const entry of entries) {
    const saved = await createEntry(url, userId, { text: entry.text });
    keyBySource.set(saved.id, entry.key);
    if (!meaningReady) continue;
    try {
      await indexSource(url, env, userId, saved.id);
    } catch (error) {
      meaningReady = false;
      console.error(`embedding failed (${error instanceof Error ? error.message : "unknown"}); meaning search is off`);
    }
  }
  console.log(`${entries.length} entries saved${meaningReady ? " and embedded" : ""}`);

  let embeddings: number[][] | undefined;
  if (meaningReady) {
    try {
      embeddings = (await createLlm(env).embed(questions.map((q) => q.question))).vectors;
    } catch (error) {
      console.error(`question embedding failed (${error instanceof Error ? error.message : "unknown"})`);
    }
  }

  const ask = async (withMeaning: boolean): Promise<QuestionResult[]> =>
    Promise.all(
      questions.map(async (question, i) => {
        const pieces = await searchPieces(url, userId, question.question, {
          embedding: withMeaning ? embeddings?.[i] : undefined,
        });
        const foundKeys = [...new Set(pieces.map((p) => keyBySource.get(p.sourceId) ?? "?"))];
        return { question, foundKeys };
      }),
    );

  const keywordOnly = score(await ask(false), KS);
  printReport("Keyword search only", keywordOnly);

  if (!embeddings) {
    console.log("\nMeaning search did not run, so only keyword numbers are shown above.");
    exitCode = 2;
  } else {
    const hybrid = score(await ask(true), KS);
    printReport("Keyword + meaning (what the app uses)", hybrid);
    // A false hit is a meaning hit if keyword search alone did not find it.
    const keywordFound = new Map(keywordOnly.falseHits.map((r) => [r.question.question, new Set(r.foundKeys)]));
    const meaningFalseHits = hybrid.falseHits.filter((r) =>
      r.foundKeys.some((key) => !keywordFound.get(r.question.question)?.has(key)),
    );
    console.log(`"not in the journal" questions matched by meaning within the cut-off: ${meaningFalseHits.length}`);
    const recall = hybrid.recallAt[6] ?? 0;
    if (recall < MIN_RECALL_AT_6 || meaningFalseHits.length > MAX_MEANING_FALSE_HITS) {
      console.log(
        `\nFAILED: recall@6 ${pct(recall)} (need ${pct(MIN_RECALL_AT_6)}), ` +
          `meaning false hits ${meaningFalseHits.length} (allowed ${MAX_MEANING_FALSE_HITS})`,
      );
      exitCode = 1;
    } else {
      console.log("\nPASSED");
    }
  }
} catch (error) {
  console.error(`recall run failed: ${error instanceof Error ? error.message : "unknown error"}`);
  exitCode = 1;
} finally {
  try {
    const deleted = await deleteAccount(url, userId);
    console.log(deleted ? "throwaway user deleted" : "throwaway user was not found (nothing to delete)");
  } catch {
    console.error(`could not delete throwaway user ${userId}; delete it by hand`);
    exitCode = 1;
  }
}
process.exit(exitCode);

function requireSafeUrl(): string {
  const target = process.env.RECALL_DATABASE_URL;
  if (!target) {
    throw new Error("Set RECALL_DATABASE_URL to a non-production branch (for example dev-ai).");
  }
  const production = [process.env.DATABASE_URL, process.env.DATABASE_URL_UNPOOLED].filter(
    (value): value is string => Boolean(value),
  );
  if (production.length === 0) {
    throw new Error("Cannot check the target: DATABASE_URL is not set, so production is unknown. Refusing to run.");
  }
  const targetHost = endpointOf(target);
  for (const prod of production) {
    if (prod === target || endpointOf(prod) === targetHost) {
      throw new Error("RECALL_DATABASE_URL points at the production database. Refusing to run.");
    }
  }
  return target;
}

/** The Neon endpoint behind a connection string, the same for pooled and direct. */
function endpointOf(connectionString: string): string {
  try {
    return new URL(connectionString).hostname.replace("-pooler.", ".");
  } catch {
    throw new Error("A database connection string could not be read.");
  }
}

function pct(n: number) {
  return `${Math.floor(n * 1000) / 10}%`;
}

function printReport(label: string, report: Report) {
  console.log(`\n== ${label} ==`);
  console.log(
    `recall over ${report.answerable} questions: ` + KS.map((k) => `@${k} ${pct(report.recallAt[k] ?? 0)}`).join(", "),
  );
  for (const [kind, byK] of Object.entries(report.recallByKind)) {
    console.log(`  ${kind}: ` + KS.map((k) => `@${k} ${pct(byK[k] ?? 0)}`).join(", "));
  }
  console.log(`"not in the journal" questions with hits: ${report.falseHits.length} of ${report.absent}`);
  for (const miss of report.missed) {
    console.log(`  missed [${miss.question.kind}] "${miss.question.question}" want ${miss.question.expect.join("+")}, got ${miss.foundKeys.join(",") || "nothing"}`);
  }
  for (const hit of report.falseHits) {
    console.log(`  false hit "${hit.question.question}" got ${hit.foundKeys.join(",")}`);
  }
}
