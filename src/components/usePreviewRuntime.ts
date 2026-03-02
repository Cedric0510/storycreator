"use client";

import { useCallback, useMemo, useState } from "react";

import {
  applyEffects,
  isGameplayPointClickCompleted,
  requiredHotspotIds,
} from "@/components/author-studio-core";
import { ProjectMeta, DialogueBlock, StoryBlock } from "@/lib/story";

export interface PreviewRuntimeState {
  currentBlockId: string | null;
  currentDialogueLineId: string | null;
  variables: Record<string, number>;
  inventory: Record<string, number>;
  ended: boolean;
  gameplayFoundHotspotIds: string[];
  gameplayDisabledHotspotIds: string[];
  gameplayOverlayVisibility: Record<string, boolean>;
  gameplayMessage: string | null;
}

interface UsePreviewRuntimeParams {
  project: ProjectMeta;
  blockById: Map<string, StoryBlock>;
  setStatusMessage: (message: string) => void;
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
    ) => {
      if (!targetBlockId) {
        return {
          currentBlockId: null,
          currentDialogueLineId: null,
          variables,
          inventory,
          ended: true,
          gameplayFoundHotspotIds: [],
          gameplayDisabledHotspotIds: [],
          gameplayOverlayVisibility: {},
          gameplayMessage: null,
        } as PreviewRuntimeState;
      }

      const block = blockById.get(targetBlockId) ?? null;
      const nextVariables = block
        ? applyEffects(variables, block.entryEffects ?? [])
        : variables;

      if (block && block.type === "dialogue") {
        return {
          currentBlockId: targetBlockId,
          currentDialogueLineId: block.startLineId || block.lines[0]?.id || null,
          variables: nextVariables,
          inventory,
          ended: false,
          gameplayFoundHotspotIds: [],
          gameplayDisabledHotspotIds: [],
          gameplayOverlayVisibility: {},
          gameplayMessage: null,
        } as PreviewRuntimeState;
      }

      if (!block || block.type !== "gameplay") {
        return {
          currentBlockId: targetBlockId,
          currentDialogueLineId: null,
          variables: nextVariables,
          inventory,
          ended: false,
          gameplayFoundHotspotIds: [],
          gameplayDisabledHotspotIds: [],
          gameplayOverlayVisibility: {},
          gameplayMessage: null,
        } as PreviewRuntimeState;
      }

      const visibility: Record<string, boolean> = {};
      for (const overlay of block.overlays) {
        visibility[overlay.id] = overlay.visibleByDefault;
      }

      return {
        currentBlockId: targetBlockId,
        currentDialogueLineId: null,
        variables: nextVariables,
        inventory,
        ended: false,
        gameplayFoundHotspotIds: [],
        gameplayDisabledHotspotIds: [],
        gameplayOverlayVisibility: visibility,
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

    setPreviewState(buildPreviewState(project.info.startBlockId, initialVariables, {}));
    setPreviewOpen(true);
  }, [buildPreviewState, project.info.startBlockId, project.variables, setStatusMessage]);

  const resetPreview = useCallback(() => {
    setPreviewOpen(false);
    setPreviewState(null);
  }, []);

  const previewBlock =
    previewState?.currentBlockId ? blockById.get(previewState.currentBlockId) ?? null : null;
  const previewFoundHotspotSet = useMemo(
    () => new Set(previewState?.gameplayFoundHotspotIds ?? []),
    [previewState?.gameplayFoundHotspotIds],
  );
  const previewDisabledHotspotSet = useMemo(
    () => new Set(previewState?.gameplayDisabledHotspotIds ?? []),
    [previewState?.gameplayDisabledHotspotIds],
  );
  const previewGameplayRequiredIds = useMemo(() => {
    if (!previewBlock || previewBlock.type !== "gameplay") return [];
    return requiredHotspotIds(previewBlock);
  }, [previewBlock]);
  const previewGameplayCompleted = useMemo(() => {
    if (!previewBlock || previewBlock.type !== "gameplay") return false;
    return isGameplayPointClickCompleted(previewBlock, previewFoundHotspotSet);
  }, [previewBlock, previewFoundHotspotSet]);
  const previewGameplayProgressLabel = useMemo(() => {
    if (!previewBlock || previewBlock.type !== "gameplay") return "";

    if (previewBlock.completionRule.type === "required_count") {
      const requiredCount = Math.max(1, Math.floor(previewBlock.completionRule.requiredCount || 1));
      return `${previewFoundHotspotSet.size}/${requiredCount} zones activees`;
    }

    if (previewGameplayRequiredIds.length === 0) {
      return "Aucune zone requise";
    }

    const foundRequiredCount = previewGameplayRequiredIds.filter((hotspotId) =>
      previewFoundHotspotSet.has(hotspotId),
    ).length;
    return `${foundRequiredCount}/${previewGameplayRequiredIds.length} zones requises`;
  }, [previewBlock, previewFoundHotspotSet, previewGameplayRequiredIds]);

  const continuePreview = useCallback(() => {
    if (!previewState || !previewBlock) return;

    if (previewBlock.type === "dialogue" || previewBlock.type === "choice") return;

    if (previewBlock.type === "gameplay") {
      const foundSet = new Set(previewState.gameplayFoundHotspotIds);
      if (!isGameplayPointClickCompleted(previewBlock, foundSet)) {
        setStatusMessage("Objectif gameplay non atteint.");
        return;
      }
    }

    const nextBlockId = previewBlock.nextBlockId;
    const nextVariables =
      previewBlock.type === "gameplay"
        ? applyEffects(previewState.variables, previewBlock.completionEffects)
        : previewState.variables;

    setPreviewState(buildPreviewState(nextBlockId, nextVariables, previewState.inventory));
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

        if (resp.targetLineId) {
          // Internal navigation — stay in same block, move to target line
          setPreviewState({
            ...previewState,
            currentDialogueLineId: resp.targetLineId,
            variables: nextVariables,
          });
          return;
        }

        // External navigation — go to target block (or end)
        setPreviewState(
          buildPreviewState(resp.targetBlockId, nextVariables, previewState.inventory),
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
          ),
        );
        return;
      }
    },
    [buildPreviewState, previewBlock, previewState],
  );

  const pickPreviewHotspot = useCallback(
    (hotspotId: string) => {
      if (!previewState || !previewBlock || previewBlock.type !== "gameplay") return;
      if (previewState.gameplayDisabledHotspotIds.includes(hotspotId)) return;

      const hotspot = previewBlock.hotspots.find((item) => item.id === hotspotId);
      if (!hotspot) return;

      const alreadyFound = previewState.gameplayFoundHotspotIds.includes(hotspotId);
      const nextFound = alreadyFound
        ? previewState.gameplayFoundHotspotIds
        : [...previewState.gameplayFoundHotspotIds, hotspotId];
      const nextVariables = alreadyFound
        ? previewState.variables
        : applyEffects(previewState.variables, hotspot.effects);
      const nextOverlayVisibility = { ...previewState.gameplayOverlayVisibility };
      const nextInventory = { ...previewState.inventory };
      const nextDisabled = new Set(previewState.gameplayDisabledHotspotIds);
      let nextMessage = hotspot.message?.trim() ? hotspot.message : null;

      if (hotspot.toggleOverlayId) {
        const current = Boolean(nextOverlayVisibility[hotspot.toggleOverlayId]);
        nextOverlayVisibility[hotspot.toggleOverlayId] = !current;
      }

      for (const action of hotspot.onClickActions) {
        if (action.type === "message") {
          if (action.message.trim()) {
            nextMessage = action.message;
          }
          continue;
        }

        if (action.type === "add_item") {
          if (!alreadyFound && action.itemId) {
            const quantity = Math.max(1, Math.floor(action.quantity || 1));
            nextInventory[action.itemId] = (nextInventory[action.itemId] ?? 0) + quantity;
          }
          continue;
        }

        if (action.type === "disable_hotspot") {
          nextDisabled.add(action.targetHotspotId ?? hotspot.id);
          continue;
        }

        if (action.type === "go_to_block" && action.targetBlockId) {
          setPreviewState(buildPreviewState(action.targetBlockId, nextVariables, nextInventory));
          return;
        }
      }

      setPreviewState({
        ...previewState,
        variables: nextVariables,
        inventory: nextInventory,
        gameplayFoundHotspotIds: nextFound,
        gameplayDisabledHotspotIds: Array.from(nextDisabled),
        gameplayOverlayVisibility: nextOverlayVisibility,
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
    previewFoundHotspotSet,
    previewDisabledHotspotSet,
    previewGameplayRequiredIds,
    previewGameplayCompleted,
    previewGameplayProgressLabel,
    startPreview,
    continuePreview,
    pickPreviewChoice,
    pickPreviewHotspot,
    resetPreview,
  };
}
