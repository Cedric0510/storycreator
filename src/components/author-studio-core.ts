import { Edge, MarkerType, Node } from "@xyflow/react";

import { StoryNodeData } from "@/components/StoryNode";
import {
  AssetRef,
  CharacterLayer,
  ChoiceLabel,
  DEFAULT_CHARACTER_LAYOUT,
  DEFAULT_SCENE_LAYOUT,
  DialogueBlock,
  DialogueLine,
  DialogueResponse,
  GameplayBlock,
  GameplayHotspotClickAction,
  GameplayHotspotClickActionType,
  GameplayHotspot,
  GameplayOverlay,
  ProjectMeta,
  STORY_SCHEMA_VERSION,
  StoryBlock,
  TitleBlock,
  createDefaultHeroProfile,
  createBlock,
  createGameplayHotspotClickAction,
  createId,
  normalizeStoryBlock,
} from "@/lib/story";

export type EditorNode = Node<StoryNodeData>;
export type EditorEdge = Edge<{ label?: string }>;

export interface InitialStudio {
  nodes: EditorNode[];
  edges: EditorEdge[];
  project: ProjectMeta;
}

export interface CloudPayload {
  project: ProjectMeta;
  nodes: EditorNode[];
  edges: EditorEdge[];
  assetRefs: Record<string, AssetRef>;
}

export function choiceLabelFromHandle(handle: string | null | undefined) {
  if (!handle) return null;
  const match = /^choice-([A-D])$/.exec(handle);
  return match ? (match[1] as ChoiceLabel) : null;
}

export function responseIdFromHandle(handle: string | null | undefined): string | null {
  if (!handle) return null;
  const match = /^resp-(.+)$/.exec(handle);
  return match ? match[1] : null;
}

export function lineIdFromHandle(handle: string | null | undefined): string | null {
  if (!handle) return null;
  const match = /^line-(.+)$/.exec(handle);
  return match ? match[1] : null;
}

export function buildEdge(source: string, target: string, sourceHandle: string, label?: string, targetHandle?: string): EditorEdge {
  const derivedLabel = label ?? (sourceHandle === "npc-link" ? "PNJ" : choiceLabelFromHandle(sourceHandle));
  const isNpcLink = sourceHandle === "npc-link";
  const isSelfEdge = source === target;

  return {
    id: createId("edge"),
    type: "deletable",
    source,
    target,
    sourceHandle,
    ...(isSelfEdge ? { zIndex: 1001 } : {}),
    markerEnd: {
      type: MarkerType.ArrowClosed,
      color: isSelfEdge ? "#6366f1" : "#0f172a",
    },
    style: {
      stroke: isSelfEdge ? "#6366f1" : isNpcLink ? "#0ea5e9" : "#0f172a",
      strokeWidth: isSelfEdge ? 2.2 : 1.8,
      strokeDasharray: isNpcLink ? "6 4" : undefined,
    },
    ...(targetHandle ? { targetHandle } : {}),
    label: derivedLabel,
    data: { label: derivedLabel ?? undefined },
  };
}

export function blockToNode(block: StoryBlock): EditorNode {
  const normalizedBlock = normalizeStoryBlock(block);
  return {
    id: normalizedBlock.id,
    type: "storyBlock",
    position: normalizedBlock.position,
    data: {
      block: normalizedBlock,
      isStart: false,
      hasError: false,
      hasWarning: false,
    },
  };
}

export function rebuildEdgesFromNodes(nodes: EditorNode[]): EditorEdge[] {
  const edges: EditorEdge[] = [];
  for (const node of nodes) {
    const block = node.data.block;

    if (block.type === "dialogue") {
      for (const line of block.lines) {
        for (const resp of line.responses) {
          if (resp.targetBlockId) {
            const tgtHandle = resp.targetLineId ? `line-${resp.targetLineId}` : undefined;
            edges.push(buildEdge(block.id, resp.targetBlockId, `resp-${resp.id}`, resp.label, tgtHandle));
          } else if (resp.targetLineId) {
            // Internal self-edge within same block
            edges.push(buildEdge(block.id, block.id, `resp-${resp.id}`, resp.label, `line-${resp.targetLineId}`));
          }
        }
      }
      if (block.npcProfileBlockId) {
        edges.push(buildEdge(block.npcProfileBlockId, block.id, "npc-link"));
      }
    } else if (block.type === "choice") {
      for (const option of block.choices) {
        if (option.targetBlockId) {
          edges.push(buildEdge(block.id, option.targetBlockId, `choice-${option.label}`));
        }
      }
    } else if (block.type !== "hero_profile" && block.type !== "npc_profile") {
      if (block.nextBlockId) {
        edges.push(buildEdge(block.id, block.nextBlockId, "next"));
      }
    }
  }
  return edges;
}

export function toSlug(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

export function generateUuid() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (token) => {
    const random = Math.floor(Math.random() * 16);
    const value = token === "x" ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

export function formatDbError(
  prefix: string,
  error: { message: string; code?: string | null; details?: string | null; hint?: string | null } | null,
) {
  if (!error) return `${prefix}: unknown`;

  const parts = [error.message];
  if (error.code) parts.push(`code=${error.code}`);
  if (error.details) parts.push(`details=${error.details}`);
  if (error.hint) parts.push(`hint=${error.hint}`);
  return `${prefix}: ${parts.join(" | ")}`;
}

export function blockFromNode(node: EditorNode): StoryBlock {
  const block: StoryBlock = {
    ...node.data.block,
    position: node.position,
  };

  return normalizeStoryBlock(block);
}

export function collectAssetIds(block: StoryBlock) {
  if (block.type === "title") {
    return block.backgroundAssetId ? [block.backgroundAssetId] : [];
  }
  if (block.type === "cinematic") {
    return [block.backgroundAssetId, block.characterAssetId, block.videoAssetId, block.voiceAssetId].filter(
      (value): value is string => Boolean(value),
    );
  }
  if (block.type === "dialogue") {
    const lineVoiceIds = (block.lines ?? [])
      .map((line) => line.voiceAssetId)
      .filter((value): value is string => Boolean(value));
    const layerAssetIds = (block.characterLayers ?? [])
      .map((layer) => layer.assetId)
      .filter((value): value is string => Boolean(value));
    return [block.backgroundAssetId, block.characterAssetId, block.npcImageAssetId, ...layerAssetIds, ...lineVoiceIds].filter(
      (value): value is string => Boolean(value),
    );
  }
  if (block.type === "choice") {
    const optionImageIds = block.choices
      .map((option) => option.imageAssetId)
      .filter((value): value is string => Boolean(value));
    return [block.backgroundAssetId, block.voiceAssetId, ...optionImageIds].filter(
      (value): value is string => Boolean(value),
    );
  }
  if (block.type === "hero_profile") {
    return [];
  }
  if (block.type === "npc_profile") {
    return block.imageAssetIds.filter((value): value is string => Boolean(value));
  }
  if (block.type === "chapter_start" || block.type === "chapter_end") {
    return [];
  }
  const objectAssetIds = block.objects
    .map((obj) => obj.assetId)
    .filter((value): value is string => Boolean(value));
  const objectSoundIds = block.objects
    .map((obj) => obj.soundAssetId)
    .filter((value): value is string => Boolean(value));
  return [block.backgroundAssetId, block.voiceAssetId, ...objectAssetIds, ...objectSoundIds].filter(
    (value): value is string => Boolean(value),
  );
}

export function collectReferencedAssetIds(blocks: StoryBlock[]) {
  const referencedAssetIds = new Set<string>();
  for (const block of blocks) {
    for (const assetId of collectAssetIds(block)) {
      referencedAssetIds.add(assetId);
    }
  }
  return referencedAssetIds;
}

export function collectProjectReferencedAssetIds(
  project: Pick<ProjectMeta, "items">,
  blocks: StoryBlock[],
) {
  const referencedAssetIds = collectReferencedAssetIds(blocks);
  const items = Array.isArray(project.items) ? project.items : [];
  for (const item of items) {
    if (item.iconAssetId) {
      referencedAssetIds.add(item.iconAssetId);
    }
  }
  return referencedAssetIds;
}

export function clampPercent(value: number) {
  if (Number.isNaN(value) || !Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 100) return 100;
  return Number(value.toFixed(2));
}

export function normalizeRectPercent(rect: { x: number; y: number; width: number; height: number }) {
  return {
    x: clampPercent(rect.x),
    y: clampPercent(rect.y),
    width: clampPercent(rect.width <= 0 ? 1 : rect.width),
    height: clampPercent(rect.height <= 0 ? 1 : rect.height),
  };
}

export function defaultGameplayOverlayDraft(): GameplayOverlay {
  return {
    id: createId("overlay"),
    name: "Objet",
    assetId: null,
    x: 35,
    y: 35,
    width: 20,
    height: 20,
    zIndex: 2,
    visibleByDefault: true,
    draggable: false,
  };
}

export function defaultGameplayHotspotDraft(): GameplayHotspot {
  return {
    id: createId("hotspot"),
    name: "Zone",
    required: true,
    message: "",
    toggleOverlayId: null,
    soundAssetId: null,
    effects: [],
    onClickActions: [],
    requiredItemId: null,
    consumeRequiredItem: false,
    lockedMessage: "",
    acceptOverlayId: null,
    x: 35,
    y: 35,
    width: 20,
    height: 20,
  };
}

export function defaultGameplayHotspotActionDraft(
  type: GameplayHotspotClickActionType = "message",
): GameplayHotspotClickAction {
  return createGameplayHotspotClickAction(type);
}

/** V3: IDs of objects that are interactive (not "decoration"). */
export function interactiveObjectIds(block: GameplayBlock): string[] {
  return block.objects
    .filter((obj) => obj.objectType !== "decoration")
    .map((obj) => obj.id);
}

export function requiredHotspotIds(block: GameplayBlock) {
  // Legacy compat — if the block still has hotspots (should not after normalization)
  if (Array.isArray(block.hotspots) && block.hotspots.length > 0) {
    const required = block.hotspots.filter((hotspot) => hotspot.required).map((hotspot) => hotspot.id);
    if (required.length > 0) return required;
    return block.hotspots.map((hotspot) => hotspot.id);
  }
  return interactiveObjectIds(block);
}

export function isGameplayCompleted(block: GameplayBlock, interactedObjectIds: Set<string>) {
  if (block.objects.length === 0) return true;
  const mustInteract = interactiveObjectIds(block);
  return mustInteract.every((id) => interactedObjectIds.has(id));
}

/** @deprecated Legacy V1 completion check — kept for backward compat */
export function isGameplayPointClickCompleted(block: GameplayBlock, foundHotspotIds: Set<string>) {
  return isGameplayCompleted(block, foundHotspotIds);
}

export async function fileToDataUrl(file: File) {
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function buildInitialStudio(): InitialStudio {
  const titleBlock = createBlock("title", { x: 70, y: 120 }) as TitleBlock;
  const introBlock = createBlock("cinematic", { x: 410, y: 120 });
  const dialogueBlock = createBlock("dialogue", { x: 760, y: 280 }) as DialogueBlock;

  titleBlock.name = "Accueil histoire";
  titleBlock.storyTitle = "Nouvelle histoire";
  titleBlock.subtitle = "Un moteur de light novel";
  titleBlock.nextBlockId = introBlock.id;

  if (introBlock.type === "cinematic") {
    introBlock.name = "Scene intro";
    introBlock.heading = "Prologue";
    introBlock.body = "L'aube se leve sur la ville. Le joueur rejoint son equipe.";
    introBlock.nextBlockId = dialogueBlock.id;
  }

  dialogueBlock.name = "Premier choix";
  dialogueBlock.lines[0].speaker = "Ami";
  dialogueBlock.lines[0].text = "As-tu bien dormi ?";
  dialogueBlock.lines[0].responses = dialogueBlock.lines[0].responses.map((resp) => {
    if (resp.label === "A") return { ...resp, text: "Oui" };
    if (resp.label === "B") return { ...resp, text: "Non" };
    return resp;
  });

  const nodes = [blockToNode(titleBlock), blockToNode(introBlock), blockToNode(dialogueBlock)];
  const edges = [
    buildEdge(titleBlock.id, introBlock.id, "next"),
    buildEdge(introBlock.id, dialogueBlock.id, "next"),
  ];

  const ownerId = createId("member");
  const editorId = createId("member");

  const project: ProjectMeta = {
    info: {
      id: createId("project"),
      title: "Untitled Story",
      slug: "untitled-story",
      synopsis: "Prototype light novel data-driven.",
      startBlockId: titleBlock.id,
      schemaVersion: STORY_SCHEMA_VERSION,
      updatedAt: new Date().toISOString(),
    },
    variables: [
      { id: createId("var"), name: "energie", initialValue: 0 },
      { id: createId("var"), name: "relation_ami", initialValue: 0 },
    ],
    items: [],
    hero: createDefaultHeroProfile(),
    members: [
      { id: ownerId, name: "Auteur A", role: "owner" },
      { id: editorId, name: "Auteur B", role: "editor" },
    ],
    activeMemberId: ownerId,
    editingLockMemberId: ownerId,
    chapters: [],
    logs: [
      {
        id: createId("log"),
        memberId: ownerId,
        timestamp: new Date().toISOString(),
        action: "project_init",
        details: "Projet initialise avec 3 blocs de base.",
      },
    ],
  };

  return { nodes, edges, project };
}

export function describeEffect(delta: number) {
  return delta > 0 ? `+${delta}` : `${delta}`;
}

export function normalizeDelta(value: string) {
  const parsed = Number(value);
  if (Number.isNaN(parsed) || !Number.isFinite(parsed)) return 0;
  return parsed;
}

export function removeNodeReferences(block: StoryBlock, removedBlockId: string): StoryBlock {
  if (block.type === "dialogue") {
    return {
      ...block,
      npcProfileBlockId:
        block.npcProfileBlockId === removedBlockId ? null : block.npcProfileBlockId,
      npcImageAssetId: block.npcProfileBlockId === removedBlockId ? null : block.npcImageAssetId,
      lines: block.lines.map((line) => ({
        ...line,
        responses: line.responses.map((resp) =>
          resp.targetBlockId === removedBlockId
            ? { ...resp, targetBlockId: null }
            : resp,
        ),
      })),
    };
  }

  if (block.type === "choice") {
    return {
      ...block,
      choices: block.choices.map((option) =>
        option.targetBlockId === removedBlockId
          ? { ...option, targetBlockId: null }
          : option,
      ),
    };
  }

  if (block.type === "gameplay") {
    return {
      ...block,
      nextBlockId: block.nextBlockId === removedBlockId ? null : block.nextBlockId,
    };
  }

  if (block.nextBlockId === removedBlockId) {
    return { ...block, nextBlockId: null };
  }

  return block;
}

export function removeVariableReferences(block: StoryBlock, removedVariableId: string): StoryBlock {
  const nextEntryEffects = (block.entryEffects ?? []).filter(
    (effect) => effect.variableId !== removedVariableId,
  );

  if (block.type === "dialogue") {
    return {
      ...block,
      entryEffects: nextEntryEffects,
      lines: block.lines.map((line) => ({
        ...line,
        responses: line.responses.map((resp) => ({
          ...resp,
          effects: resp.effects.filter((effect) => effect.variableId !== removedVariableId),
        })),
      })),
    };
  }

  if (block.type === "choice") {
    return {
      ...block,
      entryEffects: nextEntryEffects,
      choices: block.choices.map((option) => ({
        ...option,
        effects: option.effects.filter((effect) => effect.variableId !== removedVariableId),
      })),
    };
  }

  if (block.type === "gameplay") {
    return {
      ...block,
      entryEffects: nextEntryEffects,
      objects: block.objects.map((obj) => ({
        ...obj,
        effects: obj.effects.filter((effect) => effect.variableId !== removedVariableId),
      })),
      completionEffects: block.completionEffects.filter(
        (effect) => effect.variableId !== removedVariableId,
      ),
    };
  }

  return {
    ...block,
    entryEffects: nextEntryEffects,
  };
}

export function removeItemReferences(block: StoryBlock, removedItemId: string): StoryBlock {
  if (block.type !== "gameplay") {
    return block;
  }

  return {
    ...block,
    objects: block.objects.map((obj) =>
      obj.grantItemId === removedItemId
        ? { ...obj, grantItemId: null }
        : obj,
    ),
  };
}

export function applyEffects(
  currentVariables: Record<string, number>,
  effects: { variableId: string; delta: number }[],
) {
  const next = { ...currentVariables };
  for (const effect of effects) {
    next[effect.variableId] = (next[effect.variableId] ?? 0) + effect.delta;
  }
  return next;
}

function serializeEffects(
  effects: { variableId: string; delta: number }[],
  variableNameById: Map<string, string>,
) {
  return effects.map((effect) => ({
    variableId: effect.variableId,
    variableName: variableNameById.get(effect.variableId) ?? "unknown",
    delta: effect.delta,
  }));
}

export function assetPath(assetId: string | null, assetRefs: Record<string, AssetRef>) {
  if (!assetId) return null;
  return assetRefs[assetId]?.packagePath ?? null;
}

export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function serializeBlock(
  block: StoryBlock,
  variableNameById: Map<string, string>,
  assetRefs: Record<string, AssetRef>,
) {
  const chapterId = block.chapterId ?? null;

  if (block.type === "chapter_start") {
    return {
      id: block.id,
      type: block.type,
      name: block.name,
      position: block.position,
      notes: block.notes,
      chapterId,
      entryEffects: serializeEffects(block.entryEffects ?? [], variableNameById),
      chapterTitle: block.chapterTitle,
      nextBlockId: block.nextBlockId,
    };
  }

  if (block.type === "chapter_end") {
    return {
      id: block.id,
      type: block.type,
      name: block.name,
      position: block.position,
      notes: block.notes,
      chapterId,
      entryEffects: serializeEffects(block.entryEffects ?? [], variableNameById),
      nextBlockId: block.nextBlockId,
    };
  }

  if (block.type === "title") {
    return {
      id: block.id,
      type: block.type,
      name: block.name,
      position: block.position,
      notes: block.notes,
      chapterId,
      entryEffects: serializeEffects(block.entryEffects ?? [], variableNameById),
      storyTitle: block.storyTitle,
      subtitle: block.subtitle,
      backgroundPath: assetPath(block.backgroundAssetId, assetRefs),
      buttonStyle: block.buttonStyle,
      nextBlockId: block.nextBlockId,
    };
  }

  if (block.type === "cinematic") {
    return {
      id: block.id,
      type: block.type,
      name: block.name,
      position: block.position,
      notes: block.notes,
      chapterId,
      entryEffects: serializeEffects(block.entryEffects ?? [], variableNameById),
      heading: block.heading,
      body: block.body,
      backgroundPath: assetPath(block.backgroundAssetId, assetRefs),
      characterPath: assetPath(block.characterAssetId, assetRefs),
      sceneLayout: block.sceneLayout,
      videoPath: assetPath(block.videoAssetId, assetRefs),
      voicePath: assetPath(block.voiceAssetId, assetRefs),
      autoAdvanceSeconds: block.autoAdvanceSeconds,
      nextBlockId: block.nextBlockId,
    };
  }

  if (block.type === "dialogue") {
    return {
      id: block.id,
      type: block.type,
      name: block.name,
      position: block.position,
      notes: block.notes,
      chapterId,
      entryEffects: serializeEffects(block.entryEffects ?? [], variableNameById),
      backgroundPath: assetPath(block.backgroundAssetId, assetRefs),
      characterPath: assetPath(block.characterAssetId, assetRefs),
      sceneLayout: block.sceneLayout,
      npcProfileBlockId: block.npcProfileBlockId,
      npcImageAssetId: block.npcImageAssetId,
      npcImagePath: assetPath(block.npcImageAssetId, assetRefs),
      characterLayers: (block.characterLayers ?? []).map((layer) => ({
        id: layer.id,
        label: layer.label,
        zIndex: layer.zIndex,
        layout: layer.layout,
        assetId: layer.assetId,
        imagePath: assetPath(layer.assetId, assetRefs),
      })),
      startLineId: block.startLineId,
      lines: (block.lines ?? []).map((line) => ({
        id: line.id,
        speaker: line.speaker,
        text: line.text,
        voicePath: assetPath(line.voiceAssetId, assetRefs),
        conditions: line.conditions,
        fallbackLineId: line.fallbackLineId,
        responses: line.responses.map((resp) => ({
          id: resp.id,
          label: resp.label,
          text: resp.text,
          targetLineId: resp.targetLineId,
          targetBlockId: resp.targetBlockId,
          effects: serializeEffects(resp.effects, variableNameById),
          affinityEffects: resp.affinityEffects,
        })),
      })),
    };
  }

  if (block.type === "choice") {
    return {
      id: block.id,
      type: block.type,
      name: block.name,
      position: block.position,
      notes: block.notes,
      chapterId,
      entryEffects: serializeEffects(block.entryEffects ?? [], variableNameById),
      prompt: block.prompt,
      backgroundPath: assetPath(block.backgroundAssetId, assetRefs),
      voicePath: assetPath(block.voiceAssetId, assetRefs),
      choices: block.choices.map((option) => ({
        id: option.id,
        label: option.label,
        text: option.text,
        description: option.description,
        imagePath: assetPath(option.imageAssetId, assetRefs),
        targetBlockId: option.targetBlockId,
        effects: serializeEffects(option.effects, variableNameById),
      })),
    };
  }

  if (block.type === "hero_profile") {
    return {
      id: block.id,
      type: block.type,
      name: block.name,
      position: block.position,
      notes: block.notes,
      chapterId,
      entryEffects: serializeEffects(block.entryEffects ?? [], variableNameById),
    };
  }

  if (block.type === "npc_profile") {
    return {
      id: block.id,
      type: block.type,
      name: block.name,
      position: block.position,
      notes: block.notes,
      chapterId,
      entryEffects: serializeEffects(block.entryEffects ?? [], variableNameById),
      npcName: block.npcName,
      npcLore: block.npcLore,
      initialAffinity: block.initialAffinity,
      defaultImageAssetId: block.defaultImageAssetId,
      defaultImagePath: assetPath(block.defaultImageAssetId, assetRefs),
      images: block.imageAssetIds.map((assetId) => ({
        assetId,
        path: assetPath(assetId, assetRefs),
      })),
    };
  }

  return {
    id: block.id,
    type: block.type,
    name: block.name,
    position: block.position,
    notes: block.notes,
    chapterId,
    entryEffects: serializeEffects(block.entryEffects ?? [], variableNameById),
    mode: "point_and_click",
    objective: block.objective,
    backgroundPath: assetPath(block.backgroundAssetId, assetRefs),
    sceneLayout: block.sceneLayout,
    voicePath: assetPath(block.voiceAssetId, assetRefs),
    objects: block.objects.map((obj) => ({
      id: obj.id,
      name: obj.name,
      x: obj.x,
      y: obj.y,
      width: obj.width,
      height: obj.height,
      zIndex: obj.zIndex,
      visibleByDefault: obj.visibleByDefault,
      objectType: obj.objectType,
      grantItemId: obj.grantItemId,
      linkedKeyId: obj.linkedKeyId,
      unlockEffect: obj.unlockEffect,
      lockedMessage: obj.lockedMessage,
      successMessage: obj.successMessage,
      soundPath: assetPath(obj.soundAssetId, assetRefs),
      imagePath: assetPath(obj.assetId, assetRefs),
      effects: serializeEffects(obj.effects, variableNameById),
    })),
    completionEffects: serializeEffects(block.completionEffects, variableNameById),
    nextBlockId: block.nextBlockId,
  };
}

/**
 * Reverse-map an asset packagePath back to its assetId using the pathToAssetId index.
 * Returns null if path is falsy or not found.
 */
function resolveAssetId(path: unknown, pathToAssetId: Map<string, string>): string | null {
  if (typeof path !== "string" || !path) return null;
  return pathToAssetId.get(path) ?? null;
}

/**
 * Reconstruct a StoryBlock from an exported (serialized) block inside story.json.
 * `pathToAssetId` maps each `assets/...` packagePath → the new local assetId.
 */
export function deserializeBlockFromExport(
  raw: Record<string, unknown>,
  pathToAssetId: Map<string, string>,
): StoryBlock | null {
  const type = raw.type as string | undefined;
  if (!type) return null;

  const base = {
    id: (raw.id as string) ?? createId(type),
    name: (raw.name as string) ?? "",
    notes: (raw.notes as string) ?? "",
    position: (raw.position as { x: number; y: number }) ?? { x: 0, y: 0 },
    entryEffects: deserializeEffects(raw.entryEffects),
    chapterId: typeof raw.chapterId === "string" ? raw.chapterId : null,
  };

  if (type === "chapter_start") {
    return normalizeStoryBlock({
      ...base,
      type: "chapter_start",
      chapterTitle: (raw.chapterTitle as string) ?? "Chapitre",
      nextBlockId: (raw.nextBlockId as string) ?? null,
    });
  }

  if (type === "chapter_end") {
    return normalizeStoryBlock({
      ...base,
      type: "chapter_end",
      nextBlockId: (raw.nextBlockId as string) ?? null,
    });
  }

  if (type === "title") {
    return normalizeStoryBlock({
      ...base,
      type: "title",
      storyTitle: (raw.storyTitle as string) ?? "",
      subtitle: (raw.subtitle as string) ?? "",
      backgroundAssetId: resolveAssetId(raw.backgroundPath, pathToAssetId),
      buttonStyle: (raw.buttonStyle as TitleBlock["buttonStyle"]) ?? {
        backgroundColor: "#2563eb",
        textColor: "#f8fafc",
        borderColor: "#1d4ed8",
        radius: 14,
        fontSize: 16,
      },
      nextBlockId: (raw.nextBlockId as string) ?? null,
    });
  }

  if (type === "cinematic") {
    return normalizeStoryBlock({
      ...base,
      type: "cinematic",
      heading: (raw.heading as string) ?? "",
      body: (raw.body as string) ?? "",
      backgroundAssetId: resolveAssetId(raw.backgroundPath, pathToAssetId),
      characterAssetId: resolveAssetId(raw.characterPath, pathToAssetId),
      sceneLayout: raw.sceneLayout
        ? (raw.sceneLayout as typeof DEFAULT_SCENE_LAYOUT)
        : { ...DEFAULT_SCENE_LAYOUT },
      videoAssetId: resolveAssetId(raw.videoPath, pathToAssetId),
      voiceAssetId: resolveAssetId(raw.voicePath, pathToAssetId),
      autoAdvanceSeconds:
        typeof raw.autoAdvanceSeconds === "number" ? raw.autoAdvanceSeconds : null,
      nextBlockId: (raw.nextBlockId as string) ?? null,
    });
  }

  if (type === "dialogue") {
    const rawLines = Array.isArray(raw.lines) ? raw.lines : [];
    const lines: DialogueLine[] = rawLines.map((line: Record<string, unknown>) => ({
      id: (line.id as string) ?? createId("dline"),
      speaker: (line.speaker as string) ?? "Narrateur",
      text: (line.text as string) ?? "",
      voiceAssetId: resolveAssetId(line.voicePath, pathToAssetId),
      conditions: Array.isArray(line.conditions) ? line.conditions as DialogueLine["conditions"] : [],
      fallbackLineId: typeof line.fallbackLineId === "string" ? line.fallbackLineId : null,
      responses: Array.isArray(line.responses)
        ? (line.responses as Record<string, unknown>[]).map(
            (resp): DialogueResponse => ({
              id: (resp.id as string) ?? createId("resp"),
              label: ((resp.label as string) ?? "A") as ChoiceLabel,
              text: (resp.text as string) ?? "",
              targetLineId: (resp.targetLineId as string) ?? null,
              targetBlockId: (resp.targetBlockId as string) ?? null,
              effects: deserializeEffects(resp.effects),
              affinityEffects: Array.isArray(resp.affinityEffects) ? resp.affinityEffects as DialogueResponse["affinityEffects"] : [],
            }),
          )
        : [],
    }));

    const rawCharLayers = Array.isArray(raw.characterLayers) ? raw.characterLayers : [];
    const characterLayers: DialogueBlock["characterLayers"] = rawCharLayers.map(
      (layer: Record<string, unknown>) => ({
        id: (layer.id as string) ?? createId("clayer"),
        assetId: resolveAssetId(layer.imagePath, pathToAssetId) ?? (typeof layer.assetId === "string" ? layer.assetId : null),
        label: (layer.label as string) ?? "Perso",
        zIndex: typeof layer.zIndex === "number" ? layer.zIndex : 1,
        layout: (layer.layout as CharacterLayer["layout"] | undefined) ?? { ...DEFAULT_CHARACTER_LAYOUT },
      }),
    );

    return normalizeStoryBlock({
      ...base,
      type: "dialogue",
      backgroundAssetId: resolveAssetId(raw.backgroundPath, pathToAssetId),
      characterAssetId: resolveAssetId(raw.characterPath, pathToAssetId),
      npcProfileBlockId: (raw.npcProfileBlockId as string) ?? null,
      npcImageAssetId: resolveAssetId(raw.npcImagePath, pathToAssetId),
      sceneLayout: raw.sceneLayout
        ? (raw.sceneLayout as typeof DEFAULT_SCENE_LAYOUT)
        : { ...DEFAULT_SCENE_LAYOUT },
      characterLayers,
      lines,
      startLineId: (raw.startLineId as string) ?? (lines[0]?.id ?? ""),
    });
  }

  if (type === "choice") {
    const rawChoices = Array.isArray(raw.choices) ? raw.choices : [];
    return normalizeStoryBlock({
      ...base,
      type: "choice",
      prompt: (raw.prompt as string) ?? "",
      backgroundAssetId: resolveAssetId(raw.backgroundPath, pathToAssetId),
      voiceAssetId: resolveAssetId(raw.voicePath, pathToAssetId),
      choices: rawChoices.map((option: Record<string, unknown>) => ({
        id: (option.id as string) ?? createId("option"),
        label: ((option.label as string) ?? "A") as ChoiceLabel,
        text: (option.text as string) ?? "",
        description: (option.description as string) ?? "",
        imageAssetId: resolveAssetId(option.imagePath, pathToAssetId),
        targetBlockId: (option.targetBlockId as string) ?? null,
        effects: deserializeEffects(option.effects),
      })),
    });
  }

  if (type === "hero_profile") {
    return normalizeStoryBlock({
      ...base,
      type: "hero_profile",
      nextBlockId: (raw.nextBlockId as string) ?? null,
    });
  }

  if (type === "npc_profile") {
    const rawImages = Array.isArray(raw.images) ? raw.images : [];
    const imageAssetIds = rawImages
      .map((img: Record<string, unknown>) => resolveAssetId(img.path, pathToAssetId))
      .filter((value): value is string => Boolean(value));
    const defaultImageAssetId = resolveAssetId(raw.defaultImagePath, pathToAssetId);

    return normalizeStoryBlock({
      ...base,
      type: "npc_profile",
      npcName: (raw.npcName as string) ?? "",
      npcLore: (raw.npcLore as string) ?? "",
      imageAssetIds,
      defaultImageAssetId: defaultImageAssetId && imageAssetIds.includes(defaultImageAssetId)
        ? defaultImageAssetId
        : imageAssetIds[0] ?? null,
      initialAffinity: typeof raw.initialAffinity === "number" ? raw.initialAffinity : 50,
      nextBlockId: (raw.nextBlockId as string) ?? null,
    });
  }

  // Gameplay (point_and_click) — V3 objects with legacy fallback via normalizeStoryBlock
  if (type === "gameplay") {
    const rawObjects = Array.isArray(raw.objects) ? raw.objects : [];
    const rawLinks = Array.isArray(raw.links) ? raw.links : [];
    const rawOverlays = Array.isArray(raw.overlays) ? raw.overlays : [];
    const rawHotspots = Array.isArray(raw.hotspots) ? raw.hotspots : [];

    const objects = rawObjects.map((o: Record<string, unknown>) => ({
      id: (o.id as string) ?? createId("gobj"),
      name: (o.name as string) ?? "Objet",
      assetId: resolveAssetId(o.imagePath, pathToAssetId),
      x: typeof o.x === "number" ? o.x : 35,
      y: typeof o.y === "number" ? o.y : 35,
      width: typeof o.width === "number" ? o.width : 15,
      height: typeof o.height === "number" ? o.height : 15,
      zIndex: typeof o.zIndex === "number" ? o.zIndex : 2,
      visibleByDefault: typeof o.visibleByDefault === "boolean" ? o.visibleByDefault : true,
      // V3 fields
      objectType: (o.objectType as string) ?? undefined,
      grantItemId: (o.grantItemId as string) ?? null,
      linkedKeyId: (o.linkedKeyId as string) ?? null,
      unlockEffect: (o.unlockEffect as string) ?? undefined,
      lockedMessage: (o.lockedMessage as string) ?? "",
      successMessage: (o.successMessage as string) ?? "",
      // V2 legacy fields (for migration by normalizeStoryBlock)
      action: (o.action as string) ?? undefined,
      soundAssetId: resolveAssetId(o.soundPath, pathToAssetId),
      effects: deserializeEffects(o.effects),
    }));

    // Pass V2 links + V1 legacy data through for normalizeStoryBlock to handle migration
    const legacyOverlays: GameplayOverlay[] = rawOverlays.map(
      (o: Record<string, unknown>): GameplayOverlay => ({
        id: (o.id as string) ?? createId("overlay"),
        name: (o.name as string) ?? "Objet",
        assetId: resolveAssetId(o.imagePath, pathToAssetId),
        x: typeof o.x === "number" ? o.x : 35,
        y: typeof o.y === "number" ? o.y : 35,
        width: typeof o.width === "number" ? o.width : 20,
        height: typeof o.height === "number" ? o.height : 20,
        zIndex: typeof o.zIndex === "number" ? o.zIndex : 2,
        visibleByDefault: typeof o.visibleByDefault === "boolean" ? o.visibleByDefault : true,
        draggable: typeof o.draggable === "boolean" ? o.draggable : false,
      }),
    );
    const legacyHotspots: GameplayHotspot[] = rawHotspots.map(
      (h: Record<string, unknown>): GameplayHotspot => ({
        id: (h.id as string) ?? createId("hotspot"),
        name: (h.name as string) ?? "Zone",
        x: typeof h.x === "number" ? h.x : 35,
        y: typeof h.y === "number" ? h.y : 35,
        width: typeof h.width === "number" ? h.width : 20,
        height: typeof h.height === "number" ? h.height : 20,
        required: typeof h.required === "boolean" ? h.required : true,
        message: (h.message as string) ?? "",
        toggleOverlayId: (h.toggleOverlayId as string) ?? null,
        soundAssetId: resolveAssetId(h.soundPath, pathToAssetId),
        effects: deserializeEffects(h.effects),
        onClickActions: Array.isArray(h.onClickActions)
          ? (h.onClickActions as Record<string, unknown>[]).map(deserializeHotspotAction)
          : [],
        requiredItemId: (h.requiredItemId as string) ?? null,
        consumeRequiredItem: typeof h.consumeRequiredItem === "boolean" ? h.consumeRequiredItem : false,
        lockedMessage: (h.lockedMessage as string) ?? "",
        acceptOverlayId: (h.acceptOverlayId as string) ?? null,
      }),
    );

    return normalizeStoryBlock({
      ...base,
      type: "gameplay",
      mode: "point_and_click" as const,
      objective: (raw.objective as string) ?? "",
      backgroundAssetId: resolveAssetId(raw.backgroundPath, pathToAssetId),
      sceneLayout: raw.sceneLayout,
      voiceAssetId: resolveAssetId(raw.voicePath, pathToAssetId),
      objects,
      links: rawLinks,
      completionEffects: deserializeEffects(raw.completionEffects),
      nextBlockId: (raw.nextBlockId as string) ?? null,
      overlays: legacyOverlays.length > 0 ? legacyOverlays : undefined,
      hotspots: legacyHotspots.length > 0 ? legacyHotspots : undefined,
    } as GameplayBlock);
  }

  return null;
}

function deserializeEffects(effects: unknown): { variableId: string; delta: number }[] {
  if (!Array.isArray(effects)) return [];
  return effects.map((e: Record<string, unknown>) => ({
    variableId: (e.variableId as string) ?? "",
    delta: typeof e.delta === "number" ? e.delta : 0,
  }));
}

function deserializeHotspotAction(raw: Record<string, unknown>): GameplayHotspotClickAction {
  const id = (raw.id as string) ?? createId("action");
  const type = raw.type as GameplayHotspotClickActionType;

  if (type === "add_item") {
    return { id, type, itemId: (raw.itemId as string) ?? null, quantity: typeof raw.quantity === "number" ? raw.quantity : 1 };
  }
  if (type === "disable_hotspot") {
    return { id, type, targetHotspotId: (raw.targetHotspotId as string) ?? null };
  }
  if (type === "go_to_block") {
    return { id, type, targetBlockId: (raw.targetBlockId as string) ?? null };
  }
  return { id, type: "message", message: (raw.message as string) ?? "" };
}

export function isCloudPayload(value: unknown): value is CloudPayload {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<CloudPayload>;
  return (
    Boolean(candidate.project) &&
    Array.isArray(candidate.nodes) &&
    Array.isArray(candidate.edges) &&
    Boolean(candidate.assetRefs)
  );
}

export function serializeStudioSnapshot(
  project: ProjectMeta,
  nodes: EditorNode[],
  edges: EditorEdge[],
  assetRefs: Record<string, AssetRef>,
) {
  return JSON.stringify({
    project,
    nodes,
    edges,
    assetRefs,
  });
}

export function buildStudioChangeFingerprint(
  project: ProjectMeta,
  nodes: EditorNode[],
  edges: EditorEdge[],
  assetRefs: Record<string, AssetRef>,
) {
  const nodePart = nodes
    .map((node) => `${node.id}:${node.position.x}:${node.position.y}`)
    .join("|");

  const edgePart = edges
    .map((edge) => `${edge.source}:${edge.sourceHandle ?? "next"}:${edge.target}`)
    .join("|");

  const assetIds = Object.keys(assetRefs).sort((a, b) => a.localeCompare(b));
  const assetPart = assetIds
    .map((assetId) => {
      const ref = assetRefs[assetId];
      if (!ref) return assetId;
      return `${assetId}:${ref.packagePath}:${ref.storagePath ?? ""}:${ref.size}`;
    })
    .join("|");

  return [
    project.info.updatedAt,
    project.info.startBlockId ?? "",
    project.info.title,
    project.info.slug,
    String(nodes.length),
    String(edges.length),
    String(assetIds.length),
    nodePart,
    edgePart,
    assetPart,
  ].join("~");
}
