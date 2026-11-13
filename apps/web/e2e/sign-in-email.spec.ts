import { expect, test } from "@playwright/test";
import { newTestPerson, signInWithPassword, signUp } from "./helpers";

// Sign in by email code and by email link reach the "check your email" step.
// That proves Neon Auth accepted the request and our webhook sent the email
// (if the webhook failed, Neon would return an error). The test cannot open
// the email, so the last step (typing the code, opening the link) is manual.
test("sign in by email code or link, then delete the account", async ({ page }) => {
  const person = newTestPerson("signin");
  await signUp(page, person);

  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/$/);

  // A wrong password says so; it is not shown as a connection problem.
  await signInWithPassword(page, { email: person.email, password: "not-the-password-1" });
  await expect(page.getByRole("alert")).toContainText("That email and password don't match.");

  await page.goto("/auth/sign-in");
  await page.waitForLoadState("networkidle");
  await page.getByRole("radio", { name: "Email me a code" }).check();
  await expect(page.getByLabel("Password", { exact: true })).toHaveCount(0);
  await page.getByLabel("Email", { exact: true }).fill(person.email);
  await page.getByRole("button", { name: "Email me a code" }).click();
  await expect(page.getByRole("heading", { name: "Check your email for a code" })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("textbox", { name: "Code from your email" })).toBeVisible();
  await page.getByRole("button", { name: "Use a different email" }).click();

  await page.getByRole("radio", { name: "Email me a link" }).check();
  await page.getByLabel("Email", { exact: true }).fill(person.email);
  await page.getByRole("button", { name: "Email me a link" }).click();
  await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible({ timeout: 30_000 });

  // Clean up: back in with the password, then delete the account.
  await signInWithPassword(page, person);
  await expect(page.getByRole("heading", { name: "Hi, Test Person" })).toBeVisible({ timeout: 30_000 });
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Delete my account", exact: true }).click();
  await page.getByRole("button", { name: "Delete my account for good" }).click();
  await expect(page).toHaveURL(/\/$/);
});
