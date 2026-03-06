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
  // Condition failed — use fallback
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
    ) => {
      if (!targetBlockId) {
        return {
          currentBlockId: null,
          currentDialogueLineId: null,
          variables,
          inventory,
          npcAffinity,
          ended: true,
          gameplayInteractedObjectIds: [],
          gameplayObjectVisibility: {},
          gameplayMessage: null,
        } as PreviewRuntimeState;
      }

      const block = blockById.get(targetBlockId) ?? null;
      const nextVariables = block
        ? applyEffects(variables, block.entryEffects ?? [])
        : variables;

      if (block && block.type === "dialogue") {
        const resolvedLineId = resolveDialogueLine(
          block,
          entryLineId || block.startLineId || block.lines[0]?.id || null,
          npcAffinity,
        );
        return {
          currentBlockId: targetBlockId,
          currentDialogueLineId: resolvedLineId,
          variables: nextVariables,
          inventory,
          npcAffinity,
          ended: false,
          gameplayInteractedObjectIds: [],
          gameplayObjectVisibility: {},
          gameplayMessage: null,
        } as PreviewRuntimeState;
      }

      if (!block || block.type !== "gameplay") {
        return {
          currentBlockId: targetBlockId,
          currentDialogueLineId: null,
          variables: nextVariables,
          inventory,
          npcAffinity,
          ended: false,
          gameplayInteractedObjectIds: [],
          gameplayObjectVisibility: {},
          gameplayMessage: null,
        } as PreviewRuntimeState;
      }

      // Gameplay block — initialise object visibility
      const visibility: Record<string, boolean> = {};
      for (const obj of block.objects) {
        visibility[obj.id] = obj.visibleByDefault;
      }

      return {
        currentBlockId: targetBlockId,
        currentDialogueLineId: null,
        variables: nextVariables,
        inventory,
        npcAffinity,
        ended: false,
        gameplayInteractedObjectIds: [],
        gameplayObjectVisibility: visibility,
        gameplayMessage: null,
      } as PreviewRuntimeState;
    },
    [blockById],
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

    setPreviewState(buildPreviewState(project.info.startBlockId, initialVariables, {}, initialAffinity));
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
    const interactive = interactiveObjectIds(previewBlock);
    if (interactive.length === 0) return "Aucun objet interactif";
    const done = interactive.filter((id) => previewInteractedSet.has(id)).length;
    return `${done}/${interactive.length} objets`;
  }, [previewBlock, previewInteractedSet]);

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

    setPreviewState(buildPreviewState(nextBlockId, nextVariables, previewState.inventory, previewState.npcAffinity));
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
          const resolvedLineId = resolveDialogueLine(
            previewBlock,
            resp.targetLineId,
            nextAffinity,
          );
          setPreviewState({
            ...previewState,
            currentDialogueLineId: resolvedLineId,
            variables: nextVariables,
            npcAffinity: nextAffinity,
          });
          return;
        }

        setPreviewState(
          buildPreviewState(resp.targetBlockId, nextVariables, previewState.inventory, nextAffinity, resp.targetLineId),
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
        if (obj.grantItemId) {
          nextInventory[obj.grantItemId] = (nextInventory[obj.grantItemId] ?? 0) + 1;
        }
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
        // Keys are dragged, not clicked — no action on click
        return;
      }

      if (obj.objectType === "lock") {
        // Show locked message when clicked without key
        setPreviewState({
          ...previewState,
          gameplayMessage: obj.lockedMessage?.trim() || "Il manque quelque chose...",
        });
        return;
      }
    },
    [previewBlock, previewState],
  );

  /** Handle dropping a key object onto a lock in preview */
  const dropKeyOnLock = useCallback(
    (keyId: string, lockId: string) => {
      if (!previewState || !previewBlock || previewBlock.type !== "gameplay") return;

      const keyObj = previewBlock.objects.find((o) => o.id === keyId);
      const lockObj = previewBlock.objects.find((o) => o.id === lockId);
      if (!keyObj || !lockObj) return;
      if (lockObj.objectType !== "lock" || lockObj.linkedKeyId !== keyId) {
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
        setPreviewState(
          buildPreviewState(previewBlock.nextBlockId, completionVars, nextInventory, previewState.npcAffinity),
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
    resetPreview,
  };
}
