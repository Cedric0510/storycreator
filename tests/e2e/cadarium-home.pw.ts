import { expect, test } from "@playwright/test";

test("hydrates the Cadarium home page without browser errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });

  await page.goto("/");
  await expect(page.getByLabel("Email")).toBeVisible();

  expect(errors).toEqual([]);
});
