import { ReactNode, useCallback, useRef, useState } from "react";

import { HelpHint } from "@/components/HelpHint";
import {
  CharacterLayer,
  CinematicBlock,
  DEFAULT_SCENE_LAYOUT,
  DialogueBlock,
  GameplayBlock,
  SceneLayout,
  SceneLayerLayout,
  StoryBlock,
} from "@/lib/story";

interface DialogueSceneClipboard {
  backgroundAssetId: string | null;
  characterAssetId: string | null;
  characterLayers: CharacterLayer[];
  sceneLayout: SceneLayout;
}

// Persists across block selections within the session.
let dialogueSceneClipboard: DialogueSceneClipboard | null = null;

interface SceneCopyPasteProps {
  block: DialogueBlock | CinematicBlock | GameplayBlock;
  canEdit: boolean;
  onUpdateSelectedBlock: (updater: (block: StoryBlock) => StoryBlock) => void;
  onStatusMessage: (message: string) => void;
}

export function SceneCopyPaste({
  block,
  canEdit,
  onUpdateSelectedBlock,
  onStatusMessage,
}: SceneCopyPasteProps) {
  const [hasClipboard, setHasClipboard] = useState(dialogueSceneClipboard !== null);

  const copyScene = useCallback(() => {
    dialogueSceneClipboard = {
      backgroundAssetId: block.backgroundAssetId,
      characterAssetId: block.type !== "gameplay" ? block.characterAssetId : null,
      characterLayers:
        block.type === "dialogue" || block.type === "cinematic"
          ? structuredClone(block.characterLayers ?? [])
          : [],
      sceneLayout: structuredClone(block.sceneLayout),
    };
    setHasClipboard(true);
    onStatusMessage("Scene copiee (images + positionnement).");
  }, [block, onStatusMessage]);

  const pasteScene = useCallback(() => {
    if (!dialogueSceneClipboard) return;
    const clip = dialogueSceneClipboard;
    onUpdateSelectedBlock((candidate) => {
      if (candidate.type === "dialogue") {
        return {
          ...candidate,
          backgroundAssetId: clip.backgroundAssetId,
          characterLayers: structuredClone(clip.characterLayers),
          sceneLayout: structuredClone(clip.sceneLayout),
        };
      }
      if (candidate.type === "cinematic") {
        const legacyCharacterAssetId =
          clip.characterAssetId ?? clip.characterLayers.find((layer) => layer.assetId)?.assetId ?? null;
        return {
          ...candidate,
          backgroundAssetId: clip.backgroundAssetId,
          characterAssetId: legacyCharacterAssetId,
          characterLayers: structuredClone(clip.characterLayers),
          sceneLayout: structuredClone(clip.sceneLayout),
        };
      }
      if (candidate.type === "gameplay") {
        return {
          ...candidate,
          backgroundAssetId: clip.backgroundAssetId,
          sceneLayout: structuredClone(clip.sceneLayout),
        };
      }
      return candidate;
    });
    onStatusMessage("Scene collee (images + positionnement).");
  }, [onUpdateSelectedBlock, onStatusMessage]);

  return (
    <div className="section-title-row" style={{ marginBottom: 4 }}>
      <span style={{ fontSize: 13, color: "#aaa" }}>Scene visuelle</span>
      <div style={{ display: "flex", gap: 6 }}>
        <button className="button-secondary" onClick={copyScene} title="Copier images + positionnement">
          Copier scene
        </button>
        <button
          className="button-secondary"
          onClick={pasteScene}
          disabled={!canEdit || !hasClipboard}
          title="Coller images + positionnement depuis un autre bloc"
        >
          Coller scene
        </button>
      </div>
    </div>
  );
}

interface SceneCharacterLayerInfo {
  key: string;
  label: string;
  src: string | undefined;
  zIndex: number;
  layout: SceneLayerLayout;
}

interface SceneComposerProps {
  layout: SceneLayout;
  bgSrc: string | undefined;
  characterLayers?: SceneCharacterLayerInfo[];
  charSrc?: string | undefined;
  canEdit: boolean;
  onChange: (layout: SceneLayout) => void;
  onChangeCharacterLayout?: (layerId: string, layout: SceneLayerLayout) => void;
  children?: ReactNode;
  sceneClassName?: string;
  onSceneClick?: (event: React.MouseEvent<HTMLDivElement>) => void;
  onScenePointerMove?: (event: React.PointerEvent<HTMLDivElement>) => void;
  onScenePointerUp?: (event: React.PointerEvent<HTMLDivElement>) => void;
  onScenePointerCancel?: (event: React.PointerEvent<HTMLDivElement>) => void;
}

type DragTarget = { kind: "bg" } | { kind: "char" } | { kind: "layer"; layerId: string };

export function SceneComposer({
  layout: layoutProp,
  bgSrc,
  characterLayers,
  charSrc,
  canEdit,
  onChange,
  onChangeCharacterLayout,
  children,
  sceneClassName,
  onSceneClick,
  onScenePointerMove,
  onScenePointerUp,
  onScenePointerCancel,
}: SceneComposerProps) {
  const layout = layoutProp ?? DEFAULT_SCENE_LAYOUT;
  const sceneRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    target: DragTarget;
    mode: "move" | "resize";
    startX: number;
    startY: number;
    origRect: SceneLayerLayout;
  } | null>(null);

  const hasBg = Boolean(bgSrc);
  const hasLayers = (characterLayers?.length ?? 0) > 0;
  const hasSingleChar = Boolean(charSrc) && !hasLayers;

  const getTargetLayout = useCallback(
    (target: DragTarget): SceneLayerLayout => {
      if (target.kind === "bg") return layout.background;
      if (target.kind === "char") return layout.character;
      return (
        characterLayers?.find((layer) => layer.key === target.layerId)?.layout ?? {
          x: 0,
          y: 0,
          width: 50,
          height: 80,
        }
      );
    },
    [characterLayers, layout],
  );

  const applyPatch = useCallback(
    (target: DragTarget, patch: Partial<SceneLayerLayout>) => {
      if (target.kind === "bg") {
        onChange({ ...layout, background: { ...layout.background, ...patch } });
      } else if (target.kind === "char") {
        onChange({ ...layout, character: { ...layout.character, ...patch } });
      } else if (onChangeCharacterLayout) {
        const current =
          characterLayers?.find((layer) => layer.key === target.layerId)?.layout ?? {
            x: 0,
            y: 0,
            width: 50,
            height: 80,
          };
        onChangeCharacterLayout(target.layerId, { ...current, ...patch });
      }
    },
    [characterLayers, layout, onChange, onChangeCharacterLayout],
  );

  const startDrag = useCallback(
    (event: React.PointerEvent, target: DragTarget, mode: "move" | "resize") => {
      if (!canEdit) return;
      event.preventDefault();
      event.stopPropagation();
      dragRef.current = {
        target,
        mode,
        startX: event.clientX,
        startY: event.clientY,
        origRect: { ...getTargetLayout(target) },
      };
      (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    },
    [canEdit, getTargetLayout],
  );

  const handlePointerMove = useCallback(
    (event: React.PointerEvent) => {
      const dragState = dragRef.current;
      if (!dragState || !sceneRef.current) return;
      const rect = sceneRef.current.getBoundingClientRect();
      const dx = ((event.clientX - dragState.startX) / rect.width) * 100;
      const dy = ((event.clientY - dragState.startY) / rect.height) * 100;

      if (dragState.mode === "move") {
        applyPatch(dragState.target, {
          x: Math.round(dragState.origRect.x + dx),
          y: Math.round(dragState.origRect.y + dy),
        });
      } else {
        applyPatch(dragState.target, {
          width: Math.round(Math.max(5, dragState.origRect.width + dx)),
          height: Math.round(Math.max(5, dragState.origRect.height + dy)),
        });
      }
    },
    [applyPatch],
  );

  const handlePointerUp = useCallback(() => {
    dragRef.current = null;
  }, []);

  const renderBox = (
    target: DragTarget,
    rect: SceneLayerLayout,
    src: string | undefined,
    label: string,
    isCharacter: boolean,
    zStyle?: number,
  ) => {
    if (!src) return null;
    return (
      <div
        key={target.kind === "layer" ? target.layerId : target.kind}
        className={`scene-composer-box${isCharacter ? " scene-composer-box-char" : ""}`}
        style={{
          left: `${rect.x}%`,
          top: `${rect.y}%`,
          width: `${rect.width}%`,
          height: `${rect.height}%`,
          zIndex: zStyle ?? (isCharacter ? 2 : 1),
        }}
        onPointerDown={(event) => startDrag(event, target, "move")}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- editor scene uses dynamic blob URLs and free-form transforms. */}
        <img
          src={src}
          alt={label}
          className="scene-composer-box-img"
          draggable={false}
          style={{ objectFit: isCharacter ? "contain" : "cover" }}
        />
        <span className="scene-composer-box-label">{label}</span>
        <div
          className="scene-composer-resize-handle"
          onPointerDown={(event) => {
            event.stopPropagation();
            startDrag(event, target, "resize");
          }}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        />
      </div>
    );
  };

  return (
    <div className="scene-composer">
      <div className="scene-composer-label">
        <div className="title-with-help">
          <strong>Composition de scene</strong>
          <HelpHint title="Composition">
            Glisse les images pour les positionner. Tire le coin en bas a droite pour redimensionner.
            Les lignes de repere (tiers + centre) aident a garder des tailles coherentes entre les
            blocs. Les coordonnees sont sauvegardees dans le JSON.
          </HelpHint>
        </div>
        <button
          className="button-secondary"
          onClick={() => onChange({ ...DEFAULT_SCENE_LAYOUT })}
          disabled={!canEdit}
          title="Reinitialiser la composition"
        >
          Reset
        </button>
      </div>

      <div
        ref={sceneRef}
        className={`scene-composer-scene${sceneClassName ? ` ${sceneClassName}` : ""}`}
        onClick={onSceneClick}
        onPointerMove={onScenePointerMove}
        onPointerUp={onScenePointerUp}
        onPointerCancel={onScenePointerCancel}
      >
        <div className="scene-composer-guide scene-composer-guide-h" style={{ top: "33.33%" }} />
        <div className="scene-composer-guide scene-composer-guide-h" style={{ top: "50%" }}>
          <span className="scene-composer-guide-label">50%</span>
        </div>
        <div className="scene-composer-guide scene-composer-guide-h" style={{ top: "66.66%" }} />
        <div className="scene-composer-guide scene-composer-guide-v" style={{ left: "50%" }} />

        {!hasBg && !hasLayers && !hasSingleChar && (
          <div className="scene-composer-empty">Ajoute un fond ou un personnage</div>
        )}
        {renderBox({ kind: "bg" }, layout.background, bgSrc, "Fond", false)}
        {[...(characterLayers ?? [])]
          .sort((left, right) => right.zIndex - left.zIndex)
          .map((layer) =>
            renderBox(
              { kind: "layer", layerId: layer.key },
              layer.layout,
              layer.src,
              `${layer.label} (${layer.zIndex})`,
              true,
              10 - layer.zIndex,
            ),
          )}
        {hasSingleChar && renderBox({ kind: "char" }, layout.character, charSrc, "Perso", true)}
        {children}
      </div>
    </div>
  );
}
