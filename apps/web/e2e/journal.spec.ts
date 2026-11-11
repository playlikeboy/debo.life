import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

// The whole phase 1 loop with a throwaway account that the test deletes at
// the end: sign up, write, ask (with and without an answer), delete.
// Uses made-up data only.
test("write an entry, ask about it, then delete everything", async ({ page }) => {
  const email = `debo-e2e-${Date.now()}@example.com`;
  const password = `E2e-${Math.random().toString(36).slice(2)}-pass`;
  const nav = page.getByRole("navigation", { name: "Your Debo" });
  const askBox = page.getByRole("textbox", { name: "Ask Debo about your entries" });

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
  await expect(nav.getByRole("link", { name: "Home", exact: true })).toHaveAttribute("aria-current", "page");

  // The hub's empty state leads to the journal.
  await page.getByRole("link", { name: "Write your first entry" }).click();
  await expect(page.getByRole("heading", { name: "Your journal" })).toBeVisible();
  await expect(nav.getByRole("link", { name: "Journal", exact: true })).toHaveAttribute("aria-current", "page");
  await page.waitForLoadState("networkidle");

  // An unsaved draft survives a reload (it stays in this browser), and
  // Ctrl+Enter saves it.
  const entryBox = page.getByLabel("Write an entry");
  await entryBox.fill("Riya moved to Pune in March. I helped her pack up her books and we had chai at the station.");
  await expect(page.getByText("20 words")).toBeVisible();
  await page.waitForTimeout(600); // the draft is kept a moment after typing stops
  await page.reload();
  await page.waitForLoadState("networkidle");
  await expect(entryBox).toHaveValue(/^Riya moved to Pune in March\./);
  await expect(page.getByText("I kept your unsaved draft from last time.", { exact: false })).toBeVisible();
  await entryBox.press("Control+Enter");
  await expect(page.getByText("Entry saved.")).toBeVisible();
  await expect(page.getByText("Riya moved to Pune in March.")).toBeVisible();
  await expect(entryBox).toHaveValue("");
  await page.reload();
  await expect(page.getByLabel("Write an entry")).toHaveValue(""); // the draft went away with the save

  // A question the entry answers: expect an answer with a source chip.
  await nav.getByRole("link", { name: "Home", exact: true }).click();
  await page.waitForLoadState("networkidle");
  await expect(page.getByRole("link", { name: /^Riya moved to Pune in March\./ })).toBeVisible(); // recent entries
  await askBox.fill("When did Riya move to Pune?");
  await page.getByRole("button", { name: "Ask Debo" }).click();
  const sources = page.getByRole("list", { name: "Where this answer came from" });
  await expect(sources).toBeVisible({ timeout: 60_000 });
  const chip = sources.getByRole("link", { name: /^Journal, / });
  await expect(chip).toHaveCount(1);
  await expect(chip).toHaveAttribute("href", /^\/home\/journal#entry-/);
  await expect(page.getByText(/March/).first()).toBeVisible();

  // A question nothing answers: Debo must say it does not know.
  await askBox.fill("What is my passport number?");
  await page.getByRole("button", { name: "Ask Debo" }).click();
  await expect(page.getByText("I don’t have anything about that yet.", { exact: false })).toBeVisible({
    timeout: 60_000,
  });

  // The source chip opens the entry it came from, marked on the journal page.
  await askBox.fill("When did Riya move to Pune?");
  await page.getByRole("button", { name: "Ask Debo" }).click();
  await expect(chip).toBeVisible({ timeout: 60_000 });
  await chip.click();
  await expect(page).toHaveURL(/\/home\/journal#entry-/);
  await expect(page.getByText("The entry you opened")).toBeVisible();
  await page.waitForLoadState("networkidle");

  // Edit the entry; search must find the new words, not the old ones.
  await page.getByRole("button", { name: "Edit this entry" }).click();
  await page.getByRole("textbox", { name: "Edit this entry" }).fill(
    "Riya moved to Mumbai in April. We said goodbye at the airport.",
  );
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Changes saved.")).toBeVisible();
  await expect(page.getByText("Riya moved to Mumbai in April.")).toBeVisible();

  // "Find an entry" looks through the person's own entries.
  await page.getByRole("searchbox", { name: "Find an entry" }).fill("mumbai");
  await page.getByRole("button", { name: "Find", exact: true }).click();
  await expect(page.getByText("1 entry has “mumbai”.")).toBeVisible();
  await page.getByRole("searchbox", { name: "Find an entry" }).fill("Pune");
  await page.getByRole("button", { name: "Find", exact: true }).click();
  await expect(page.getByText("No entries have “Pune”.")).toBeVisible();
  await page.getByRole("link", { name: "show all entries" }).click();
  await expect(page.getByText("Riya moved to Mumbai in April.")).toBeVisible();

  await nav.getByRole("link", { name: "Home", exact: true }).click();
  await page.waitForLoadState("networkidle");
  await askBox.fill("Where did Riya move to?");
  await page.getByRole("button", { name: "Ask Debo" }).click();
  await expect(page.getByRole("list", { name: "Where this answer came from" })).toBeVisible({ timeout: 60_000 });

  // The activity record shows what happened, without the words.
  await nav.getByRole("link", { name: "What Debo did", exact: true }).click();
  await expect(page.getByRole("heading", { name: "What Debo did" })).toBeVisible();
  await expect(page.getByText("You saved an entry.")).toBeVisible();
  await expect(page.getByText("You changed an entry.")).toBeVisible();
  await expect(page.getByText("Debo answered a question using 1 entry.").first()).toBeVisible();
  await expect(page.getByText("Debo had nothing about a question, so it said so.")).toBeVisible();
  await expect(page.getByText("Mumbai")).toHaveCount(0);
  await nav.getByRole("link", { name: "Home", exact: true }).click();
  await page.waitForLoadState("networkidle");

  // Download everything: a zip arrives with the right name.
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("link", { name: "Download everything" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^debo-export-\d{4}-\d{2}-\d{2}\.zip$/);
  const zip = readFileSync(await download.path());
  expect(zip.subarray(0, 2).toString()).toBe("PK"); // every zip file starts with "PK"
  expect(zip.includes("entries/")).toBe(true);

  // "What Debo knows" opens. Mem0 reads entries in the background, so do not
  // depend on which memories are there yet, only that the page loads.
  await nav.getByRole("link", { name: "What Debo knows", exact: true }).click();
  await expect(page.getByRole("heading", { name: "What Debo knows" })).toBeVisible();
  await expect(page.getByText("couldn’t load what Debo knows")).toHaveCount(0);
  await nav.getByRole("link", { name: "Home", exact: true }).click();
  await page.waitForLoadState("networkidle");

  // The chat answers from the same entry, with a source chip.
  await page.goto("/home/chat");
  // CopilotKit keeps a connection open, so wait for the input, not network idle.
  const chatInput = page.getByPlaceholder("When did I last see Riya?");
  await expect(chatInput).toBeEditable({ timeout: 30_000 });
  await chatInput.fill("Where did Riya move to?");
  await chatInput.press("Enter");
  const chatSources = page.getByRole("list", { name: "Where this answer came from" });
  await expect(chatSources.getByRole("link", { name: /^Journal, / })).toBeVisible({ timeout: 60_000 });
  await page.goto("/home");
  await page.waitForLoadState("networkidle");

  // Delete the entry, on the journal page.
  await page.goto("/home/journal");
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Delete this entry" }).click();
  await page.getByRole("button", { name: "Yes, delete it" }).click();
  await expect(page.getByText("Entry deleted.")).toBeVisible();
  await expect(page.getByText("Nothing here yet.")).toBeVisible();

  // Delete the account, from the home page.
  await page.goto("/home");
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Delete my account", exact: true }).click();
  await page.getByRole("button", { name: "Delete my account for good" }).click();
  await expect(page).toHaveURL(/\/$/);
  await page.goto("/home");
  await expect(page).toHaveURL(/\/auth\/sign-in/);
});
