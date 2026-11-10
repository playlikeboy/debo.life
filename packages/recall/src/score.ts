// Scoring for the recall test set. Pure functions, no database.
import type { FixtureQuestion, QuestionKind } from "./fixtures";

/** What search returned for one question: entry keys, best first. */
export type QuestionResult = { question: FixtureQuestion; foundKeys: string[] };

/** True if every expected entry is in the first k results. */
export function hitAt(result: QuestionResult, k: number): boolean {
  const top = new Set(result.foundKeys.slice(0, k));
  return result.question.expect.every((key) => top.has(key));
}

export type Report = {
  /** Share of answerable questions with every expected entry in the top k. */
  recallAt: Record<number, number>;
  /** Same, split by question kind. */
  recallByKind: Partial<Record<QuestionKind, Record<number, number>>>;
  /** Answerable questions that missed at the largest k. */
  missed: QuestionResult[];
  /** "Not in the journal" questions that still found something. */
  falseHits: QuestionResult[];
  answerable: number;
  absent: number;
};

export function score(results: QuestionResult[], ks: number[]): Report {
  const answerable = results.filter((r) => r.question.kind !== "absent");
  const absent = results.filter((r) => r.question.kind === "absent");
  const rate = (list: QuestionResult[], k: number) =>
    list.length === 0 ? 1 : list.filter((r) => hitAt(r, k)).length / list.length;

  const recallAt: Record<number, number> = {};
  for (const k of ks) recallAt[k] = rate(answerable, k);

  const recallByKind: Report["recallByKind"] = {};
  for (const kind of ["keyword", "meaning"] as const) {
    const list = answerable.filter((r) => r.question.kind === kind);
    const byK: Record<number, number> = {};
    for (const k of ks) byK[k] = rate(list, k);
    recallByKind[kind] = byK;
  }

  const maxK = Math.max(...ks);
  return {
    recallAt,
    recallByKind,
    missed: answerable.filter((r) => !hitAt(r, maxK)),
    falseHits: absent.filter((r) => r.foundKeys.length > 0),
    answerable: answerable.length,
    absent: absent.length,
  };
}
