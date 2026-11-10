import { expect, test } from "@playwright/test";

// The whole phase 1 loop with a throwaway account that the test deletes at
// the end: sign up, write, ask (with and without an answer), delete.
// Uses made-up data only.
test("write an entry, ask about it, then delete everything", async ({ page }) => {
  const email = `debo-e2e-${Date.now()}@example.com`;
  const password = `E2e-${Math.random().toString(36).slice(2)}-pass`;

  await page.goto("/");
  await page.getByRole("link", { name: "Create your account" }).click();
  await page.waitForLoadState("networkidle"); // let the form's JavaScript load first
  await page.getByLabel("Your name").fill("Test Person");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Create my account" }).click();
  await expect(page.getByRole("heading", { name: "Hi, Test Person" })).toBeVisible({ timeout: 30_000 });
  await page.waitForLoadState("networkidle");
  await expect(page.getByText("Nothing here yet.")).toBeVisible();

  await page.getByLabel("Write an entry").fill(
    "Riya moved to Pune in March. I helped her pack up her books and we had chai at the station.",
  );
  await page.getByRole("button", { name: "Save entry" }).click();
  await expect(page.getByText("Entry saved.")).toBeVisible();
  await expect(page.getByText("Riya moved to Pune in March.")).toBeVisible();

  // A question the entry answers: expect an answer with a source chip.
  await page.getByRole("textbox", { name: "Ask Debo about your entries" }).fill("When did Riya move to Pune?");
  await page.getByRole("button", { name: "Ask Debo" }).click();
  const sources = page.getByRole("list", { name: "Where this answer came from" });
  await expect(sources).toBeVisible({ timeout: 60_000 });
  await expect(sources.getByRole("link", { name: /^Journal, / })).toHaveCount(1);
  await expect(page.getByText(/March/).first()).toBeVisible();

  // A question nothing answers: Debo must say it does not know.
  await page.getByRole("textbox", { name: "Ask Debo about your entries" }).fill("What is my passport number?");
  await page.getByRole("button", { name: "Ask Debo" }).click();
  await expect(page.getByText("I don’t have anything about that yet.", { exact: false })).toBeVisible({
    timeout: 60_000,
  });

  // Delete the entry.
  await page.getByRole("button", { name: "Delete this entry" }).click();
  await page.getByRole("button", { name: "Yes, delete it" }).click();
  await expect(page.getByText("Nothing here yet.")).toBeVisible();

  // Delete the account.
  await page.getByRole("button", { name: "Delete my account", exact: true }).click();
  await page.getByRole("button", { name: "Delete my account for good" }).click();
  await expect(page).toHaveURL(/\/$/);
  await page.goto("/home");
  await expect(page).toHaveURL(/\/auth\/sign-in/);
});
