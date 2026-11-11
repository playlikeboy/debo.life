import { withDb } from "@debo/db";
import { expect, type Page } from "@playwright/test";

// Test-only helpers. They talk to the database from the test machine (repo-root
// .env), never through the app, and only ever touch throwaway e2e accounts.

const E2E_EMAIL = /^debo-e2e-[\w-]+@example\.com$/;

export const newTestPerson = (tag: string) => ({
  email: `debo-e2e-${tag}-${Date.now()}@example.com`,
  password: `E2e-${Math.random().toString(36).slice(2)}-pass`,
});

/**
 * New accounts confirm their email with a code, which a test cannot read from
 * an inbox. Mark the throwaway account confirmed directly instead.
 */
export async function confirmEmailForTest(email: string) {
  if (!E2E_EMAIL.test(email)) throw new Error("confirmEmailForTest only works on debo-e2e test accounts");
  const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
  if (!url) throw new Error("Set DATABASE_URL_UNPOOLED (repo-root .env) to run this test");
  await withDb(url, (db) =>
    db.$client.query(`update neon_auth."user" set "emailVerified" = true where email = $1`, [email]),
  );
}

/** Sign up from the landing page, confirm the email, and land on the home hub. */
export async function signUp(page: Page, person: { email: string; password: string }, name = "Test Person") {
  await page.goto("/");
  await page.getByRole("link", { name: "Create your account" }).click();
  await page.waitForLoadState("networkidle"); // let the form's JavaScript load first
  await page.getByLabel("Your name").fill(name);
  await page.getByLabel("Email").fill(person.email);
  await page.getByLabel("Password").fill(person.password);
  await page.getByRole("button", { name: "Create my account" }).click();

  const hello = page.getByRole("heading", { name: `Hi, ${name}` });
  const confirm = page.getByRole("heading", { name: "Confirm your email" });
  await expect(hello.or(confirm)).toBeVisible({ timeout: 30_000 });
  if (await confirm.isVisible()) {
    await expect(page.getByRole("textbox", { name: "Code from your email" })).toBeVisible();
    await confirmEmailForTest(person.email);
    await signInWithPassword(page, person);
  }
  await expect(hello).toBeVisible({ timeout: 30_000 });
  await page.waitForLoadState("networkidle");
}

export async function signInWithPassword(page: Page, person: { email: string; password: string }) {
  await page.goto("/auth/sign-in");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Email").fill(person.email);
  await page.getByLabel("Password").fill(person.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
}
