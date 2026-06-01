import { EditorNode } from "@/components/author-studio-core";
import {
  Chapter,
  ProjectMeta,
  StoryBlock,
  createId,
  normalizeHeroProfile,
  normalizeStoryBlock,
} from "@/lib/story";

export function normalizeProjectItems(
  items: unknown,
): ProjectMeta["items"] {
  if (!Array.isArray(items)) return [];

  return items.map((entry, index) => {
    const candidate = entry as Partial<ProjectMeta["items"][number]>;
    const hasName = typeof candidate.name === "string" && candidate.name.trim().length > 0;
    return {
      id: typeof candidate.id === "string" && candidate.id ? candidate.id : createId("item"),
      name: hasName ? candidate.name!.trim() : `Objet ${index + 1}`,
      description: typeof candidate.description === "string" ? candidate.description : "",
      iconAssetId: typeof candidate.iconAssetId === "string" ? candidate.iconAssetId : null,
    };
  });
}

export function normalizeProjectHero(
  hero: unknown,
  variables: ProjectMeta["variables"],
  items: ProjectMeta["items"],
): ProjectMeta["hero"] {
  const normalizedHero = normalizeHeroProfile(hero);
  const variableIds = new Set(variables.map((variable) => variable.id));
  const itemIds = new Set(items.map((item) => item.id));

  return {
    ...normalizedHero,
    baseStats: normalizedHero.baseStats.filter((stat) => variableIds.has(stat.variableId)),
    startingInventory: normalizedHero.startingInventory.filter((entry) =>
      itemIds.has(entry.itemId),
    ),
  };
}

export function normalizeProjectChapters(chapters: unknown): ProjectMeta["chapters"] {
  if (!Array.isArray(chapters)) return [];

  const normalized: ProjectMeta["chapters"] = [];
  const seenIds = new Set<string>();
  for (let index = 0; index < chapters.length; index += 1) {
    const candidate = chapters[index] as Partial<ProjectMeta["chapters"][number]>;
    if (!candidate || typeof candidate !== "object") continue;

    const id = typeof candidate.id === "string" && candidate.id ? candidate.id : createId("chapter");
    if (seenIds.has(id)) continue;
    seenIds.add(id);

    const cleanName =
      typeof candidate.name === "string" && candidate.name.trim().length > 0
        ? candidate.name.trim()
        : `Chapitre ${index + 1}`;

    normalized.push({
      id,
      name: cleanName,
      collapsed: candidate.collapsed === true,
      validated: candidate.validated === true,
    });
  }
  return normalized;
}

export function withCollapsedChapterFolders(
  nodes: EditorNode[],
  chapters: Chapter[],
): EditorNode[] {
  const baseNodes = nodes.filter((node) => node.type !== "chapterFolder");
  const collapsedChapters = chapters.filter((chapter) => chapter.collapsed && !chapter.validated);
  if (collapsedChapters.length === 0) return baseNodes;

  const chapterStartById = new Map<string, EditorNode>();
  for (const node of baseNodes) {
    const block = node.data.block as StoryBlock;
    if (block.type === "chapter_start" && block.chapterId) {
      chapterStartById.set(block.chapterId, node);
    }
  }

  const existingFolders = new Map(
    nodes
      .filter((node) => node.type === "chapterFolder")
      .map((node) => [node.id, node] as const),
  );

  const folderNodes: EditorNode[] = collapsedChapters.map((chapter) => {
    const folderId = `folder-${chapter.id}`;
    const existing = existingFolders.get(folderId);
    if (existing) return existing;

    const chapterStartNode = chapterStartById.get(chapter.id);
    return {
      id: folderId,
      type: "chapterFolder",
      position: chapterStartNode?.position ?? { x: 200, y: 200 },
      data: {
        block: {
          id: folderId,
          type: "chapter_start",
          name: chapter.name,
        } as unknown as StoryBlock,
        isStart: false,
        hasError: false,
        hasWarning: false,
      },
    };
  });

  return [...baseNodes, ...folderNodes];
}

function normalizeNameKey(name: string): string {
  return name.trim().toLowerCase();
}

export function allocateUniqueId(preferredId: string, prefix: string, usedIds: Set<string>): string {
  if (preferredId && !usedIds.has(preferredId)) {
    usedIds.add(preferredId);
    return preferredId;
  }

  let nextId = createId(prefix);
  while (usedIds.has(nextId)) {
    nextId = createId(prefix);
  }
  usedIds.add(nextId);
  return nextId;
}

function remapOptionalId(
  value: string | null | undefined,
  idMap: Map<string, string>,
): string | null {
  if (!value) return null;
  return idMap.get(value) ?? value;
}

function remapRequiredId(value: string, idMap: Map<string, string>): string {
  return idMap.get(value) ?? value;
}

function remapVariableEffects<T extends { variableId: string }>(
  effects: T[] | undefined,
  variableIdMap: Map<string, string>,
): T[] {
  if (!Array.isArray(effects) || effects.length === 0) return [];
  return effects.map((effect) => ({
    ...effect,
    variableId: remapRequiredId(effect.variableId, variableIdMap),
  }));
}

export function mergeVariablesForZipImport(
  currentVariables: ProjectMeta["variables"],
  importedVariables: ProjectMeta["variables"],
): {
  mergedVariables: ProjectMeta["variables"];
  variableIdMap: Map<string, string>;
} {
  const mergedVariables = [...currentVariables];
  const variableIdMap = new Map<string, string>();
  const usedVariableIds = new Set(currentVariables.map((variable) => variable.id));
  const existingVariableByName = new Map<string, string>();

  for (const variable of currentVariables) {
    const key = normalizeNameKey(variable.name);
    if (key && !existingVariableByName.has(key)) {
      existingVariableByName.set(key, variable.id);
    }
  }

  for (const variable of importedVariables) {
    if (variableIdMap.has(variable.id)) continue;
    const nameKey = normalizeNameKey(variable.name);
    const existingByNameId = nameKey ? existingVariableByName.get(nameKey) ?? null : null;
    if (existingByNameId) {
      variableIdMap.set(variable.id, existingByNameId);
      continue;
    }

    const mappedId = allocateUniqueId(variable.id, "var", usedVariableIds);
    variableIdMap.set(variable.id, mappedId);
    mergedVariables.push({
      ...variable,
      id: mappedId,
    });
    if (nameKey && !existingVariableByName.has(nameKey)) {
      existingVariableByName.set(nameKey, mappedId);
    }
  }

  return { mergedVariables, variableIdMap };
}

export function mergeItemsForZipImport(
  currentItems: ProjectMeta["items"],
  importedItems: ProjectMeta["items"],
): {
  mergedItems: ProjectMeta["items"];
  itemIdMap: Map<string, string>;
} {
  const mergedItems = [...currentItems];
  const itemIdMap = new Map<string, string>();
  const usedItemIds = new Set(currentItems.map((item) => item.id));
  const existingItemByName = new Map<string, string>();

  for (const item of currentItems) {
    const key = normalizeNameKey(item.name);
    if (key && !existingItemByName.has(key)) {
      existingItemByName.set(key, item.id);
    }
  }

  for (const item of importedItems) {
    if (itemIdMap.has(item.id)) continue;
    const nameKey = normalizeNameKey(item.name);
    const existingByNameId = nameKey ? existingItemByName.get(nameKey) ?? null : null;
    if (existingByNameId) {
      itemIdMap.set(item.id, existingByNameId);
      continue;
    }

    const mappedId = allocateUniqueId(item.id, "item", usedItemIds);
    itemIdMap.set(item.id, mappedId);
    mergedItems.push({
      ...item,
      id: mappedId,
    });
    if (nameKey && !existingItemByName.has(nameKey)) {
      existingItemByName.set(nameKey, mappedId);
    }
  }

  return { mergedItems, itemIdMap };
}

export function mergeChaptersForZipImport(
  currentChapters: ProjectMeta["chapters"],
  importedChapters: ProjectMeta["chapters"],
  importedBlocks: StoryBlock[],
): {
  mergedChapters: ProjectMeta["chapters"];
  chapterIdMap: Map<string, string>;
} {
  const mergedChapters = [...currentChapters];
  const chapterIdMap = new Map<string, string>();
  const usedChapterIds = new Set(currentChapters.map((chapter) => chapter.id));
  const importedChapterById = new Map(importedChapters.map((chapter) => [chapter.id, chapter] as const));
  const chapterNameFallbackById = new Map<string, string>();

  for (const block of importedBlocks) {
    if (block.type !== "chapter_start" || !block.chapterId) continue;
    const cleanTitle = block.chapterTitle.trim();
    if (cleanTitle && !chapterNameFallbackById.has(block.chapterId)) {
      chapterNameFallbackById.set(block.chapterId, cleanTitle);
    }
  }

  const encounteredChapterIds: string[] = [];
  const seenChapterIds = new Set<string>();
  for (const chapter of importedChapters) {
    if (!seenChapterIds.has(chapter.id)) {
      seenChapterIds.add(chapter.id);
      encounteredChapterIds.push(chapter.id);
    }
  }
  for (const block of importedBlocks) {
    if (!block.chapterId) continue;
    if (seenChapterIds.has(block.chapterId)) continue;
    seenChapterIds.add(block.chapterId);
    encounteredChapterIds.push(block.chapterId);
  }

  for (const oldChapterId of encounteredChapterIds) {
    const mappedChapterId = allocateUniqueId(oldChapterId, "chapter", usedChapterIds);
    chapterIdMap.set(oldChapterId, mappedChapterId);

    const importedChapter = importedChapterById.get(oldChapterId);
    const fallbackName = chapterNameFallbackById.get(oldChapterId);
    const chapterName = importedChapter?.name?.trim() || fallbackName || "Chapitre importe";

    mergedChapters.push({
      id: mappedChapterId,
      name: chapterName,
      collapsed: importedChapter?.collapsed ?? false,
      validated: importedChapter?.validated ?? false,
    });
  }

  return { mergedChapters, chapterIdMap };
}

export function mergeHeroForZipImport(
  currentHero: ProjectMeta["hero"],
  importedHero: ProjectMeta["hero"],
  variableIdMap: Map<string, string>,
  itemIdMap: Map<string, string>,
  availableVariableIds: Set<string>,
  availableItemIds: Set<string>,
): ProjectMeta["hero"] {
  const mergedBaseStats = [...currentHero.baseStats];
  const mergedNpcs = [...currentHero.npcs];
  const mergedInventory = [...currentHero.startingInventory];

  const usedBaseStatIds = new Set(mergedBaseStats.map((stat) => stat.id));
  const existingBaseStatsByVariableId = new Set(mergedBaseStats.map((stat) => stat.variableId));
  for (const stat of importedHero.baseStats) {
    const mappedVariableId = variableIdMap.get(stat.variableId) ?? stat.variableId;
    if (!availableVariableIds.has(mappedVariableId)) continue;
    if (existingBaseStatsByVariableId.has(mappedVariableId)) continue;

    const mappedStatId = allocateUniqueId(stat.id, "hero_stat", usedBaseStatIds);
    mergedBaseStats.push({
      ...stat,
      id: mappedStatId,
      variableId: mappedVariableId,
    });
    existingBaseStatsByVariableId.add(mappedVariableId);
  }

  const usedNpcIds = new Set(mergedNpcs.map((npc) => npc.id));
  const existingNpcNameKeys = new Set(
    mergedNpcs
      .map((npc) => normalizeNameKey(npc.name))
      .filter((nameKey) => nameKey.length > 0),
  );
  for (const npc of importedHero.npcs) {
    const nameKey = normalizeNameKey(npc.name);
    if (nameKey && existingNpcNameKeys.has(nameKey)) continue;

    const mappedNpcId = allocateUniqueId(npc.id, "npc", usedNpcIds);
    mergedNpcs.push({
      ...npc,
      id: mappedNpcId,
    });
    if (nameKey) {
      existingNpcNameKeys.add(nameKey);
    }
  }

  const usedHeroItemIds = new Set(mergedInventory.map((entry) => entry.id));
  const inventoryIndexByItemId = new Map<string, number>();
  for (let index = 0; index < mergedInventory.length; index += 1) {
    inventoryIndexByItemId.set(mergedInventory[index].itemId, index);
  }

  for (const entry of importedHero.startingInventory) {
    const mappedItemId = itemIdMap.get(entry.itemId) ?? entry.itemId;
    if (!availableItemIds.has(mappedItemId)) continue;

    const normalizedQuantity =
      Number.isFinite(entry.quantity) && entry.quantity > 0
        ? Math.floor(entry.quantity)
        : 1;
    const existingIndex = inventoryIndexByItemId.get(mappedItemId);
    if (existingIndex != null) {
      mergedInventory[existingIndex] = {
        ...mergedInventory[existingIndex],
        quantity: Math.max(mergedInventory[existingIndex].quantity, normalizedQuantity),
      };
      continue;
    }

    const mappedEntryId = allocateUniqueId(entry.id, "hero_item", usedHeroItemIds);
    mergedInventory.push({
      ...entry,
      id: mappedEntryId,
      itemId: mappedItemId,
      quantity: normalizedQuantity,
    });
    inventoryIndexByItemId.set(mappedItemId, mergedInventory.length - 1);
  }

  return {
    ...currentHero,
    baseStats: mergedBaseStats,
    npcs: mergedNpcs,
    startingInventory: mergedInventory,
  };
}

export interface ZipImportMergeMaps {
  blockIdMap: Map<string, string>;
  chapterIdMap: Map<string, string>;
  variableIdMap: Map<string, string>;
  itemIdMap: Map<string, string>;
}

export function remapBlockForZipImport(block: StoryBlock, maps: ZipImportMergeMaps): StoryBlock {
  const remappedCore = {
    id: remapRequiredId(block.id, maps.blockIdMap),
    chapterId: remapOptionalId(block.chapterId, maps.chapterIdMap),
    entryEffects: remapVariableEffects(block.entryEffects, maps.variableIdMap),
  };

  if (block.type === "dialogue") {
    return normalizeStoryBlock({
      ...block,
      ...remappedCore,
      npcProfileBlockId: remapOptionalId(block.npcProfileBlockId, maps.blockIdMap),
      lines: block.lines.map((line) => ({
        ...line,
        continueTargetBlockId: remapOptionalId(line.continueTargetBlockId, maps.blockIdMap),
        conditions: line.conditions.map((condition) => ({
          ...condition,
          npcProfileBlockId: remapRequiredId(condition.npcProfileBlockId, maps.blockIdMap),
        })),
        responses: line.responses.map((response) => ({
          ...response,
          targetBlockId: remapOptionalId(response.targetBlockId, maps.blockIdMap),
          effects: remapVariableEffects(response.effects, maps.variableIdMap),
          affinityEffects: response.affinityEffects.map((affinityEffect) => ({
            ...affinityEffect,
            npcProfileBlockId: remapRequiredId(affinityEffect.npcProfileBlockId, maps.blockIdMap),
          })),
        })),
      })),
    });
  }

  if (block.type === "choice") {
    return normalizeStoryBlock({
      ...block,
      ...remappedCore,
      choices: block.choices.map((choice) => ({
        ...choice,
        targetBlockId: remapOptionalId(choice.targetBlockId, maps.blockIdMap),
        heroMemoryVariableId: remapOptionalId(choice.heroMemoryVariableId, maps.variableIdMap),
        effects: remapVariableEffects(choice.effects, maps.variableIdMap),
      })),
    });
  }

  if (block.type === "switch") {
    return normalizeStoryBlock({
      ...block,
      ...remappedCore,
      variableId: remapOptionalId(block.variableId, maps.variableIdMap),
      cases: block.cases.map((item) => ({
        ...item,
        conditions: item.conditions.map((condition) => ({
          ...condition,
          variableId: remapOptionalId(condition.variableId, maps.variableIdMap),
          npcProfileBlockId: remapOptionalId(condition.npcProfileBlockId, maps.blockIdMap),
          choiceBlockId: remapOptionalId(condition.choiceBlockId, maps.blockIdMap),
        })),
        choiceConditions: item.choiceConditions.map((condition) => ({
          ...condition,
          choiceBlockId: remapOptionalId(condition.choiceBlockId, maps.blockIdMap),
        })),
        choiceBlockId: remapOptionalId(item.choiceBlockId, maps.blockIdMap),
        targetBlockId: remapOptionalId(item.targetBlockId, maps.blockIdMap),
      })),
      nextBlockId: remapOptionalId(block.nextBlockId, maps.blockIdMap),
    });
  }

  if (block.type === "gameplay") {
    const remappedHotspots = block.hotspots?.map((hotspot) => ({
      ...hotspot,
      requiredItemId: remapOptionalId(hotspot.requiredItemId, maps.itemIdMap),
      effects: remapVariableEffects(hotspot.effects, maps.variableIdMap),
      onClickActions: hotspot.onClickActions.map((action) => {
        if (action.type === "add_item") {
          return {
            ...action,
            itemId: remapOptionalId(action.itemId, maps.itemIdMap),
          };
        }
        if (action.type === "go_to_block") {
          return {
            ...action,
            targetBlockId: remapOptionalId(action.targetBlockId, maps.blockIdMap),
          };
        }
        return action;
      }),
    }));

    return normalizeStoryBlock({
      ...block,
      ...remappedCore,
      nextBlockId: remapOptionalId(block.nextBlockId, maps.blockIdMap),
      buttonSequenceSuccessBlockId: remapOptionalId(
        block.buttonSequenceSuccessBlockId,
        maps.blockIdMap,
      ),
      buttonSequenceFailureBlockId: remapOptionalId(
        block.buttonSequenceFailureBlockId,
        maps.blockIdMap,
      ),
      completionEffects: remapVariableEffects(block.completionEffects, maps.variableIdMap),
      objects: block.objects.map((obj) => ({
        ...obj,
        grantItemId: remapOptionalId(obj.grantItemId, maps.itemIdMap),
        requiredItemId: remapOptionalId(obj.requiredItemId, maps.itemIdMap),
        targetBlockId: remapOptionalId(obj.targetBlockId, maps.blockIdMap),
        effects: remapVariableEffects(obj.effects, maps.variableIdMap),
      })),
      links: block.links?.map((link) => ({
        ...link,
        resultBlockId: remapOptionalId(link.resultBlockId, maps.blockIdMap),
      })),
      hotspots: remappedHotspots,
    });
  }

  if (block.type === "title") {
    return normalizeStoryBlock({
      ...block,
      ...remappedCore,
      nextBlockId: remapOptionalId(block.nextBlockId, maps.blockIdMap),
    });
  }

  if (block.type === "cinematic") {
    return normalizeStoryBlock({
      ...block,
      ...remappedCore,
      nextBlockId: remapOptionalId(block.nextBlockId, maps.blockIdMap),
    });
  }

  if (block.type === "hero_profile") {
    return normalizeStoryBlock({
      ...block,
      ...remappedCore,
      nextBlockId: remapOptionalId(block.nextBlockId, maps.blockIdMap),
    });
  }

  if (block.type === "npc_profile") {
    return normalizeStoryBlock({
      ...block,
      ...remappedCore,
      nextBlockId: remapOptionalId(block.nextBlockId, maps.blockIdMap),
    });
  }

  if (block.type === "chapter_start") {
    return normalizeStoryBlock({
      ...block,
      ...remappedCore,
      chapterId: remapOptionalId(block.chapterId, maps.chapterIdMap),
      linkedFromChapterId: remapOptionalId(block.linkedFromChapterId, maps.chapterIdMap),
      linkedFromChapterEndBlockId: remapOptionalId(block.linkedFromChapterEndBlockId, maps.blockIdMap),
      nextBlockId: remapOptionalId(block.nextBlockId, maps.blockIdMap),
    });
  }

  return normalizeStoryBlock({
    ...block,
    ...remappedCore,
    nextBlockId: remapOptionalId(block.nextBlockId, maps.blockIdMap),
  });
}

function computeNodeBounds(nodes: EditorNode[]): {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
} | null {
  if (nodes.length === 0) return null;
  let minX = nodes[0].position.x;
  let maxX = nodes[0].position.x;
  let minY = nodes[0].position.y;
  let maxY = nodes[0].position.y;

  for (const node of nodes) {
    minX = Math.min(minX, node.position.x);
    maxX = Math.max(maxX, node.position.x);
    minY = Math.min(minY, node.position.y);
    maxY = Math.max(maxY, node.position.y);
  }
  return { minX, maxX, minY, maxY };
}

function offsetNodes(nodes: EditorNode[], offsetX: number, offsetY: number): EditorNode[] {
  if (offsetX === 0 && offsetY === 0) return nodes;
  return nodes.map((node) => ({
    ...node,
    position: {
      x: Math.round(node.position.x + offsetX),
      y: Math.round(node.position.y + offsetY),
    },
  }));
}

function hasApproximateNodeOverlap(existingNodes: EditorNode[], incomingNodes: EditorNode[]): boolean {
  const HORIZONTAL_THRESHOLD = 340;
  const VERTICAL_THRESHOLD = 220;
  for (const incoming of incomingNodes) {
    for (const existing of existingNodes) {
      const nearX = Math.abs(existing.position.x - incoming.position.x) < HORIZONTAL_THRESHOLD;
      const nearY = Math.abs(existing.position.y - incoming.position.y) < VERTICAL_THRESHOLD;
      if (nearX && nearY) return true;
    }
  }
  return false;
}

export function placeImportedNodes(existingNodes: EditorNode[], importedNodes: EditorNode[]): EditorNode[] {
  if (importedNodes.length === 0 || existingNodes.length === 0) return importedNodes;
  const existingBounds = computeNodeBounds(existingNodes);
  const importedBounds = computeNodeBounds(importedNodes);
  if (!existingBounds || !importedBounds) return importedNodes;

  const initialOffsetX = existingBounds.maxX - importedBounds.minX + 700;
  const initialOffsetY = existingBounds.minY - importedBounds.minY;
  let shiftedNodes = offsetNodes(importedNodes, initialOffsetX, initialOffsetY);

  let safety = 0;
  while (hasApproximateNodeOverlap(existingNodes, shiftedNodes) && safety < 16) {
    shiftedNodes = offsetNodes(shiftedNodes, 520, 0);
    safety += 1;
  }

  return shiftedNodes;
}


