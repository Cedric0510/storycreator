import { expect, test } from "@playwright/test";

test("creates the first Cadarium account and opens the studio", async ({ page }) => {
  await page.goto("/inscription");
  await page.getByLabel("Email").fill("cadarium-browser-e2e@cadarium.test");
  await page.getByLabel("Mot de passe", { exact: true }).fill("Test-password-9284");
  await page.getByLabel("Confirmation mot de passe").fill("Test-password-9284");
  await page.getByRole("button", { name: "Creer le compte" }).click();

  await expect(page).toHaveURL(/\/studio$/);
  await expect(page.locator(".react-flow")).toBeVisible();
});
