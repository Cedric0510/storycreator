import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import JSZip from "jszip";
import { type CDPSession, expect, test, type Page, type TestInfo } from "@playwright/test";

interface LoadBundle {
  fileName: string;
  buffer: Buffer;
  expectedNodeCount: number;
  expectedMinPreviewSteps: number;
  cinematicCount: number;
  assetCount: number;
}

interface MemorySnapshot {
  tag: string;
  timestampIso: string;
  jsHeapUsedMB: number | null;
  jsHeapTotalMB: number | null;
  cdpHeapUsedMB: number | null;
  cdpHeapTotalMB: number | null;
  storageUsageMB: number | null;
  storageQuotaMB: number | null;
  domNodeCount: number;
}

interface PreviewRunResult {
  steps: number;
  snapshots: MemorySnapshot[];
}

interface EnvConfig {
  importCycles: number;
  cinematicBlocks: number;
  chapterSize: number;
  assetCount: number;
  duplicateStride: number;
  sampleEverySteps: number;
  maxHeapGrowthMB: number;
  maxStorageGrowthMB: number;
}

function readIntEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function readFloatEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseFloat(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toMB(bytes: number | null): number | null {
  if (bytes == null) return null;
  return Number((bytes / (1024 * 1024)).toFixed(2));
}

function svgAsset(seed: number): string {
  const hue = (seed * 37) % 360;
  const strokeHue = (hue + 170) % 360;
  const alphaA = 0.4 + ((seed % 3) * 0.15);
  const alphaB = 0.25 + ((seed % 5) * 0.1);
  return [
    "<svg xmlns='http://www.w3.org/2000/svg' width='1024' height='576' viewBox='0 0 1024 576'>",
    `<defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0%' stop-color='hsl(${hue} 80% 35%)'/><stop offset='100%' stop-color='hsl(${(hue + 85) % 360} 70% 18%)'/></linearGradient></defs>`,
    "<rect width='1024' height='576' fill='url(#g)'/>",
    `<circle cx='240' cy='180' r='190' fill='hsl(${strokeHue} 70% 65% / ${alphaA.toFixed(2)})'/>`,
    `<rect x='480' y='120' width='420' height='310' rx='28' fill='hsl(${(hue + 25) % 360} 70% 60% / ${alphaB.toFixed(2)})'/>`,
    `<text x='70' y='520' font-size='44' font-family='monospace' fill='white'>asset-seed-${seed}</text>`,
    "</svg>",
  ].join("");
}

function fixedId(prefix: string, index: number): string {
  return `${prefix}_${index.toString(16).padStart(8, "0")}`;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function readEnvConfig(): EnvConfig {
  return {
    importCycles: readIntEnv("LOAD_IMPORT_CYCLES", 6),
    cinematicBlocks: readIntEnv("LOAD_CINEMATIC_BLOCKS", 220),
    chapterSize: readIntEnv("LOAD_CHAPTER_SIZE", 55),
    assetCount: readIntEnv("LOAD_ASSET_COUNT", 48),
    duplicateStride: readIntEnv("LOAD_DUPLICATE_STRIDE", 3),
    sampleEverySteps: readIntEnv("LOAD_PREVIEW_SAMPLE_EVERY", 25),
    maxHeapGrowthMB: readFloatEnv("LOAD_MAX_HEAP_GROWTH_MB", 180),
    maxStorageGrowthMB: readFloatEnv("LOAD_MAX_STORAGE_GROWTH_MB", 220),
  };
}

async function buildLoadBundle({
  cinematicCount,
  chapterSize,
  assetCount,
  duplicateStride,
  title,
}: {
  cinematicCount: number;
  chapterSize: number;
  assetCount: number;
  duplicateStride: number;
  title: string;
}): Promise<LoadBundle> {
  const zip = new JSZip();
  const now = new Date().toISOString();
  const startBlockId = fixedId("title", 1);
  const chain: string[] = [startBlockId];
  const blocks: Array<Record<string, unknown>> = [];
  const chapters: Array<{ id: string; name: string; collapsed: boolean }> = [];

  const assetPaths: string[] = [];
  for (let i = 0; i < assetCount; i += 1) {
    const assetId = fixedId("asset", i + 1);
    const path = `assets/${assetId}-bg-${i + 1}.svg`;
    const seed = Math.floor(i / Math.max(1, duplicateStride)) + 1;
    zip.file(path, svgAsset(seed));
    assetPaths.push(path);
  }

  blocks.push({
    id: startBlockId,
    type: "title",
    name: "LOAD_TITLE",
    position: { x: 120, y: 120 },
    notes: "load fixture",
    chapterId: null,
    entryEffects: [],
    storyTitle: title,
    subtitle: "Load profile",
    backgroundPath: assetPaths[0] ?? null,
    buttonStyle: {
      backgroundColor: "#2563eb",
      textColor: "#ffffff",
      borderColor: "#1e3a8a",
      radius: 14,
      fontSize: 18,
    },
    nextBlockId: null,
  });

  let cinematicIndex = 0;
  let chapterIndex = 0;
  while (cinematicIndex < cinematicCount) {
    chapterIndex += 1;
    const chapterId = fixedId("chapter", chapterIndex);
    chapters.push({
      id: chapterId,
      name: `Chapitre ${chapterIndex}`,
      collapsed: false,
    });

    const chapterStartId = fixedId("chapter_start", chapterIndex);
    chain.push(chapterStartId);
    blocks.push({
      id: chapterStartId,
      type: "chapter_start",
      name: `Debut chapitre ${chapterIndex}`,
      position: { x: 200 + chapterIndex * 20, y: 120 + chapterIndex * 14 },
      notes: "",
      chapterId,
      entryEffects: [],
      chapterTitle: `Chapitre ${chapterIndex}`,
      nextBlockId: null,
    });

    const chapterSlice = Math.min(chapterSize, cinematicCount - cinematicIndex);
    for (let i = 0; i < chapterSlice; i += 1) {
      cinematicIndex += 1;
      const blockId = fixedId("cinematic", cinematicIndex);
      chain.push(blockId);
      const assetPath = assetPaths[cinematicIndex % assetPaths.length] ?? null;
      blocks.push({
        id: blockId,
        type: "cinematic",
        name: `Scene ${cinematicIndex}`,
        position: { x: 300 + cinematicIndex * 18, y: 160 + (cinematicIndex % 6) * 24 },
        notes: "",
        chapterId,
        entryEffects: [],
        heading: `Scene ${cinematicIndex}`,
        body: `Navigation longue ${cinematicIndex}`,
        backgroundPath: assetPath,
        characterPath: null,
        sceneLayout: {
          background: { x: 0, y: 0, width: 100, height: 100 },
          character: { x: 50, y: 8, width: 35, height: 84 },
        },
        videoPath: null,
        voicePath: null,
        autoAdvanceSeconds: null,
        nextBlockId: null,
      });
    }

    const chapterEndId = fixedId("chapter_end", chapterIndex);
    chain.push(chapterEndId);
    blocks.push({
      id: chapterEndId,
      type: "chapter_end",
      name: `Fin chapitre ${chapterIndex}`,
      position: { x: 360 + chapterIndex * 30, y: 280 + chapterIndex * 16 },
      notes: "",
      chapterId,
      entryEffects: [],
      nextBlockId: null,
    });
  }

  const byId = new Map<string, Record<string, unknown>>();
  for (const block of blocks) {
    byId.set(String(block.id), block);
  }
  for (let i = 0; i < chain.length - 1; i += 1) {
    const current = byId.get(chain[i]);
    if (!current) continue;
    current.nextBlockId = chain[i + 1];
  }

  const payload = {
    schemaVersion: "1.2.0",
    exportedAt: now,
    project: {
      id: fixedId("project", cinematicCount + assetCount),
      title,
      slug: title.toLowerCase().replace(/\s+/g, "-"),
      synopsis: "Automated load fixture",
      startBlockId,
      updatedAt: now,
      chapters,
    },
    variables: [
      { id: fixedId("var", 1), name: "energie", initialValue: 0 },
      { id: fixedId("var", 2), name: "relation", initialValue: 0 },
    ],
    itemsCatalog: [],
    hero: {
      name: "Hero",
      lore: "",
      baseStats: [],
      npcs: [],
      startingInventory: [],
    },
    blocks,
    graph: {
      edges: chain.slice(0, -1).map((source, index) => ({
        source,
        sourceHandle: "next",
        target: chain[index + 1],
      })),
    },
  };

  zip.file("story.json", JSON.stringify(payload, null, 2));
  const buffer = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });

  return {
    fileName: `load-fixture-${cinematicCount}-blocks-${assetCount}-assets.zip`,
    buffer,
    expectedNodeCount: chain.length,
    expectedMinPreviewSteps: cinematicCount + 1,
    cinematicCount,
    assetCount,
  };
}

async function requireSignIn(page: Page): Promise<void> {
  if (await page.getByRole("button", { name: "Se deconnecter" }).isVisible().catch(() => false)) {
    return;
  }

  const email = process.env.LOAD_TEST_EMAIL;
  const password = process.env.LOAD_TEST_PASSWORD;
  if (!email || !password) {
    throw new Error(
      "Missing auth for load battery. Set LOAD_TEST_EMAIL and LOAD_TEST_PASSWORD to an author/admin account.",
    );
  }

  const emailInput = page.getByLabel("Email");
  const passwordInput = page.getByLabel("Mot de passe");
  if ((await emailInput.count()) === 0 || (await passwordInput.count()) === 0) {
    throw new Error("Cannot find auth form inputs (Email / Mot de passe).");
  }

  await emailInput.fill(email);
  await passwordInput.fill(password);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page.getByRole("button", { name: "Se deconnecter" })).toBeVisible({
    timeout: 60_000,
  });
}

async function importBundle(page: Page, bundle: LoadBundle): Promise<void> {
  const zipInput = page.locator('input[type="file"][accept=".zip"]');
  await expect(zipInput).toHaveCount(1);
  await zipInput.setInputFiles({
    name: bundle.fileName,
    mimeType: "application/zip",
    buffer: bundle.buffer,
  });

  const successPattern = new RegExp(
    `Import reussi: .*depuis ${escapeRegExp(bundle.fileName)}\\.`,
  );
  await expect(
    page.locator(".toast-message").filter({ hasText: successPattern }).first(),
  ).toBeVisible({ timeout: 90_000 });

  await expect
    .poll(async () => page.locator(".react-flow__node").count(), {
      timeout: 90_000,
      message: `Expected imported graph node count near ${bundle.expectedNodeCount}`,
    })
    .toBeGreaterThanOrEqual(bundle.expectedNodeCount - 1);

  await expect(page.locator(".nav-action-preview")).toBeEnabled({ timeout: 15_000 });
}

async function clickIfVisible(locator: ReturnType<Page["locator"]>): Promise<boolean> {
  const count = await locator.count();
  if (count === 0) return false;
  const first = locator.first();
  if (!(await first.isVisible())) return false;
  await first.click();
  return true;
}

async function collectMemorySnapshot(
  page: Page,
  cdp: CDPSession | null,
  tag: string,
): Promise<MemorySnapshot> {
  await page.evaluate(() => {
    const gc = (globalThis as { gc?: () => void }).gc;
    if (typeof gc === "function") gc();
  });

  const browserStats = await page.evaluate(async () => {
    const perfMemory = (performance as { memory?: { usedJSHeapSize: number; totalJSHeapSize: number } })
      .memory;
    const storageEstimate = await navigator.storage?.estimate?.();
    return {
      usedJsHeapBytes:
        typeof perfMemory?.usedJSHeapSize === "number" ? perfMemory.usedJSHeapSize : null,
      totalJsHeapBytes:
        typeof perfMemory?.totalJSHeapSize === "number" ? perfMemory.totalJSHeapSize : null,
      storageUsageBytes:
        typeof storageEstimate?.usage === "number" ? storageEstimate.usage : null,
      storageQuotaBytes:
        typeof storageEstimate?.quota === "number" ? storageEstimate.quota : null,
      domNodeCount: document.querySelectorAll("*").length,
    };
  });

  let cdpHeapUsedBytes: number | null = null;
  let cdpHeapTotalBytes: number | null = null;
  if (cdp) {
    try {
      const heap = await cdp.send("Runtime.getHeapUsage");
      cdpHeapUsedBytes = heap.usedSize;
      cdpHeapTotalBytes = heap.totalSize;
    } catch {
      cdpHeapUsedBytes = null;
      cdpHeapTotalBytes = null;
    }
  }

  return {
    tag,
    timestampIso: new Date().toISOString(),
    jsHeapUsedMB: toMB(browserStats.usedJsHeapBytes),
    jsHeapTotalMB: toMB(browserStats.totalJsHeapBytes),
    cdpHeapUsedMB: toMB(cdpHeapUsedBytes),
    cdpHeapTotalMB: toMB(cdpHeapTotalBytes),
    storageUsageMB: toMB(browserStats.storageUsageBytes),
    storageQuotaMB: toMB(browserStats.storageQuotaBytes),
    domNodeCount: browserStats.domNodeCount,
  };
}

async function startPreview(page: Page): Promise<void> {
  await expect(page.locator(".nav-action-preview")).toBeEnabled();
  await page.locator(".nav-action-preview").click();
  await expect(page.locator(".preview-overlay")).toBeVisible({ timeout: 15_000 });
}

async function closePreview(page: Page): Promise<void> {
  const closeButton = page.locator('.preview-status-btn[title="Fermer"]').first();
  if (await closeButton.count()) {
    await closeButton.click();
  }
  await expect(page.locator(".preview-overlay")).toBeHidden({ timeout: 15_000 });
}

async function runPreviewUntilEnd(
  page: Page,
  cdp: CDPSession | null,
  {
    expectedMinSteps,
    maxSteps,
    sampleEverySteps,
    cycleIndex,
  }: {
    expectedMinSteps: number;
    maxSteps: number;
    sampleEverySteps: number;
    cycleIndex: number;
  },
): Promise<PreviewRunResult> {
  const snapshots: MemorySnapshot[] = [];
  let steps = 0;

  while (steps < maxSteps) {
    if (await page.locator(".preview-vn-end").isVisible().catch(() => false)) {
      break;
    }

    const clickedResponse = await clickIfVisible(page.locator(".preview-vn-response-btn"));
    const clickedChoice =
      clickedResponse || (await clickIfVisible(page.locator(".preview-vn-choice-btn")));
    const clickedTitleContinue =
      clickedChoice || (await clickIfVisible(page.locator(".preview-vn-styled-btn")));
    const clickedNext =
      clickedTitleContinue ||
      (await clickIfVisible(page.locator(".preview-vn-next-btn:enabled")));

    if (!clickedNext) {
      throw new Error(`Preview navigation blocked at step ${steps} on cycle ${cycleIndex}.`);
    }

    steps += 1;
    if (steps % sampleEverySteps === 0) {
      snapshots.push(
        await collectMemorySnapshot(page, cdp, `cycle-${cycleIndex}-preview-step-${steps}`),
      );
    }
  }

  const reachedEnd = await page.locator(".preview-vn-end").isVisible().catch(() => false);
  if (!reachedEnd) {
    throw new Error(
      `Preview did not reach end after ${maxSteps} steps on cycle ${cycleIndex}.`,
    );
  }

  expect(steps).toBeGreaterThanOrEqual(expectedMinSteps);
  return { steps, snapshots };
}

function firstNumber(values: Array<number | null>): number | null {
  for (const value of values) {
    if (typeof value === "number") return value;
  }
  return null;
}

function lastNumber(values: Array<number | null>): number | null {
  for (let i = values.length - 1; i >= 0; i -= 1) {
    const value = values[i];
    if (typeof value === "number") return value;
  }
  return null;
}

async function writeReport(testInfo: TestInfo, report: Record<string, unknown>): Promise<string> {
  const reportPath = testInfo.outputPath("memory-load-report.json");
  await mkdir(dirname(reportPath), { recursive: true });
  await writeFile(reportPath, JSON.stringify(report, null, 2), "utf8");
  await testInfo.attach("memory-load-report", {
    path: reportPath,
    contentType: "application/json",
  });
  return reportPath;
}

test("targeted load battery: preview + long navigation + successive imports", async ({
  page,
}, testInfo) => {
  const config = readEnvConfig();
  const primaryBundle = await buildLoadBundle({
    cinematicCount: config.cinematicBlocks,
    chapterSize: config.chapterSize,
    assetCount: config.assetCount,
    duplicateStride: config.duplicateStride,
    title: "Load battery primary",
  });
  const secondaryBundle = await buildLoadBundle({
    cinematicCount: config.cinematicBlocks + Math.max(18, Math.floor(config.cinematicBlocks * 0.1)),
    chapterSize: config.chapterSize,
    assetCount: config.assetCount + Math.max(6, Math.floor(config.assetCount * 0.2)),
    duplicateStride: config.duplicateStride,
    title: "Load battery secondary",
  });

  await page.goto("/");
  await page.waitForSelector(".nav-action-preview", { timeout: 90_000 });
  await requireSignIn(page);
  await expect(page.locator(".nav-action-import")).toBeEnabled();
  await expect(page.locator(".nav-action-preview")).toBeEnabled();
  await expect(page.locator(".react-flow")).toBeVisible();

  let cdp: CDPSession | null = null;
  try {
    cdp = await page.context().newCDPSession(page);
  } catch {
    cdp = null;
  }

  const allSnapshots: MemorySnapshot[] = [];
  const runSummaries: Array<{
    cycle: number;
    fixture: string;
    expectedMinPreviewSteps: number;
    actualPreviewSteps: number;
    expectedNodeCount: number;
  }> = [];

  allSnapshots.push(await collectMemorySnapshot(page, cdp, "baseline-before-imports"));

  for (let cycle = 1; cycle <= config.importCycles; cycle += 1) {
    const bundle = cycle % 2 === 0 ? secondaryBundle : primaryBundle;

    await importBundle(page, bundle);
    allSnapshots.push(await collectMemorySnapshot(page, cdp, `cycle-${cycle}-after-import`));

    await startPreview(page);
    const previewResult = await runPreviewUntilEnd(page, cdp, {
      cycleIndex: cycle,
      expectedMinSteps: bundle.expectedMinPreviewSteps,
      maxSteps: bundle.expectedMinPreviewSteps + 60,
      sampleEverySteps: config.sampleEverySteps,
    });
    runSummaries.push({
      cycle,
      fixture: bundle.fileName,
      expectedMinPreviewSteps: bundle.expectedMinPreviewSteps,
      actualPreviewSteps: previewResult.steps,
      expectedNodeCount: bundle.expectedNodeCount,
    });
    allSnapshots.push(...previewResult.snapshots);

    await closePreview(page);
    allSnapshots.push(await collectMemorySnapshot(page, cdp, `cycle-${cycle}-after-preview`));
  }

  const afterPreviewSnapshots = allSnapshots.filter((snapshot) =>
    snapshot.tag.endsWith("-after-preview"),
  );
  const heapSeries = afterPreviewSnapshots.map((snapshot) =>
    snapshot.cdpHeapUsedMB ?? snapshot.jsHeapUsedMB,
  );
  const storageSeries = afterPreviewSnapshots.map((snapshot) => snapshot.storageUsageMB);

  const firstHeapMB = firstNumber(heapSeries);
  const lastHeapMB = lastNumber(heapSeries);
  const firstStorageMB = firstNumber(storageSeries);
  const lastStorageMB = lastNumber(storageSeries);

  expect(firstHeapMB).not.toBeNull();
  expect(lastHeapMB).not.toBeNull();
  expect(firstStorageMB).not.toBeNull();
  expect(lastStorageMB).not.toBeNull();

  const heapGrowthMB = Number(((lastHeapMB ?? 0) - (firstHeapMB ?? 0)).toFixed(2));
  const storageGrowthMB = Number(((lastStorageMB ?? 0) - (firstStorageMB ?? 0)).toFixed(2));

  expect(heapGrowthMB).toBeLessThanOrEqual(config.maxHeapGrowthMB);
  expect(storageGrowthMB).toBeLessThanOrEqual(config.maxStorageGrowthMB);

  const report = {
    generatedAt: new Date().toISOString(),
    config,
    thresholds: {
      maxHeapGrowthMB: config.maxHeapGrowthMB,
      maxStorageGrowthMB: config.maxStorageGrowthMB,
    },
    fixtures: [
      {
        fileName: primaryBundle.fileName,
        expectedNodeCount: primaryBundle.expectedNodeCount,
        expectedMinPreviewSteps: primaryBundle.expectedMinPreviewSteps,
        cinematicCount: primaryBundle.cinematicCount,
        assetCount: primaryBundle.assetCount,
      },
      {
        fileName: secondaryBundle.fileName,
        expectedNodeCount: secondaryBundle.expectedNodeCount,
        expectedMinPreviewSteps: secondaryBundle.expectedMinPreviewSteps,
        cinematicCount: secondaryBundle.cinematicCount,
        assetCount: secondaryBundle.assetCount,
      },
    ],
    runSummaries,
    aggregate: {
      firstHeapMB,
      lastHeapMB,
      heapGrowthMB,
      firstStorageMB,
      lastStorageMB,
      storageGrowthMB,
    },
    snapshots: allSnapshots,
  };

  const reportPath = await writeReport(testInfo, report);
  console.log(`[load-battery] report written to ${reportPath}`);
});
