// @debo/recall: the recall test set (made-up entries, questions with known
// answers) and its scoring. Tooling only: the web app never imports this.
// Run it with `pnpm --filter @debo/recall recall` (see README.md).
export { entries, questions, type FixtureEntry, type FixtureQuestion, type QuestionKind } from "./fixtures";
export { hitAt, score, type QuestionResult, type Report } from "./score";
