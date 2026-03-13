"use client";

import { useCallback, useMemo, useState } from "react";

import {
  applyEffects,
  interactiveObjectIds,
  isGameplayCompleted,
} from "@/components/author-studio-core";
import { ProjectMeta, DialogueBlock, DialogueLine, NpcProfileBlock, StoryBlock } from "@/lib/story";

export interface PreviewRuntimeState {
  currentBlockId: string | null;
  currentDialogueLineId: string | null;
  variables: Record<string, number>;
  inventory: Record<string, number>;
  /** Per-NPC affinity levels (keyed by npc_profile block id) */
  npcAffinity: Record<string, number>;
  ended: boolean;
  /** IDs of gameplay objects the player has interacted with */
  gameplayInteractedObjectIds: string[];
  /** Runtime visibility of gameplay objects (false = hidden) */
  gameplayObjectVisibility: Record<string, boolean>;
  /** Press history for button sequence gameplay. */
  gameplayButtonSequenceInput: string[];
  /** Currently equipped inventory item (used for gameplay locks requiring inventory). */
  equippedInventoryItemId: string | null;
  gameplayMessage: string | null;
}

interface UsePreviewRuntimeParams {
  project: ProjectMeta;
  blockById: Map<string, StoryBlock>;
  setStatusMessage: (message: string) => void;
}

/** Check if a dialogue line's conditions are met. */
function lineConditionsMet(
  line: DialogueLine,
  npcAffinity: Record<string, number>,
): boolean {
  for (const cond of line.conditions ?? []) {
    const affinity = npcAffinity[cond.npcProfileBlockId] ?? 0;
    if (cond.type === "min_affinity" && affinity < cond.value) return false;
    if (cond.type === "max_affinity" && affinity > cond.value) return false;
  }
  return true;
}

/** Resolve the actual line to show, following fallback chains if conditions fail. */
function resolveDialogueLine(
  block: DialogueBlock,
  targetLineId: string | null,
  npcAffinity: Record<string, number>,
  visited?: Set<string>,
): string | null {
  if (!targetLineId) return null;
  const line = block.lines.find((l) => l.id === targetLineId);
  if (!line) return targetLineId;
  if (lineConditionsMet(line, npcAffinity)) return targetLineId;
  // Condition failed â€” use fallback
  if (!line.fallbackLineId) return null; // skip line entirely
  const seen = visited ?? new Set<string>();
  if (seen.has(line.fallbackLineId)) return null; // prevent infinite loops
  seen.add(line.fallbackLineId);
  return resolveDialogueLine(block, line.fallbackLineId, npcAffinity, seen);
}

export function usePreviewRuntime({
  project,
  blockById,
  setStatusMessage,
}: UsePreviewRuntimeParams) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewState, setPreviewState] = useState<PreviewRuntimeState | null>(null);

  const buildPreviewState = useCallback(
    (
      targetBlockId: string | null,
      variables: Record<string, number>,
      inventory: Record<string, number>,
      npcAffinity: Record<string, number>,
      entryLineId?: string | null,
      equippedInventoryItemId?: string | null,
    ) => {
      const nextEquippedInventoryItemId =
        equippedInventoryItemId && (inventory[equippedInventoryItemId] ?? 0) > 0
          ? equippedInventoryItemId
          : null;
      const buildEndedState = (endedVariables: Record<string, number>): PreviewRuntimeState => ({
        currentBlockId: null,
        currentDialogueLineId: null,
        variables: endedVariables,
        inventory,
        npcAffinity,
        ended: true,
        gameplayInteractedObjectIds: [],
        gameplayObjectVisibility: {},
        gameplayButtonSequenceInput: [],
        equippedInventoryItemId: nextEquippedInventoryItemId,
        gameplayMessage: null,
      });

      if (!targetBlockId) {
        return buildEndedState(variables);
      }

      let resolvedBlockId: string | null = targetBlockId;
      let resolvedBlock = resolvedBlockId ? blockById.get(resolvedBlockId) ?? null : null;
      let nextVariables = variables;
      const visitedChapterMarkers = new Set<string>();

      while (
        resolvedBlock &&
        (resolvedBlock.type === "chapter_start" || resolvedBlock.type === "chapter_end")
      ) {
        if (visitedChapterMarkers.has(resolvedBlock.id)) {
          setStatusMessage("Boucle detectee entre blocs chapitre en preview.");
          return buildEndedState(nextVariables);
        }
        visitedChapterMarkers.add(resolvedBlock.id);

        nextVariables = applyEffects(nextVariables, resolvedBlock.entryEffects ?? []);
        resolvedBlockId = resolvedBlock.nextBlockId;
        if (!resolvedBlockId) {
          return buildEndedState(nextVariables);
        }
        resolvedBlock = blockById.get(resolvedBlockId) ?? null;
      }

      const block = resolvedBlock;
      nextVariables = block
        ? applyEffects(nextVariables, block.entryEffects ?? [])
        : nextVariables;

      if (block && block.type === "dialogue") {
        let resolvedLineId = resolveDialogueLine(
          block,
          entryLineId || block.startLineId || block.lines[0]?.id || null,
          npcAffinity,
        );
        // If the target line (and its fallback chain) all fail conditions,
        // scan remaining lines in order to find the first one that passes.
        if (!resolvedLineId) {
          for (const l of block.lines) {
            if (lineConditionsMet(l, npcAffinity)) {
              resolvedLineId = l.id;
              break;
            }
          }
        }
        return {
          currentBlockId: resolvedBlockId,
          currentDialogueLineId: resolvedLineId,
          variables: nextVariables,
          inventory,
          npcAffinity,
          ended: false,
          gameplayInteractedObjectIds: [],
          gameplayObjectVisibility: {},
          gameplayButtonSequenceInput: [],
          equippedInventoryItemId: nextEquippedInventoryItemId,
          gameplayMessage: null,
        } as PreviewRuntimeState;
      }

      if (!block || block.type !== "gameplay") {
        return {
          currentBlockId: resolvedBlockId,
          currentDialogueLineId: null,
          variables: nextVariables,
          inventory,
          npcAffinity,
          ended: false,
          gameplayInteractedObjectIds: [],
          gameplayObjectVisibility: {},
          gameplayButtonSequenceInput: [],
          equippedInventoryItemId: nextEquippedInventoryItemId,
          gameplayMessage: null,
        } as PreviewRuntimeState;
      }

      // Gameplay block â€” initialise object visibility
      const visibility: Record<string, boolean> = {};
      for (const obj of block.objects) {
        visibility[obj.id] = obj.visibleByDefault;
      }

      return {
        currentBlockId: resolvedBlockId,
        currentDialogueLineId: null,
        variables: nextVariables,
        inventory,
        npcAffinity,
        ended: false,
        gameplayInteractedObjectIds: [],
        gameplayObjectVisibility: visibility,
        gameplayButtonSequenceInput: [],
        equippedInventoryItemId: nextEquippedInventoryItemId,
        gameplayMessage: null,
      } as PreviewRuntimeState;
    },
    [blockById, setStatusMessage],
  );

  const startPreview = useCallback(() => {
    if (!project.info.startBlockId) {
      setStatusMessage("Definis un bloc de depart avant la preview.");
      return;
    }

    const initialVariables: Record<string, number> = {};
    for (const variable of project.variables) {
      initialVariables[variable.id] = variable.initialValue;
    }

    // Initialize NPC affinity from npc_profile blocks
    const initialAffinity: Record<string, number> = {};
    for (const [, block] of blockById) {
      if (block.type === "npc_profile") {
        initialAffinity[block.id] = (block as NpcProfileBlock).initialAffinity ?? 50;
      }
    }

    setPreviewState(buildPreviewState(project.info.startBlockId, initialVariables, {}, initialAffinity, null, null));
    setPreviewOpen(true);
  }, [blockById, buildPreviewState, project.info.startBlockId, project.variables, setStatusMessage]);

  const resetPreview = useCallback(() => {
    setPreviewOpen(false);
    setPreviewState(null);
  }, []);

  const previewBlock =
    previewState?.currentBlockId ? blockById.get(previewState.currentBlockId) ?? null : null;

  const previewInteractedSet = useMemo(
    () => new Set(previewState?.gameplayInteractedObjectIds ?? []),
    [previewState?.gameplayInteractedObjectIds],
  );

  const previewGameplayCompleted = useMemo(() => {
    if (!previewBlock || previewBlock.type !== "gameplay") return false;
    return isGameplayCompleted(previewBlock, previewInteractedSet);
  }, [previewBlock, previewInteractedSet]);

  const previewGameplayProgressLabel = useMemo(() => {
    if (!previewBlock || previewBlock.type !== "gameplay") return "";
    const hasButtons = previewBlock.objects.some((obj) => obj.objectType === "button");
    if (hasButtons) {
      const expectedLength = previewBlock.buttonSequence.length;
      if (expectedLength <= 0) return "Sequence non definie";
      return `Code ${previewState?.gameplayButtonSequenceInput.length ?? 0}/${expectedLength}`;
    }
    const interactive = interactiveObjectIds(previewBlock);
    if (interactive.length === 0) return "Aucun objet interactif";
    const done = interactive.filter((id) => previewInteractedSet.has(id)).length;
    return `${done}/${interactive.length} objets`;
  }, [previewBlock, previewInteractedSet, previewState?.gameplayButtonSequenceInput.length]);

  const continuePreview = useCallback(() => {
    if (!previewState || !previewBlock) return;

    if (previewBlock.type === "dialogue" || previewBlock.type === "choice") return;

    if (previewBlock.type === "gameplay") {
      if (!isGameplayCompleted(previewBlock, new Set(previewState.gameplayInteractedObjectIds))) {
        setStatusMessage("Objectif gameplay non atteint.");
        return;
      }
    }

    const nextBlockId = previewBlock.nextBlockId;
    const nextVariables =
      previewBlock.type === "gameplay"
        ? applyEffects(previewState.variables, previewBlock.completionEffects)
        : previewState.variables;

    setPreviewState(
      buildPreviewState(
        nextBlockId,
        nextVariables,
        previewState.inventory,
        previewState.npcAffinity,
        null,
        previewState.equippedInventoryItemId,
      ),
    );
  }, [buildPreviewState, previewBlock, previewState, setStatusMessage]);

  const pickPreviewChoice = useCallback(
    (choiceId: string) => {
      if (!previewState || !previewBlock) return;

      // Handle dialogue responses (internal line navigation or external block)
      if (previewBlock.type === "dialogue") {
        const resp = previewBlock.lines
          .flatMap((line) => line.responses)
          .find((r) => r.id === choiceId);
        if (!resp) return;

        const nextVariables = applyEffects(previewState.variables, resp.effects);

        // Apply affinity effects
        const nextAffinity = { ...previewState.npcAffinity };
        for (const ae of resp.affinityEffects ?? []) {
          nextAffinity[ae.npcProfileBlockId] = Math.max(
            0,
            Math.min(100, (nextAffinity[ae.npcProfileBlockId] ?? 0) + ae.delta),
          );
        }

        if (resp.targetLineId && (!resp.targetBlockId || resp.targetBlockId === previewState.currentBlockId)) {
          // Resolve conditions on target line
          let resolvedLineId = resolveDialogueLine(
            previewBlock,
            resp.targetLineId,
            nextAffinity,
          );
          // Scan remaining lines if fallback chain fails
          if (!resolvedLineId) {
            for (const l of previewBlock.lines) {
              if (lineConditionsMet(l, nextAffinity)) {
                resolvedLineId = l.id;
                break;
              }
            }
          }
          setPreviewState({
            ...previewState,
            currentDialogueLineId: resolvedLineId,
            variables: nextVariables,
            npcAffinity: nextAffinity,
          });
          return;
        }

        setPreviewState(
          buildPreviewState(
            resp.targetBlockId,
            nextVariables,
            previewState.inventory,
            nextAffinity,
            resp.targetLineId,
            previewState.equippedInventoryItemId,
          ),
        );
        return;
      }

      // Handle choice block options
      if (previewBlock.type === "choice") {
        const choice = previewBlock.choices.find((item) => item.id === choiceId);
        if (!choice) return;

        setPreviewState(
          buildPreviewState(
            choice.targetBlockId,
            applyEffects(previewState.variables, choice.effects),
            previewState.inventory,
            previewState.npcAffinity,
            null,
            previewState.equippedInventoryItemId,
          ),
        );
        return;
      }
    },
    [buildPreviewState, previewBlock, previewState],
  );

  /** Handle clicking a gameplay object in preview (V3: 4-type model) */
  const pickPreviewObject = useCallback(
    (objectId: string) => {
      if (!previewState || !previewBlock || previewBlock.type !== "gameplay") return;

      const obj = previewBlock.objects.find((o) => o.id === objectId);
      if (!obj) return;
      if (previewState.gameplayObjectVisibility[objectId] === false) return;

      const alreadyInteracted = previewState.gameplayInteractedObjectIds.includes(objectId);

      if (obj.objectType === "decoration") {
        // No-op for decoration
        return;
      }

      if (obj.objectType === "collectible") {
        if (alreadyInteracted) return;
        const nextInventory = { ...previewState.inventory };
        const collectedItemId = obj.grantItemId ?? obj.id;
        nextInventory[collectedItemId] = (nextInventory[collectedItemId] ?? 0) + 1;
        setPreviewState({
          ...previewState,
          variables: applyEffects(previewState.variables, obj.effects),
          inventory: nextInventory,
          gameplayInteractedObjectIds: [...previewState.gameplayInteractedObjectIds, objectId],
          gameplayObjectVisibility: { ...previewState.gameplayObjectVisibility, [objectId]: false },
          gameplayMessage: null,
        });
        return;
      }

      if (obj.objectType === "key") {
        // Keys are dragged, not clicked â€” no action on click
        return;
      }

      if (obj.objectType === "button") {
        const expectedSequence = previewBlock.buttonSequence;
        if (expectedSequence.length === 0) {
          setPreviewState({
            ...previewState,
            gameplayMessage: "Sequence non definie.",
            gameplayButtonSequenceInput: [],
          });
          return;
        }

        const nextInput = [...previewState.gameplayButtonSequenceInput, objectId]
          .slice(0, expectedSequence.length);
        const nextVariables = applyEffects(previewState.variables, obj.effects);
        if (nextInput.length < expectedSequence.length) {
          setPreviewState({
            ...previewState,
            variables: nextVariables,
            gameplayButtonSequenceInput: nextInput,
            gameplayMessage: "Code " + nextInput.length + "/" + expectedSequence.length,
          });
          return;
        }

        const isExactMatch = expectedSequence.every(
          (buttonId, index) => nextInput[index] === buttonId,
        );
        if (isExactMatch) {
          const completionVars = applyEffects(nextVariables, previewBlock.completionEffects);
          setPreviewState(
            buildPreviewState(
              previewBlock.buttonSequenceSuccessBlockId,
              completionVars,
              previewState.inventory,
              previewState.npcAffinity,
              null,
              previewState.equippedInventoryItemId,
            ),
          );
          return;
        }

        setPreviewState(
          buildPreviewState(
            previewBlock.buttonSequenceFailureBlockId,
            nextVariables,
            previewState.inventory,
            previewState.npcAffinity,
            null,
            previewState.equippedInventoryItemId,
          ),
        );
        return;
      }

      if (obj.objectType === "lock") {
        if (obj.lockInputMode === "inventory_item") {
          if (!obj.requiredItemId) {
            setPreviewState({
              ...previewState,
              gameplayMessage: "Aucun item requis n'est configure sur cette serrure.",
            });
            return;
          }
          setPreviewState({
            ...previewState,
            gameplayMessage:
              "Equipe l'item puis fais-le glisser au centre de l'ecran vers la serrure.",
          });
          return;
        }

        setPreviewState({
          ...previewState,
          gameplayMessage: obj.lockedMessage?.trim() || "Il manque quelque chose...",
        });
        return;
      }
    },
    [buildPreviewState, previewBlock, previewState],
  );

  /** Handle dropping a key object onto a lock in preview */
  const dropKeyOnLock = useCallback(
    (keyId: string, lockId: string) => {
      if (!previewState || !previewBlock || previewBlock.type !== "gameplay") return;

      const keyObj = previewBlock.objects.find((o) => o.id === keyId);
      const lockObj = previewBlock.objects.find((o) => o.id === lockId);
      if (!keyObj || !lockObj) return;
      if (lockObj.objectType !== "lock") return;
      if (lockObj.lockInputMode === "inventory_item") {
        setPreviewState({
          ...previewState,
          gameplayMessage: "Cette serrure attend un item d'inventaire, pas une cle de scene.",
        });
        return;
      }
      if (lockObj.linkedKeyId !== keyId) {
        setPreviewState({
          ...previewState,
          gameplayMessage: "Ce n'est pas la bonne cle...",
        });
        return;
      }

      const nextVisibility = { ...previewState.gameplayObjectVisibility };
      let nextVariables = applyEffects(previewState.variables, keyObj.effects);
      nextVariables = applyEffects(nextVariables, lockObj.effects);
      const nextInventory = { ...previewState.inventory };

      // Hide key and lock
      nextVisibility[keyId] = false;
      nextVisibility[lockId] = false;

      // Mark both as interacted
      const nextInteracted = [...previewState.gameplayInteractedObjectIds];
      if (!nextInteracted.includes(keyId)) nextInteracted.push(keyId);
      if (!nextInteracted.includes(lockId)) nextInteracted.push(lockId);

      const nextMessage = lockObj.successMessage?.trim() || null;

      if (lockObj.unlockEffect === "go_to_next") {
        // Apply completion effects and advance
        const completionVars = applyEffects(nextVariables, previewBlock.completionEffects);
        const targetBlockId = lockObj.targetBlockId;
        setPreviewState(
          buildPreviewState(
            targetBlockId,
            completionVars,
            nextInventory,
            previewState.npcAffinity,
            null,
            previewState.equippedInventoryItemId,
          ),
        );
        return;
      }

      if (lockObj.unlockEffect === "modify_stats") {
        // Effects already applied above
      }

      // "disappear" or "modify_stats": stay on scene
      setPreviewState({
        ...previewState,
        variables: nextVariables,
        inventory: nextInventory,
        gameplayInteractedObjectIds: nextInteracted,
        gameplayObjectVisibility: nextVisibility,
        gameplayMessage: nextMessage,
      });
    },
    [buildPreviewState, previewBlock, previewState],
  );

  const dropInventoryItemOnLock = useCallback(
    (itemId: string, lockId: string) => {
      if (!previewState || !previewBlock || previewBlock.type !== "gameplay") return;

      const lockObj = previewBlock.objects.find((o) => o.id === lockId);
      if (!lockObj || lockObj.objectType !== "lock") return;
      if (lockObj.lockInputMode !== "inventory_item") {
        setPreviewState({
          ...previewState,
          gameplayMessage: "Cette serrure attend une cle de scene.",
        });
        return;
      }
      if (!lockObj.requiredItemId) {
        setPreviewState({
          ...previewState,
          gameplayMessage: "Aucun item requis n'est configure sur cette serrure.",
        });
        return;
      }

      const hasRequiredItemInInventory = (previewState.inventory[lockObj.requiredItemId] ?? 0) > 0;
      const isCorrectItem = itemId === lockObj.requiredItemId && hasRequiredItemInInventory;
      if (!isCorrectItem) {
        setPreviewState({
          ...previewState,
          gameplayMessage: lockObj.lockedMessage?.trim() || "Ce n'est pas le bon item.",
        });
        return;
      }

      const nextVariables = applyEffects(previewState.variables, lockObj.effects);
      const nextInventory = { ...previewState.inventory };
      if (lockObj.consumeRequiredItem) {
        const currentQty = nextInventory[lockObj.requiredItemId] ?? 0;
        nextInventory[lockObj.requiredItemId] = Math.max(0, currentQty - 1);
      }
      const nextInteracted = [...previewState.gameplayInteractedObjectIds];
      if (!nextInteracted.includes(lockId)) nextInteracted.push(lockId);
      const nextVisibility = { ...previewState.gameplayObjectVisibility };
      if (lockObj.unlockEffect === "disappear") {
        nextVisibility[lockId] = false;
      }

      if (lockObj.unlockEffect === "go_to_next") {
        const completionVars = applyEffects(nextVariables, previewBlock.completionEffects);
        setPreviewState(
          buildPreviewState(
            lockObj.targetBlockId,
            completionVars,
            nextInventory,
            previewState.npcAffinity,
            null,
            previewState.equippedInventoryItemId,
          ),
        );
        return;
      }

      const nextEquippedInventoryItemId =
        previewState.equippedInventoryItemId &&
        (nextInventory[previewState.equippedInventoryItemId] ?? 0) > 0
          ? previewState.equippedInventoryItemId
          : null;
      setPreviewState({
        ...previewState,
        variables: nextVariables,
        inventory: nextInventory,
        gameplayInteractedObjectIds: nextInteracted,
        gameplayObjectVisibility: nextVisibility,
        equippedInventoryItemId: nextEquippedInventoryItemId,
        gameplayMessage: lockObj.successMessage?.trim() || null,
      });
    },
    [buildPreviewState, previewBlock, previewState],
  );

  const equipPreviewInventoryItem = useCallback((itemId: string | null) => {
    setPreviewState((current) => {
      if (!current) return current;
      if (!itemId) {
        return {
          ...current,
          equippedInventoryItemId: null,
        };
      }
      if ((current.inventory[itemId] ?? 0) <= 0) {
        return {
          ...current,
          equippedInventoryItemId: null,
          gameplayMessage: "Item indisponible dans l'inventaire.",
        };
      }
      return {
        ...current,
        equippedInventoryItemId: itemId,
      };
    });
  }, []);

  return {
    previewOpen,
    setPreviewOpen,
    previewState,
    previewBlock,
    previewInteractedSet,
    previewGameplayCompleted,
    previewGameplayProgressLabel,
    startPreview,
    continuePreview,
    pickPreviewChoice,
    pickPreviewObject,
    dropKeyOnLock,
    dropInventoryItemOnLock,
    equipPreviewInventoryItem,
    resetPreview,
  };
}
