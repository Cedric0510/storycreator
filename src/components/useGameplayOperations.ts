import {
  MouseEvent,
  PointerEvent as ReactPointerEvent,
  useCallback,
  useState,
} from "react";

import {
  GameplayPlacementTarget,
} from "@/components/author-studio-types";
import {
  GameplayBlock,
  GameplayObject,
  MAX_GAMEPLAY_BUTTONS,
  StoryBlock,
  defaultGameplayObject,
} from "@/lib/story";

/* ------------------------------------------------------------------ */
/*  Internal types                                                     */
/* ------------------------------------------------------------------ */

const MIN_GAMEPLAY_OBJECT_SIZE_PERCENT = 5;

function sanitizePercent(value: number, fallback: number) {
  if (!Number.isFinite(value) || Number.isNaN(value)) return fallback;
  return Number(value.toFixed(2));
}

function sanitizeGameplaySize(value: number, fallback: number) {
  return Math.max(
    MIN_GAMEPLAY_OBJECT_SIZE_PERCENT,
    sanitizePercent(value, Math.max(MIN_GAMEPLAY_OBJECT_SIZE_PERCENT, fallback)),
  );
}

interface GameplayDragState {
  objectId: string;
  pointerId: number;
  mode: "move" | "resize";
  offsetX: number;
  offsetY: number;
  origWidth: number;
  origHeight: number;
}

/* ------------------------------------------------------------------ */
/*  Params                                                             */
/* ------------------------------------------------------------------ */

interface UseGameplayOperationsParams {
  canEdit: boolean;
  selectedBlock: StoryBlock | null;
  updateSelectedBlock: (updater: (block: StoryBlock) => StoryBlock) => void;
}

function asEditableGameplayBlock(
  canEdit: boolean,
  selectedBlock: StoryBlock | null,
): GameplayBlock | null {
  return canEdit && selectedBlock?.type === "gameplay" ? selectedBlock : null;
}

/* ------------------------------------------------------------------ */
/*  Hook                                                               */
/* ------------------------------------------------------------------ */

export function useGameplayOperations({
  canEdit,
  selectedBlock,
  updateSelectedBlock,
}: UseGameplayOperationsParams) {

  const [gameplayPlacementTarget, setGameplayPlacementTarget] =
    useState<GameplayPlacementTarget | null>(null);
  const [gameplayDragState, setGameplayDragState] = useState<GameplayDragState | null>(null);

  const resetGameplayState = useCallback(() => {
    setGameplayPlacementTarget(null);
    setGameplayDragState(null);
  }, []);

  const gameplayBlock = asEditableGameplayBlock(canEdit, selectedBlock);
  const activeGameplayPlacementTarget =
    gameplayPlacementTarget &&
    gameplayBlock?.objects.some((obj) => obj.id === gameplayPlacementTarget.objectId)
      ? gameplayPlacementTarget
      : null;
  const activeGameplayDragState =
    gameplayDragState &&
    gameplayBlock?.objects.some((obj) => obj.id === gameplayDragState.objectId)
      ? gameplayDragState
      : null;

  /* ── Objects ── */

  const addGameplayObject = useCallback(() => {
    updateSelectedBlock((b) => {
      if (b.type !== "gameplay") return b;
      return { ...b, objects: [...b.objects, defaultGameplayObject()] };
    });
  }, [updateSelectedBlock]);

  const removeGameplayObject = useCallback((objectId: string) => {
    updateSelectedBlock((b) => {
      if (b.type !== "gameplay") return b;
      const nextObjects = b.objects
        .filter((o) => o.id !== objectId)
        .map((o) =>
          o.objectType === "lock" && o.linkedKeyId === objectId
            ? { ...o, linkedKeyId: null }
            : o,
        );
      const nextButtonIds = new Set(
        nextObjects.filter((o) => o.objectType === "button").map((o) => o.id),
      );
      const nextButtonSequence = (b.buttonSequence ?? [])
        .filter((buttonId) => buttonId !== objectId && nextButtonIds.has(buttonId))
        .slice(0, MAX_GAMEPLAY_BUTTONS);

      return {
        ...b,
        objects: nextObjects,
        buttonSequence: nextButtonSequence,
        buttonSequenceSuccessBlockId:
          nextButtonIds.size > 0 ? b.buttonSequenceSuccessBlockId : null,
        buttonSequenceFailureBlockId:
          nextButtonIds.size > 0 ? b.buttonSequenceFailureBlockId : null,
      };
    });
  }, [updateSelectedBlock]);

  const updateGameplayObject = useCallback(
    (objectId: string, updater: (obj: GameplayObject) => GameplayObject) => {
      updateSelectedBlock((b) => {
        if (b.type !== "gameplay") return b;
        return {
          ...b,
          objects: b.objects.map((o) => (o.id === objectId ? updater(o) : o)),
        };
      });
    },
    [updateSelectedBlock],
  );

  const updateGameplayObjectField = useCallback(
    <K extends keyof GameplayObject>(objectId: string, field: K, value: GameplayObject[K]) => {
      updateGameplayObject(objectId, (obj) => ({ ...obj, [field]: value }));
    },
    [updateGameplayObject],
  );

  const clearGameplayObjectAsset = useCallback(
    (objectId: string) => {
      updateGameplayObjectField(objectId, "assetId", null);
    },
    [updateGameplayObjectField],
  );

  const clearGameplayObjectSound = useCallback(
    (objectId: string) => {
      updateGameplayObjectField(objectId, "soundAssetId", null);
    },
    [updateGameplayObjectField],
  );

  /* ── Object variable effects ── */

  const addGameplayObjectEffect = useCallback(
    (objectId: string) => {
      updateGameplayObject(objectId, (obj) => ({
        ...obj,
        effects: [...obj.effects, { variableId: "", delta: 0 }],
      }));
    },
    [updateGameplayObject],
  );

  const updateGameplayObjectEffect = useCallback(
    (objectId: string, effectIndex: number, field: "variableId" | "delta", value: string | number) => {
      updateGameplayObject(objectId, (obj) => ({
        ...obj,
        effects: obj.effects.map((effect, idx) =>
          idx === effectIndex ? { ...effect, [field]: value } : effect,
        ),
      }));
    },
    [updateGameplayObject],
  );

  const removeGameplayObjectEffect = useCallback(
    (objectId: string, effectIndex: number) => {
      updateGameplayObject(objectId, (obj) => ({
        ...obj,
        effects: obj.effects.filter((_, idx) => idx !== effectIndex),
      }));
    },
    [updateGameplayObject],
  );

  /* ── Completion effects ── */

  const addGameplayCompletionEffect = useCallback(() => {
    updateSelectedBlock((b) => {
      if (b.type !== "gameplay") return b;
      return { ...b, completionEffects: [...b.completionEffects, { variableId: "", delta: 0 }] };
    });
  }, [updateSelectedBlock]);

  const updateGameplayCompletionEffect = useCallback(
    (index: number, field: "variableId" | "delta", value: string | number) => {
      updateSelectedBlock((b) => {
        if (b.type !== "gameplay") return b;
        return {
          ...b,
          completionEffects: b.completionEffects.map((effect, idx) =>
            idx === index ? { ...effect, [field]: value } : effect,
          ),
        };
      });
    },
    [updateSelectedBlock],
  );

  const removeGameplayCompletionEffect = useCallback(
    (index: number) => {
      updateSelectedBlock((b) => {
        if (b.type !== "gameplay") return b;
        return {
          ...b,
          completionEffects: b.completionEffects.filter((_, idx) => idx !== index),
        };
      });
    },
    [updateSelectedBlock],
  );

  /* ── Scene drag-and-drop (pointer capture based) ── */

  const moveGameplayObject = useCallback(
    (objectId: string, x: number, y: number) => {
      updateGameplayObject(objectId, (obj) => ({
        ...obj,
        x: sanitizePercent(x, obj.x),
        y: sanitizePercent(y, obj.y),
      }));
    },
    [updateGameplayObject],
  );

  const startGameplayObjectDrag = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>, objectId: string) => {
      const block = asEditableGameplayBlock(canEdit, selectedBlock);
      if (!block) return;
      const obj = block.objects.find((o) => o.id === objectId);
      if (!obj) return;

      const container = event.currentTarget.closest(
        ".pointclick-editor-scene, .scene-composer-scene",
      ) as HTMLElement | null;
      if (!container) return;
      const containerRect = container.getBoundingClientRect();
      if (containerRect.width <= 0 || containerRect.height <= 0) return;

      const xPercent = ((event.clientX - containerRect.left) / containerRect.width) * 100;
      const yPercent = ((event.clientY - containerRect.top) / containerRect.height) * 100;

      container.setPointerCapture(event.pointerId);

      setGameplayPlacementTarget(null);
      setGameplayDragState({
        objectId,
        pointerId: event.pointerId,
        mode: "move",
        offsetX: xPercent - obj.x,
        offsetY: yPercent - obj.y,
        origWidth: obj.width,
        origHeight: obj.height,
      });

      event.preventDefault();
      event.stopPropagation();
    },
    [canEdit, selectedBlock],
  );

  const startGameplayObjectResize = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>, objectId: string) => {
      const block = asEditableGameplayBlock(canEdit, selectedBlock);
      if (!block) return;
      const obj = block.objects.find((o) => o.id === objectId);
      if (!obj) return;

      const container = event.currentTarget.closest(
        ".pointclick-editor-scene, .scene-composer-scene",
      ) as HTMLElement | null;
      if (!container) return;
      const containerRect = container.getBoundingClientRect();
      if (containerRect.width <= 0 || containerRect.height <= 0) return;

      const xPercent = ((event.clientX - containerRect.left) / containerRect.width) * 100;
      const yPercent = ((event.clientY - containerRect.top) / containerRect.height) * 100;

      container.setPointerCapture(event.pointerId);

      setGameplayPlacementTarget(null);
      setGameplayDragState({
        objectId,
        pointerId: event.pointerId,
        mode: "resize",
        offsetX: xPercent,
        offsetY: yPercent,
        origWidth: obj.width,
        origHeight: obj.height,
      });

      event.preventDefault();
      event.stopPropagation();
    },
    [canEdit, selectedBlock],
  );

  const onGameplayScenePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (gameplayDragState && !activeGameplayDragState) {
      setGameplayDragState(null);
      return;
    }
    if (!activeGameplayDragState) return;
    if (event.pointerId !== activeGameplayDragState.pointerId) return;

    const container = event.currentTarget;
    const containerRect = container.getBoundingClientRect();
    if (containerRect.width <= 0 || containerRect.height <= 0) return;

    const xPercent = ((event.clientX - containerRect.left) / containerRect.width) * 100;
    const yPercent = ((event.clientY - containerRect.top) / containerRect.height) * 100;

    if (activeGameplayDragState.mode === "move") {
      moveGameplayObject(
        activeGameplayDragState.objectId,
        xPercent - activeGameplayDragState.offsetX,
        yPercent - activeGameplayDragState.offsetY,
      );
    } else {
      // resize: offset stores the pointer start position in %
      const dxPercent = xPercent - activeGameplayDragState.offsetX;
      const dyPercent = yPercent - activeGameplayDragState.offsetY;
      const newW = activeGameplayDragState.origWidth + dxPercent;
      const newH = activeGameplayDragState.origHeight + dyPercent;
      updateGameplayObject(activeGameplayDragState.objectId, (obj) => ({
        ...obj,
        width: sanitizeGameplaySize(newW, obj.width),
        height: sanitizeGameplaySize(newH, obj.height),
      }));
    }
    event.preventDefault();
  };

  const onGameplayScenePointerEnd = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (gameplayDragState && !activeGameplayDragState) {
      setGameplayDragState(null);
      return;
    }
    if (!activeGameplayDragState) return;
    if (event.pointerId !== activeGameplayDragState.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setGameplayDragState(null);
  };

  const onGameplaySceneClick = (event: MouseEvent<HTMLDivElement>) => {
    if (!gameplayBlock || !activeGameplayPlacementTarget) {
      if (gameplayPlacementTarget) {
        setGameplayPlacementTarget(null);
      }
      return;
    }
    const container = event.currentTarget;
    const rect = container.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    const xPercent = ((event.clientX - rect.left) / rect.width) * 100;
    const yPercent = ((event.clientY - rect.top) / rect.height) * 100;

    const obj = gameplayBlock.objects.find((o) => o.id === activeGameplayPlacementTarget.objectId);
    if (!obj) return;
    moveGameplayObject(obj.id, xPercent - obj.width / 2, yPercent - obj.height / 2);
  };

  return {
    gameplayPlacementTarget: activeGameplayPlacementTarget,
    setGameplayPlacementTarget,
    resetGameplayState,
    // Objects
    addGameplayObject,
    removeGameplayObject,
    updateGameplayObjectField,
    clearGameplayObjectAsset,
    clearGameplayObjectSound,
    // Object effects
    addGameplayObjectEffect,
    updateGameplayObjectEffect,
    removeGameplayObjectEffect,
    // Completion effects
    addGameplayCompletionEffect,
    updateGameplayCompletionEffect,
    removeGameplayCompletionEffect,
    // Scene interaction
    startGameplayObjectDrag,
    startGameplayObjectResize,
    onGameplayScenePointerMove,
    onGameplayScenePointerEnd,
    onGameplaySceneClick,
  };
}
