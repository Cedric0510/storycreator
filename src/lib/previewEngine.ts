/**
 * Moteur pur de la preview du studio.
 *
 * MIROIR de story-player-mobile/src/core/storyEngine.ts (la reference),
 * porte sur le modele editeur (`@/lib/story`). Les deux depots sont
 * volontairement independants: pas de package partage. La parite de
 * comportement est garantie par les scenarios golden dupliques
 * (src/lib/parity/ <-> story-player-mobile/src/core/parity/).
 *
 * Toute modification de semantique ici DOIT etre reportee dans le moteur du
 * lecteur (ou inversement) et les goldens regeneres cote lecteur.
 *
 * Differences assumees avec le lecteur:
 * - pas de fallback via graph.edges: dans l'editeur, les champs des blocs
 *   (nextBlockId, targetBlockId...) sont canoniques, les edges en derivent;
 * - les libelles de gameplayMessage peuvent differer (exclus de la parite).
 */

import {
  AffinityEffect,
  ChoiceBlock,
  CinematicBlock,
  CinematicNarration,
  DialogueBlock,
  DialogueLine,
  GameplayBlock,
  HeroProfile,
  StoryBlock,
  SwitchCase,
  SwitchCondition,
  VariableDefinition,
  VariableEffect,
} from "@/lib/story";

export interface PreviewStory {
  startBlockId: string | null;
  variables: VariableDefinition[];
  hero: HeroProfile;
  blockById: Map<string, StoryBlock>;
}

export interface PreviewRuntimeState {
  currentBlockId: string | null;
  currentDialogueLineId: string | null;
  currentCinematicNarrationId: string | null;
  variables: Record<string, number>;
  /** Last selected option id per choice block id. */
  choiceHistory: Record<string, string>;
  inventory: Record<string, number>;
  /** Per-NPC affinity levels (keyed by npc_profile block id) */
  npcAffinity: Record<string, number>;
  ended: boolean;
  gameplayInteractedObjectIds: string[];
  gameplayObjectVisibility: Record<string, boolean>;
  gameplayButtonSequenceInput: string[];
  equippedInventoryItemId: string | null;
  gameplayMessage: string | null;
}

export type PreviewAction =
  | { type: "continue" }
  | { type: "pick_response"; responseId: string }
  | { type: "pick_choice"; choiceId: string }
  | { type: "pick_object"; objectId: string }
  | { type: "drop_key_on_lock"; keyId: string; lockId: string }
  | { type: "drop_inventory_item_on_lock"; itemId: string; lockId: string }
  | { type: "equip_inventory_item"; itemId: string | null }
  | { type: "restart" };

function asFiniteNumber(value: unknown, fallback = 0) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function clampAffinity(value: number) {
  return Math.max(0, Math.min(100, value));
}

function applyEffects(
  source: Record<string, number>,
  effects: VariableEffect[] | undefined,
): Record<string, number> {
  if (!effects || effects.length === 0) return source;
  const next = { ...source };
  for (const effect of effects) {
    if (!effect?.variableId) continue;
    const current = asFiniteNumber(next[effect.variableId], 0);
    next[effect.variableId] = current + asFiniteNumber(effect.delta, 0);
  }
  return next;
}

function applyAffinityEffects(
  source: Record<string, number>,
  effects: AffinityEffect[] | undefined,
): Record<string, number> {
  if (!effects || effects.length === 0) return source;
  const next = { ...source };
  for (const effect of effects) {
    if (!effect?.npcProfileBlockId) continue;
    const current = asFiniteNumber(next[effect.npcProfileBlockId], 0);
    next[effect.npcProfileBlockId] = clampAffinity(current + asFiniteNumber(effect.delta, 0));
  }
  return next;
}

function lineConditionsMet(line: DialogueLine, npcAffinity: Record<string, number>): boolean {
  for (const condition of line.conditions ?? []) {
    const affinity = asFiniteNumber(npcAffinity[condition.npcProfileBlockId], 0);
    if (condition.type === "min_affinity" && affinity < condition.value) return false;
    if (condition.type === "max_affinity" && affinity > condition.value) return false;
  }
  return true;
}

function resolveDialogueLine(
  block: DialogueBlock,
  targetLineId: string | null,
  npcAffinity: Record<string, number>,
  visited?: Set<string>,
): string | null {
  if (!targetLineId) return null;
  const line = block.lines.find((candidate) => candidate.id === targetLineId);
  if (!line) return targetLineId;
  if (lineConditionsMet(line, npcAffinity)) return targetLineId;
  if (!line.fallbackLineId) return null;
  const seen = visited ?? new Set<string>();
  if (seen.has(line.fallbackLineId)) return null;
  seen.add(line.fallbackLineId);
  return resolveDialogueLine(block, line.fallbackLineId, npcAffinity, seen);
}

function findNextDialogueLineId(
  block: DialogueBlock,
  currentLineId: string,
  npcAffinity: Record<string, number>,
): string | null {
  const currentIndex = block.lines.findIndex((line) => line.id === currentLineId);
  const startIndex = currentIndex >= 0 ? currentIndex + 1 : 0;
  for (let index = startIndex; index < block.lines.length; index += 1) {
    const candidate = block.lines[index];
    const resolved = resolveDialogueLine(block, candidate.id, npcAffinity);
    if (resolved && resolved !== currentLineId) return resolved;
  }
  return null;
}

function compareNumber(actual: number, expected: number, operator: SwitchCondition["operator"]): boolean {
  if (operator === "ne") return actual !== expected;
  if (operator === "gt") return actual > expected;
  if (operator === "gte") return actual >= expected;
  if (operator === "lt") return actual < expected;
  if (operator === "lte") return actual <= expected;
  return actual === expected;
}

function switchConditionMatches(
  condition: SwitchCondition,
  variables: Record<string, number>,
  choiceHistory: Record<string, string>,
  npcAffinity: Record<string, number>,
): boolean {
  if (condition.type === "choice") {
    if (!condition.choiceBlockId || !condition.choiceOptionId) return false;
    const matches = choiceHistory[condition.choiceBlockId] === condition.choiceOptionId;
    return condition.operator === "ne" ? !matches : matches;
  }

  if (condition.type === "variable") {
    if (!condition.variableId) return false;
    return compareNumber(
      asFiniteNumber(variables[condition.variableId], 0),
      condition.expectedValue,
      condition.operator,
    );
  }

  if (!condition.npcProfileBlockId) return false;
  return compareNumber(
    asFiniteNumber(npcAffinity[condition.npcProfileBlockId], 0),
    condition.expectedValue,
    condition.operator,
  );
}

function legacySwitchCaseMatches(
  item: SwitchCase,
  variableValue: number,
  choiceHistory: Record<string, string>,
): boolean {
  if (item.conditionType === "value") return variableValue >= item.expectedValue;
  if (item.choiceConditions.length > 0) {
    return item.choiceConditions.every((condition) =>
      Boolean(condition.choiceBlockId) &&
      Boolean(condition.choiceOptionId) &&
      choiceHistory[condition.choiceBlockId as string] === condition.choiceOptionId
    );
  }
  if (!item.choiceBlockId || !item.choiceOptionId) return false;
  return choiceHistory[item.choiceBlockId] === item.choiceOptionId;
}

function switchCaseMatches(
  item: SwitchCase,
  variables: Record<string, number>,
  choiceHistory: Record<string, string>,
  npcAffinity: Record<string, number>,
  legacyVariableId: string | null,
): boolean {
  if (!item.targetBlockId) return false;
  if (item.conditions.length === 0) {
    const variableValue = legacyVariableId ? asFiniteNumber(variables[legacyVariableId], 0) : 0;
    return legacySwitchCaseMatches(item, variableValue, choiceHistory);
  }
  const matches = (condition: SwitchCondition) =>
    switchConditionMatches(condition, variables, choiceHistory, npcAffinity);
  return item.logic === "or" ? item.conditions.some(matches) : item.conditions.every(matches);
}

function getNextBlockId(block: StoryBlock): string | null {
  if ("nextBlockId" in block && typeof block.nextBlockId === "string" && block.nextBlockId) {
    return block.nextBlockId;
  }
  return null;
}

function normalizeInventory(input: Record<string, number>): Record<string, number> {
  const next: Record<string, number> = {};
  for (const [itemId, quantity] of Object.entries(input)) {
    const numeric = Math.max(0, Math.floor(asFiniteNumber(quantity, 0)));
    if (!itemId || numeric <= 0) continue;
    next[itemId] = numeric;
  }
  return next;
}

function normalizeEquippedInventoryItemId(
  inventory: Record<string, number>,
  equippedInventoryItemId: string | null | undefined,
): string | null {
  if (!equippedInventoryItemId) return null;
  if ((inventory[equippedInventoryItemId] ?? 0) <= 0) return null;
  return equippedInventoryItemId;
}

function buildEndedState(
  variables: Record<string, number>,
  choiceHistory: Record<string, string>,
  inventory: Record<string, number>,
  npcAffinity: Record<string, number>,
  equippedInventoryItemId: string | null,
): PreviewRuntimeState {
  return {
    currentBlockId: null,
    currentDialogueLineId: null,
    currentCinematicNarrationId: null,
    variables,
    choiceHistory,
    inventory,
    npcAffinity,
    ended: true,
    gameplayInteractedObjectIds: [],
    gameplayObjectVisibility: {},
    gameplayButtonSequenceInput: [],
    equippedInventoryItemId: normalizeEquippedInventoryItemId(inventory, equippedInventoryItemId),
    gameplayMessage: null,
  };
}

function buildPreviewRuntimeState(
  story: PreviewStory,
  targetBlockId: string | null,
  variables: Record<string, number>,
  choiceHistory: Record<string, string>,
  inventory: Record<string, number>,
  npcAffinity: Record<string, number>,
  entryLineId?: string | null,
  equippedInventoryItemId?: string | null,
  entryCinematicNarrationId?: string | null,
): PreviewRuntimeState {
  const safeInventory = normalizeInventory(inventory);
  const safeEquipped = normalizeEquippedInventoryItemId(safeInventory, equippedInventoryItemId);

  if (!targetBlockId) {
    return buildEndedState(variables, choiceHistory, safeInventory, npcAffinity, safeEquipped);
  }

  let resolvedBlockId: string | null = targetBlockId;
  let resolvedBlock = story.blockById.get(targetBlockId) ?? null;
  let nextVariables = variables;
  const visitedChapterMarkers = new Set<string>();

  while (
    resolvedBlock &&
    (
      resolvedBlock.type === "chapter_start" ||
      resolvedBlock.type === "chapter_end" ||
      resolvedBlock.type === "switch"
    )
  ) {
    if (visitedChapterMarkers.has(resolvedBlock.id)) {
      return buildEndedState(nextVariables, choiceHistory, safeInventory, npcAffinity, safeEquipped);
    }
    visitedChapterMarkers.add(resolvedBlock.id);

    nextVariables = applyEffects(nextVariables, resolvedBlock.entryEffects);
    if (resolvedBlock.type === "switch") {
      const legacyVariableId = resolvedBlock.variableId;
      const matchedCase = resolvedBlock.cases.find((item) =>
        switchCaseMatches(item, nextVariables, choiceHistory, npcAffinity, legacyVariableId),
      );
      resolvedBlockId = matchedCase?.targetBlockId ?? resolvedBlock.nextBlockId;
    } else {
      resolvedBlockId = getNextBlockId(resolvedBlock);
    }
    if (!resolvedBlockId) {
      return buildEndedState(nextVariables, choiceHistory, safeInventory, npcAffinity, safeEquipped);
    }
    resolvedBlock = story.blockById.get(resolvedBlockId) ?? null;
  }

  if (!resolvedBlock || !resolvedBlockId) {
    return buildEndedState(nextVariables, choiceHistory, safeInventory, npcAffinity, safeEquipped);
  }

  nextVariables = applyEffects(nextVariables, resolvedBlock.entryEffects);

  if (resolvedBlock.type === "dialogue") {
    let resolvedLineId = resolveDialogueLine(
      resolvedBlock,
      entryLineId || resolvedBlock.startLineId || resolvedBlock.lines[0]?.id || null,
      npcAffinity,
    );

    if (!resolvedLineId) {
      for (const line of resolvedBlock.lines) {
        if (lineConditionsMet(line, npcAffinity)) {
          resolvedLineId = line.id;
          break;
        }
      }
    }

    return {
      currentBlockId: resolvedBlockId,
      currentDialogueLineId: resolvedLineId,
      currentCinematicNarrationId: null,
      variables: nextVariables,
      choiceHistory,
      inventory: safeInventory,
      npcAffinity,
      ended: false,
      gameplayInteractedObjectIds: [],
      gameplayObjectVisibility: {},
      gameplayButtonSequenceInput: [],
      equippedInventoryItemId: safeEquipped,
      gameplayMessage: null,
    };
  }

  if (resolvedBlock.type !== "gameplay") {
    const currentCinematicNarrationId = resolvedBlock.type === "cinematic"
      ? resolvedBlock.narrations.find((item) => item.id === entryCinematicNarrationId)?.id
        ?? resolvedBlock.narrations.find((item) => item.id === resolvedBlock.startNarrationId)?.id
        ?? resolvedBlock.narrations[0]?.id
        ?? null
      : null;
    return {
      currentBlockId: resolvedBlockId,
      currentDialogueLineId: null,
      currentCinematicNarrationId,
      variables: nextVariables,
      choiceHistory,
      inventory: safeInventory,
      npcAffinity,
      ended: false,
      gameplayInteractedObjectIds: [],
      gameplayObjectVisibility: {},
      gameplayButtonSequenceInput: [],
      equippedInventoryItemId: safeEquipped,
      gameplayMessage: null,
    };
  }

  const visibility: Record<string, boolean> = {};
  for (const object of resolvedBlock.objects) {
    visibility[object.id] = object.visibleByDefault;
  }

  return {
    currentBlockId: resolvedBlockId,
    currentDialogueLineId: null,
    currentCinematicNarrationId: null,
    variables: nextVariables,
    choiceHistory,
    inventory: safeInventory,
    npcAffinity,
    ended: false,
    gameplayInteractedObjectIds: [],
    gameplayObjectVisibility: visibility,
    gameplayButtonSequenceInput: [],
    equippedInventoryItemId: safeEquipped,
    gameplayMessage: null,
  };
}

function buildInitialVariables(story: PreviewStory): Record<string, number> {
  const variables: Record<string, number> = {};
  for (const variable of story.variables) {
    variables[variable.id] = asFiniteNumber(variable.initialValue, 0);
  }
  return variables;
}

function buildInitialInventory(story: PreviewStory): Record<string, number> {
  const inventory: Record<string, number> = {};
  for (const entry of story.hero.startingInventory) {
    if (!entry.itemId) continue;
    const quantity = Math.max(0, Math.floor(asFiniteNumber(entry.quantity, 0)));
    if (quantity <= 0) continue;
    inventory[entry.itemId] = (inventory[entry.itemId] ?? 0) + quantity;
  }
  return inventory;
}

function buildInitialNpcAffinity(story: PreviewStory): Record<string, number> {
  const affinity: Record<string, number> = {};
  for (const block of story.blockById.values()) {
    if (block.type !== "npc_profile") continue;
    affinity[block.id] = clampAffinity(asFiniteNumber(block.initialAffinity, 50));
  }
  return affinity;
}

export function createInitialPreviewState(story: PreviewStory): PreviewRuntimeState {
  return buildPreviewRuntimeState(
    story,
    story.startBlockId,
    buildInitialVariables(story),
    {},
    buildInitialInventory(story),
    buildInitialNpcAffinity(story),
    null,
    null,
  );
}

export function getPreviewBlock(story: PreviewStory, state: PreviewRuntimeState): StoryBlock | null {
  if (!state.currentBlockId) return null;
  return story.blockById.get(state.currentBlockId) ?? null;
}

export function getPreviewDialogueLine(
  story: PreviewStory,
  state: PreviewRuntimeState,
): DialogueLine | null {
  const block = getPreviewBlock(story, state);
  if (!block || block.type !== "dialogue") return null;
  if (!state.currentDialogueLineId) return null;
  return block.lines.find((line) => line.id === state.currentDialogueLineId) ?? null;
}

export function getPreviewCinematicNarration(
  story: PreviewStory,
  state: PreviewRuntimeState,
): CinematicNarration | null {
  const block = getPreviewBlock(story, state);
  if (!block || block.type !== "cinematic") return null;
  return block.narrations.find((item) => item.id === state.currentCinematicNarrationId)
    ?? block.narrations.find((item) => item.id === block.startNarrationId)
    ?? block.narrations[0]
    ?? null;
}

function findNextCinematicNarrationId(
  block: CinematicBlock,
  currentNarrationId: string,
): string | null {
  const index = block.narrations.findIndex((item) => item.id === currentNarrationId);
  if (index < 0) return block.narrations[0]?.id ?? null;
  return block.narrations[index + 1]?.id ?? null;
}

function interactiveObjectIds(block: GameplayBlock): string[] {
  return block.objects
    .filter((object) => object.objectType !== "decoration" && object.objectType !== "button")
    .map((object) => object.id);
}

export function isPreviewGameplayCompleted(
  block: GameplayBlock,
  interactedObjectIds: Set<string>,
): boolean {
  if (block.objects.length === 0) return true;
  if (block.objects.some((object) => object.objectType === "button")) return false;
  const mustInteract = interactiveObjectIds(block);
  return mustInteract.every((objectId) => interactedObjectIds.has(objectId));
}

function reduceContinue(
  story: PreviewStory,
  state: PreviewRuntimeState,
  block: StoryBlock,
): PreviewRuntimeState {
  if (block.type === "choice") return state;

  if (block.type === "dialogue") {
    const currentLine = getPreviewDialogueLine(story, state);
    if (!currentLine) {
      return buildPreviewRuntimeState(
        story,
        null,
        state.variables,
        state.choiceHistory,
        state.inventory,
        state.npcAffinity,
        null,
        state.equippedInventoryItemId,
      );
    }
    if (currentLine.responses.length > 0) return state;
    if (currentLine.continueTargetBlockId) {
      return buildPreviewRuntimeState(
        story,
        currentLine.continueTargetBlockId,
        state.variables,
        state.choiceHistory,
        state.inventory,
        state.npcAffinity,
        null,
        state.equippedInventoryItemId,
      );
    }
    const nextLineId = findNextDialogueLineId(block, currentLine.id, state.npcAffinity);
    if (nextLineId) {
      return {
        ...state,
        currentDialogueLineId: nextLineId,
        gameplayMessage: null,
      };
    }
    return buildPreviewRuntimeState(
      story,
      null,
      state.variables,
      state.choiceHistory,
      state.inventory,
      state.npcAffinity,
      null,
      state.equippedInventoryItemId,
    );
  }

  if (block.type === "cinematic") {
    const narration = getPreviewCinematicNarration(story, state);
    if (narration?.continueTargetBlockId) {
      return buildPreviewRuntimeState(
        story,
        narration.continueTargetBlockId,
        state.variables,
        state.choiceHistory,
        state.inventory,
        state.npcAffinity,
        null,
        state.equippedInventoryItemId,
        narration.continueTargetNarrationId,
      );
    }
    if (narration?.continueTargetNarrationId) {
      return {
        ...state,
        currentCinematicNarrationId: narration.continueTargetNarrationId,
        gameplayMessage: null,
      };
    }
    const nextNarrationId = narration
      ? findNextCinematicNarrationId(block, narration.id)
      : null;
    if (nextNarrationId) {
      return {
        ...state,
        currentCinematicNarrationId: nextNarrationId,
        gameplayMessage: null,
      };
    }
  }

  if (block.type === "gameplay") {
    if (!isPreviewGameplayCompleted(block, new Set(state.gameplayInteractedObjectIds))) {
      return {
        ...state,
        gameplayMessage: "Objectif gameplay non atteint.",
      };
    }

    const completionVariables = applyEffects(state.variables, block.completionEffects);
    return buildPreviewRuntimeState(
      story,
      getNextBlockId(block),
      completionVariables,
      state.choiceHistory,
      state.inventory,
      state.npcAffinity,
      null,
      state.equippedInventoryItemId,
    );
  }

  return buildPreviewRuntimeState(
    story,
    getNextBlockId(block),
    state.variables,
    state.choiceHistory,
    state.inventory,
    state.npcAffinity,
    null,
    state.equippedInventoryItemId,
  );
}

function reducePickResponse(
  story: PreviewStory,
  state: PreviewRuntimeState,
  block: DialogueBlock,
  responseId: string,
): PreviewRuntimeState {
  const line = getPreviewDialogueLine(story, state);
  if (!line) return state;

  const response = line.responses.find((candidate) => candidate.id === responseId);
  if (!response) return state;

  const nextVariables = applyEffects(state.variables, response.effects);
  const nextAffinity = applyAffinityEffects(state.npcAffinity, response.affinityEffects);

  if (
    response.targetLineId &&
    (!response.targetBlockId || response.targetBlockId === state.currentBlockId)
  ) {
    let resolvedLineId = resolveDialogueLine(block, response.targetLineId, nextAffinity);

    if (!resolvedLineId) {
      for (const candidate of block.lines) {
        if (lineConditionsMet(candidate, nextAffinity)) {
          resolvedLineId = candidate.id;
          break;
        }
      }
    }

    return {
      ...state,
      currentDialogueLineId: resolvedLineId,
      variables: nextVariables,
      npcAffinity: nextAffinity,
    };
  }

  return buildPreviewRuntimeState(
    story,
    response.targetBlockId,
    nextVariables,
    state.choiceHistory,
    state.inventory,
    nextAffinity,
    response.targetLineId,
    state.equippedInventoryItemId,
  );
}

function reducePickChoice(
  story: PreviewStory,
  state: PreviewRuntimeState,
  block: ChoiceBlock,
  choiceId: string,
): PreviewRuntimeState {
  const choice = block.choices.find((candidate) => candidate.id === choiceId);
  if (!choice) return state;

  const nextChoiceHistory = {
    ...state.choiceHistory,
    [block.id]: choice.id,
  };
  let nextVariables = applyEffects(state.variables, choice.effects);
  if (choice.heroMemoryVariableId) {
    nextVariables = {
      ...nextVariables,
      [choice.heroMemoryVariableId]: choice.heroMemoryValue,
    };
  }

  return buildPreviewRuntimeState(
    story,
    choice.targetBlockId,
    nextVariables,
    nextChoiceHistory,
    state.inventory,
    state.npcAffinity,
    null,
    state.equippedInventoryItemId,
  );
}

function reducePickObject(
  story: PreviewStory,
  state: PreviewRuntimeState,
  block: GameplayBlock,
  objectId: string,
): PreviewRuntimeState {
  const object = block.objects.find((candidate) => candidate.id === objectId);
  if (!object) return state;

  if (state.gameplayObjectVisibility[objectId] === false) return state;

  const alreadyInteracted = state.gameplayInteractedObjectIds.includes(objectId);

  if (object.objectType === "decoration") {
    return state;
  }

  if (object.objectType === "collectible") {
    if (alreadyInteracted) return state;

    const nextInventory = { ...state.inventory };
    const collectedItemId = object.grantItemId ?? object.id;
    nextInventory[collectedItemId] = (nextInventory[collectedItemId] ?? 0) + 1;

    return {
      ...state,
      variables: applyEffects(state.variables, object.effects),
      inventory: nextInventory,
      gameplayInteractedObjectIds: [...state.gameplayInteractedObjectIds, objectId],
      gameplayObjectVisibility: {
        ...state.gameplayObjectVisibility,
        [objectId]: false,
      },
      gameplayMessage: null,
    };
  }

  if (object.objectType === "key") {
    return state;
  }

  if (object.objectType === "button") {
    const expectedSequence = block.buttonSequence;
    if (expectedSequence.length === 0) {
      return {
        ...state,
        gameplayMessage: "Sequence non definie.",
        gameplayButtonSequenceInput: [],
      };
    }

    const nextInput = [...state.gameplayButtonSequenceInput, objectId].slice(0, expectedSequence.length);
    const nextVariables = applyEffects(state.variables, object.effects);

    if (nextInput.length < expectedSequence.length) {
      return {
        ...state,
        variables: nextVariables,
        gameplayButtonSequenceInput: nextInput,
        gameplayMessage: `Code ${nextInput.length}/${expectedSequence.length}`,
      };
    }

    const isExactMatch = expectedSequence.every((buttonId, index) => nextInput[index] === buttonId);
    if (isExactMatch) {
      return buildPreviewRuntimeState(
        story,
        block.buttonSequenceSuccessBlockId,
        applyEffects(nextVariables, block.completionEffects),
        state.choiceHistory,
        state.inventory,
        state.npcAffinity,
        null,
        state.equippedInventoryItemId,
      );
    }

    return buildPreviewRuntimeState(
      story,
      block.buttonSequenceFailureBlockId,
      nextVariables,
      state.choiceHistory,
      state.inventory,
      state.npcAffinity,
      null,
      state.equippedInventoryItemId,
    );
  }

  if (object.objectType === "lock") {
    if (object.lockInputMode === "inventory_item") {
      if (!object.requiredItemId) {
        return {
          ...state,
          gameplayMessage: "Aucun item requis n'est configure sur cette serrure.",
        };
      }
      return {
        ...state,
        gameplayMessage: "Equipe l'item puis fais-le glisser sur la serrure.",
      };
    }

    return {
      ...state,
      gameplayMessage: object.lockedMessage.trim() || "Il manque quelque chose...",
    };
  }

  return state;
}

function reduceDropKeyOnLock(
  story: PreviewStory,
  state: PreviewRuntimeState,
  block: GameplayBlock,
  keyId: string,
  lockId: string,
): PreviewRuntimeState {
  const keyObject = block.objects.find((candidate) => candidate.id === keyId);
  const lockObject = block.objects.find((candidate) => candidate.id === lockId);
  if (!keyObject || !lockObject) return state;
  if (lockObject.objectType !== "lock") return state;

  if (lockObject.lockInputMode === "inventory_item") {
    return {
      ...state,
      gameplayMessage: "Cette serrure attend un item d'inventaire, pas une cle de scene.",
    };
  }

  if (lockObject.linkedKeyId !== keyId) {
    return {
      ...state,
      gameplayMessage: "Ce n'est pas la bonne cle...",
    };
  }

  const nextVisibility = { ...state.gameplayObjectVisibility };
  nextVisibility[keyId] = false;
  nextVisibility[lockId] = false;

  let nextVariables = applyEffects(state.variables, keyObject.effects);
  nextVariables = applyEffects(nextVariables, lockObject.effects);

  const nextInteracted = [...state.gameplayInteractedObjectIds];
  if (!nextInteracted.includes(keyId)) nextInteracted.push(keyId);
  if (!nextInteracted.includes(lockId)) nextInteracted.push(lockId);

  if (lockObject.unlockEffect === "go_to_next") {
    const completionVariables = applyEffects(nextVariables, block.completionEffects);
    return buildPreviewRuntimeState(
      story,
      lockObject.targetBlockId,
      completionVariables,
      state.choiceHistory,
      state.inventory,
      state.npcAffinity,
      null,
      state.equippedInventoryItemId,
    );
  }

  return {
    ...state,
    variables: nextVariables,
    gameplayInteractedObjectIds: nextInteracted,
    gameplayObjectVisibility: nextVisibility,
    gameplayMessage: lockObject.successMessage.trim() || null,
  };
}

function reduceDropInventoryItemOnLock(
  story: PreviewStory,
  state: PreviewRuntimeState,
  block: GameplayBlock,
  itemId: string,
  lockId: string,
): PreviewRuntimeState {
  const lockObject = block.objects.find((candidate) => candidate.id === lockId);
  if (!lockObject || lockObject.objectType !== "lock") return state;

  if (lockObject.lockInputMode !== "inventory_item") {
    return {
      ...state,
      gameplayMessage: "Cette serrure attend une cle de scene.",
    };
  }

  if (!lockObject.requiredItemId) {
    return {
      ...state,
      gameplayMessage: "Aucun item requis n'est configure sur cette serrure.",
    };
  }

  const hasRequiredItem = (state.inventory[lockObject.requiredItemId] ?? 0) > 0;
  const isCorrectItem = itemId === lockObject.requiredItemId && hasRequiredItem;

  if (!isCorrectItem) {
    return {
      ...state,
      gameplayMessage: lockObject.lockedMessage.trim() || "Ce n'est pas le bon item.",
    };
  }

  const nextVariables = applyEffects(state.variables, lockObject.effects);
  const nextInventory = { ...state.inventory };

  if (lockObject.consumeRequiredItem) {
    nextInventory[lockObject.requiredItemId] = Math.max(
      0,
      (nextInventory[lockObject.requiredItemId] ?? 0) - 1,
    );
  }

  const nextInteracted = [...state.gameplayInteractedObjectIds];
  if (!nextInteracted.includes(lockId)) nextInteracted.push(lockId);

  const nextVisibility = { ...state.gameplayObjectVisibility };
  if (lockObject.unlockEffect === "disappear") {
    nextVisibility[lockId] = false;
  }

  if (lockObject.unlockEffect === "go_to_next") {
    const completionVariables = applyEffects(nextVariables, block.completionEffects);
    return buildPreviewRuntimeState(
      story,
      lockObject.targetBlockId,
      completionVariables,
      state.choiceHistory,
      nextInventory,
      state.npcAffinity,
      null,
      state.equippedInventoryItemId,
    );
  }

  return {
    ...state,
    variables: nextVariables,
    inventory: nextInventory,
    gameplayInteractedObjectIds: nextInteracted,
    gameplayObjectVisibility: nextVisibility,
    equippedInventoryItemId: normalizeEquippedInventoryItemId(
      nextInventory,
      state.equippedInventoryItemId,
    ),
    gameplayMessage: lockObject.successMessage.trim() || null,
  };
}

function reduceEquipInventoryItem(
  state: PreviewRuntimeState,
  itemId: string | null,
): PreviewRuntimeState {
  if (!itemId) {
    return {
      ...state,
      equippedInventoryItemId: null,
    };
  }

  if ((state.inventory[itemId] ?? 0) <= 0) {
    return {
      ...state,
      equippedInventoryItemId: null,
      gameplayMessage: "Item indisponible dans l'inventaire.",
    };
  }

  return {
    ...state,
    equippedInventoryItemId: itemId,
  };
}

export function reducePreview(
  story: PreviewStory,
  state: PreviewRuntimeState,
  action: PreviewAction,
): PreviewRuntimeState {
  if (action.type === "restart") {
    return createInitialPreviewState(story);
  }

  if (state.ended) return state;

  const block = getPreviewBlock(story, state);
  if (!block) {
    return {
      ...state,
      currentBlockId: null,
      currentDialogueLineId: null,
      ended: true,
    };
  }

  if (action.type === "continue") {
    return reduceContinue(story, state, block);
  }

  if (action.type === "pick_response" && block.type === "dialogue") {
    return reducePickResponse(story, state, block, action.responseId);
  }

  if (action.type === "pick_choice" && block.type === "choice") {
    return reducePickChoice(story, state, block, action.choiceId);
  }

  if (action.type === "pick_object" && block.type === "gameplay") {
    return reducePickObject(story, state, block, action.objectId);
  }

  if (action.type === "drop_key_on_lock" && block.type === "gameplay") {
    return reduceDropKeyOnLock(story, state, block, action.keyId, action.lockId);
  }

  if (action.type === "drop_inventory_item_on_lock" && block.type === "gameplay") {
    return reduceDropInventoryItemOnLock(story, state, block, action.itemId, action.lockId);
  }

  if (action.type === "equip_inventory_item") {
    return reduceEquipInventoryItem(state, action.itemId);
  }

  return state;
}
