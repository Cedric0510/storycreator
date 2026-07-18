"use client";

import { useCallback, useMemo, useState } from "react";

import {
  PreviewAction,
  PreviewRuntimeState,
  PreviewStory,
  createInitialPreviewState,
  getPreviewBlock,
  isPreviewGameplayCompleted,
  reducePreview,
} from "@/lib/previewEngine";
import { interactiveObjectIds } from "@/components/author-studio-core";
import { ProjectMeta, StoryBlock } from "@/lib/story";

export type { PreviewRuntimeState } from "@/lib/previewEngine";

interface UsePreviewRuntimeParams {
  project: ProjectMeta;
  blockById: Map<string, StoryBlock>;
  setStatusMessage: (message: string) => void;
}

/**
 * Passerelle React vers le moteur pur de preview (`@/lib/previewEngine`).
 * Toute la semantique de jeu vit dans le moteur, garde en parite avec le
 * lecteur mobile par les scenarios golden (src/lib/parity).
 */
export function usePreviewRuntime({
  project,
  blockById,
  setStatusMessage,
}: UsePreviewRuntimeParams) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewState, setPreviewState] = useState<PreviewRuntimeState | null>(null);

  const previewStory = useMemo<PreviewStory>(
    () => ({
      startBlockId: project.info.startBlockId,
      variables: project.variables,
      hero: project.hero,
      blockById,
    }),
    [blockById, project.hero, project.info.startBlockId, project.variables],
  );

  const dispatchPreview = useCallback(
    (action: PreviewAction) => {
      setPreviewState((current) => (current ? reducePreview(previewStory, current, action) : current));
    },
    [previewStory],
  );

  const startPreview = useCallback(() => {
    if (!project.info.startBlockId) {
      setStatusMessage("Definis un bloc de depart avant la preview.");
      return;
    }
    setPreviewState(createInitialPreviewState(previewStory));
    setPreviewOpen(true);
  }, [previewStory, project.info.startBlockId, setStatusMessage]);

  const resetPreview = useCallback(() => {
    setPreviewOpen(false);
    setPreviewState(null);
  }, []);

  const previewBlock = previewState ? getPreviewBlock(previewStory, previewState) : null;

  const previewInteractedSet = useMemo(
    () => new Set(previewState?.gameplayInteractedObjectIds ?? []),
    [previewState?.gameplayInteractedObjectIds],
  );

  const previewGameplayCompleted = useMemo(() => {
    if (!previewBlock || previewBlock.type !== "gameplay") return false;
    return isPreviewGameplayCompleted(previewBlock, previewInteractedSet);
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
    dispatchPreview({ type: "continue" });
  }, [dispatchPreview]);

  /** Reponse de dialogue OU option de choix, selon le bloc courant. */
  const pickPreviewChoice = useCallback(
    (choiceId: string) => {
      setPreviewState((current) => {
        if (!current) return current;
        const block = getPreviewBlock(previewStory, current);
        if (!block) return current;
        if (block.type === "dialogue") {
          return reducePreview(previewStory, current, { type: "pick_response", responseId: choiceId });
        }
        if (block.type === "choice") {
          return reducePreview(previewStory, current, { type: "pick_choice", choiceId });
        }
        return current;
      });
    },
    [previewStory],
  );

  const pickPreviewObject = useCallback(
    (objectId: string) => {
      dispatchPreview({ type: "pick_object", objectId });
    },
    [dispatchPreview],
  );

  const dropKeyOnLock = useCallback(
    (keyId: string, lockId: string) => {
      dispatchPreview({ type: "drop_key_on_lock", keyId, lockId });
    },
    [dispatchPreview],
  );

  const dropInventoryItemOnLock = useCallback(
    (itemId: string, lockId: string) => {
      dispatchPreview({ type: "drop_inventory_item_on_lock", itemId, lockId });
    },
    [dispatchPreview],
  );

  const equipPreviewInventoryItem = useCallback(
    (itemId: string | null) => {
      dispatchPreview({ type: "equip_inventory_item", itemId });
    },
    [dispatchPreview],
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
    dropInventoryItemOnLock,
    equipPreviewInventoryItem,
    resetPreview,
  };
}
