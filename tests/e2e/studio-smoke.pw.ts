import { readFile } from "node:fs/promises";

import JSZip from "jszip";
import { expect, test } from "@playwright/test";

/**
 * Smoke test du parcours coeur: connexion -> studio -> export ZIP ->
 * reimport -> preview. Tourne contre le backend fake
 * (NEXT_PUBLIC_BACKEND_MODE=fake, voir playwright.e2e.config.ts).
 */

const ADMIN_EMAIL = "e2e-admin@studio.local";
const ADMIN_PASSWORD = "motdepasse-e2e";

test("parcours coeur: connexion, export ZIP, reimport, preview", async ({ page }) => {
  // La video d'intro retarde l'apparition du formulaire: on la court-circuite
  // (son onError declenche l'affichage immediat de la carte de connexion).
  await page.route("**/*.mp4", (route) => route.abort());

  // ── Connexion depuis le portail ──
  await page.goto("/");
  await page.getByLabel("Email").fill(ADMIN_EMAIL);
  await page.getByLabel("Mot de passe").fill(ADMIN_PASSWORD);
  await page.getByRole("button", { name: "Se connecter" }).click();

  await page.waitForURL("**/studio", { timeout: 60_000 });
  await expect(page.locator(".react-flow")).toBeVisible();

  // Projet vierge: un seul bloc (Ecran titre, bloc de depart).
  await expect(page.locator(".react-flow__node")).toHaveCount(1);

  // ── Export ZIP via le menu principal ──
  await page.locator(".studio-menu-trigger").click();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export ZIP" }).click();
  const download = await downloadPromise;

  const zipPath = await download.path();
  expect(zipPath).toBeTruthy();
  const zipBuffer = await readFile(zipPath as string);

  const zip = await JSZip.loadAsync(zipBuffer);
  const storyFile = zip.file("story.json");
  expect(storyFile).toBeTruthy();
  const story = JSON.parse(await storyFile!.async("string")) as {
    schemaVersion: string;
    project: { title: string; startBlockId: string | null };
    blocks: Array<{ id: string; type: string }>;
  };
  expect(story.schemaVersion).toBe("1.10.0");
  expect(story.blocks).toHaveLength(1);
  expect(story.blocks[0].type).toBe("title");
  expect(story.project.startBlockId).toBe(story.blocks[0].id);

  await expect(
    page.locator(".toast-message").filter({ hasText: /Export reussi/ }).first(),
  ).toBeVisible();

  // ── Reimport du meme ZIP: fusion, le graphe passe a 2 blocs ──
  await page.locator('input[type="file"][accept=".zip"]').setInputFiles({
    name: "smoke-bundle.zip",
    mimeType: "application/zip",
    buffer: zipBuffer,
  });

  await expect(
    page.locator(".toast-message").filter({ hasText: /Import fusionne: 1 bloc\(s\)/ }).first(),
  ).toBeVisible({ timeout: 30_000 });
  await expect(page.locator(".react-flow__node")).toHaveCount(2);

  // ── Preview: le telephone s'affiche au premier plan et se ferme ──
  await page.locator(".studio-menu-trigger").click();
  await page.getByRole("button", { name: "Preview" }).click();
  await expect(page.locator(".preview-overlay")).toBeVisible();
  await expect(page.locator(".preview-device")).toBeVisible();

  const closeButton = page.locator('.preview-status-btn[title="Fermer"]');
  await closeButton.click();
  await expect(page.locator(".preview-overlay")).toBeHidden();
});

test("un compte non admin ne voit pas l'entree Administration", async ({ page }) => {
  await page.route("**/*.mp4", (route) => route.abort());

  await page.goto("/");
  await page.getByLabel("Email").fill("e2e-auteur@studio.local");
  await page.getByLabel("Mot de passe").fill("motdepasse-e2e");
  await page.getByRole("button", { name: "Se connecter" }).click();
  await page.waitForURL("**/studio", { timeout: 60_000 });

  await page.locator(".studio-menu-trigger").click();
  const menuPanel = page.locator("#studio-main-menu-panel");
  await expect(menuPanel.getByRole("button", { name: "Compte" })).toBeVisible();
  await expect(menuPanel.getByRole("button", { name: "Administration" })).toHaveCount(0);
});
