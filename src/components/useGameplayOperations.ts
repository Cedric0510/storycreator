import {
  MouseEvent,
  PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  clampPercent,
  normalizeRectPercent,
} from "@/components/author-studio-core";
import {
  GameplayPlacementTarget,
} from "@/components/author-studio-types";
import {
  GameplayBlock,
  GameplayObject,
  StoryBlock,
  defaultGameplayObject,
} from "@/lib/story";

/* ------------------------------------------------------------------ */
/*  Internal types                                                     */
/* ------------------------------------------------------------------ */

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

  /* Auto-clear when selected block changes or is not gameplay */
  useEffect(() => {
    if (!selectedBlock || selectedBlock.type !== "gameplay") {
      setGameplayPlacementTarget(null);
      setGameplayDragState(null);
      return;
    }
    if (gameplayDragState) {
      const exists = selectedBlock.objects.some((o) => o.id === gameplayDragState.objectId);
      if (!exists) setGameplayDragState(null);
    }
  }, [selectedBlock, gameplayDragState]);

  const resetGameplayState = useCallback(() => {
    setGameplayPlacementTarget(null);
    setGameplayDragState(null);
  }, []);

  const asGameplay = (): GameplayBlock | null =>
    canEdit && selectedBlock?.type === "gameplay" ? selectedBlock : null;

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
      return {
        ...b,
        objects: b.objects
          .filter((o) => o.id !== objectId)
          .map((o) =>
            o.objectType === "lock" && o.linkedKeyId === objectId
              ? { ...o, linkedKeyId: null }
              : o,
          ),
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

  const updateGameplayObjectRect = useCallback(
    (objectId: string, field: "x" | "y" | "width" | "height", value: number) => {
      updateGameplayObject(objectId, (obj) => {
        const updated = { ...obj, [field]: value };
        const rect = normalizeRectPercent(updated);
        return { ...obj, ...rect };
      });
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
        x: clampPercent(x),
        y: clampPercent(y),
      }));
    },
    [updateGameplayObject],
  );

  const startGameplayObjectDrag = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>, objectId: string) => {
      const block = asGameplay();
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
      const block = asGameplay();
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
    if (!gameplayDragState) return;
    if (event.pointerId !== gameplayDragState.pointerId) return;

    const container = event.currentTarget;
    const containerRect = container.getBoundingClientRect();
    if (containerRect.width <= 0 || containerRect.height <= 0) return;

    const xPercent = ((event.clientX - containerRect.left) / containerRect.width) * 100;
    const yPercent = ((event.clientY - containerRect.top) / containerRect.height) * 100;

    if (gameplayDragState.mode === "move") {
      moveGameplayObject(
        gameplayDragState.objectId,
        xPercent - gameplayDragState.offsetX,
        yPercent - gameplayDragState.offsetY,
      );
    } else {
      // resize: offset stores the pointer start position in %
      const dxPercent = xPercent - gameplayDragState.offsetX;
      const dyPercent = yPercent - gameplayDragState.offsetY;
      const newW = Math.max(3, gameplayDragState.origWidth + dxPercent);
      const newH = Math.max(3, gameplayDragState.origHeight + dyPercent);
      updateGameplayObject(gameplayDragState.objectId, (obj) => ({
        ...obj,
        width: clampPercent(newW),
        height: clampPercent(newH),
      }));
    }
    event.preventDefault();
  };

  const onGameplayScenePointerEnd = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!gameplayDragState) return;
    if (event.pointerId !== gameplayDragState.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setGameplayDragState(null);
  };

  const onGameplaySceneClick = (event: MouseEvent<HTMLDivElement>) => {
    if (!selectedBlock || selectedBlock.type !== "gameplay" || !gameplayPlacementTarget) return;
    const container = event.currentTarget;
    const rect = container.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    const xPercent = clampPercent(((event.clientX - rect.left) / rect.width) * 100);
    const yPercent = clampPercent(((event.clientY - rect.top) / rect.height) * 100);

    const obj = selectedBlock.objects.find((o) => o.id === gameplayPlacementTarget.objectId);
    if (!obj) return;
    moveGameplayObject(obj.id, xPercent - obj.width / 2, yPercent - obj.height / 2);
  };

  return {
    gameplayPlacementTarget,
    setGameplayPlacementTarget,
    resetGameplayState,
    // Objects
    addGameplayObject,
    removeGameplayObject,
    updateGameplayObjectField,
    updateGameplayObjectRect,
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
