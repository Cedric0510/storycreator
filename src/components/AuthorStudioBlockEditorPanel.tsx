import { ChangeEvent, MouseEvent, PointerEvent as ReactPointerEvent, ReactNode, useCallback, useEffect, useRef, useState } from "react";

import { normalizeDelta } from "@/components/author-studio-core";
import { GameplayPlacementTarget } from "@/components/author-studio-types";
import { HelpHint } from "@/components/HelpHint";
import {
  BLOCK_LABELS,
  ChoiceBlock,
  CinematicBlock,
  DEFAULT_SCENE_LAYOUT,
  DialogueBlock,
  GameplayBlock,
  GameplayObject,
  GameplayObjectType,
  GameplayUnlockEffect,
  HeroProfileBlock,
  NpcProfileBlock,
  ProjectMeta,
  SceneLayout,
  SceneLayerLayout,
  StoryBlock,
  TitleBlock,
  ValidationIssue,
} from "@/lib/story";

/** Clipboard for dialogue scene visual layout (images + positioning). */
interface DialogueSceneClipboard {
  backgroundAssetId: string | null;
  characterAssetId: string | null;
  sceneLayout: SceneLayout;
}

/** Module-level clipboard — persists across block selections within the session. */
let dialogueSceneClipboard: DialogueSceneClipboard | null = null;

type ChoiceField = "text" | "targetBlockId";
type EffectField = "variableId" | "delta";
type RectField = "x" | "y" | "width" | "height";
type ResponseField = "text" | "targetLineId" | "targetBlockId";

interface AuthorStudioBlockEditorPanelProps {
  selectedBlock: StoryBlock | null;
  canEdit: boolean;
  project: ProjectMeta;
  blocks: StoryBlock[];
  visibleIssues: ValidationIssue[];
  onDeleteSelectedBlock: () => void;
  onRunValidation: () => void;
  onSetStartBlock: (blockId: string) => void;
  onSetSelectedDynamicField: (key: string, value: unknown) => void;
  onUpdateSelectedBlock: (updater: (block: StoryBlock) => StoryBlock) => void;
  onSetConnection: (sourceId: string, sourceHandle: string, targetId: string | null) => void;
  onAssetInput: (fieldName: string) => (event: ChangeEvent<HTMLInputElement>) => void;
  renderAssetAttachment: (fieldName: string, assetId: string | null) => ReactNode;
  renderAssetAttachmentWithRemove: (assetId: string | null, onRemove: () => void) => ReactNode;
  onAddDialogueLine: () => void;
  onRemoveDialogueLine: (lineId: string) => void;
  onUpdateDialogueLineField: (lineId: string, field: string, value: string | null) => void;
  onDialogueLineVoiceInput: (lineId: string) => (event: ChangeEvent<HTMLInputElement>) => void;
  renderLineVoiceAttachment: (lineId: string, assetId: string | null) => ReactNode;
  onAddDialogueLineResponse: (lineId: string) => void;
  onRemoveDialogueLineResponse: (lineId: string, responseId: string) => void;
  onUpdateDialogueResponseField: (lineId: string, responseId: string, field: ResponseField, value: string) => void;
  onUpdateChoiceField: (choiceId: string, field: ChoiceField, value: string) => void;
  onUnlinkDialogueNpcProfile: (dialogueBlockId: string) => void;
  onAddBlockEntryEffect: () => void;
  onUpdateBlockEntryEffect: (effectIndex: number, key: EffectField, value: string) => void;
  onRemoveBlockEntryEffect: (effectIndex: number) => void;
  onAddResponseEffect: (lineId: string, responseId: string) => void;
  onUpdateResponseEffect: (
    lineId: string,
    responseId: string,
    effectIndex: number,
    key: EffectField,
    value: string,
  ) => void;
  onRemoveResponseEffect: (lineId: string, responseId: string, effectIndex: number) => void;
  onAddChoiceEffect: (choiceId: string) => void;
  onUpdateChoiceEffect: (
    choiceId: string,
    effectIndex: number,
    key: EffectField,
    value: string,
  ) => void;
  onRemoveChoiceEffect: (choiceId: string, effectIndex: number) => void;
  onAddChoiceOption: () => void;
  onRemoveChoiceOption: () => void;
  onUpdateChoiceOptionDescription: (optionId: string, value: string) => void;
  onSetChoiceOptionImage: (optionId: string, file: File) => void;
  onClearChoiceOptionImage: (optionId: string) => void;
  onAddGameplayObject: () => void;
  onRemoveGameplayObject: (objectId: string) => void;
  onUpdateGameplayObjectField: <K extends keyof GameplayObject>(objectId: string, field: K, value: GameplayObject[K]) => void;
  onUpdateGameplayObjectRect: (objectId: string, field: RectField, value: number) => void;
  onClearGameplayObjectAsset: (objectId: string) => void;
  onClearGameplayObjectSound: (objectId: string) => void;
  onAddGameplayObjectEffect: (objectId: string) => void;
  onUpdateGameplayObjectEffect: (objectId: string, effectIndex: number, field: "variableId" | "delta", value: string | number) => void;
  onRemoveGameplayObjectEffect: (objectId: string, effectIndex: number) => void;
  onAddGameplayCompletionEffect: () => void;
  onUpdateGameplayCompletionEffect: (index: number, field: EffectField, value: string | number) => void;
  onRemoveGameplayCompletionEffect: (index: number) => void;
  gameplayPlacementTarget: GameplayPlacementTarget | null;
  onSetGameplayPlacementTarget: (target: GameplayPlacementTarget | null) => void;
  onStartGameplayObjectDrag: (event: ReactPointerEvent<HTMLDivElement>, objectId: string) => void;
  onGameplaySceneClick: (event: MouseEvent<HTMLDivElement>) => void;
  onGameplayScenePointerMove: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onGameplayScenePointerEnd: (event: ReactPointerEvent<HTMLDivElement>) => void;
  assetPreviewSrcById: Record<string, string>;
  onRegisterAsset: (file: File) => string;
  onEnsureAssetPreviewSrc: (assetId: string) => Promise<string | null>;
  onStatusMessage: (message: string) => void;
}

interface NextBlockSelectProps {
  selectedBlockId: string;
  nextBlockId: string | null;
  blocks: StoryBlock[];
  canEdit: boolean;
  onChange: (targetId: string | null) => void;
}

function NextBlockSelect({
  selectedBlockId,
  nextBlockId,
  blocks,
  canEdit,
  onChange,
}: NextBlockSelectProps) {
  return (
    <label>
      Bloc suivant
      <select
        value={nextBlockId ?? ""}
        onChange={(event) => onChange(event.target.value || null)}
        disabled={!canEdit}
      >
        <option value="">Fin histoire</option>
        {blocks
          .filter(
            (block) =>
              block.id !== selectedBlockId &&
              block.type !== "hero_profile" &&
              block.type !== "npc_profile",
          )
          .map((block) => (
            <option key={block.id} value={block.id}>
              {block.name} ({BLOCK_LABELS[block.type]})
            </option>
          ))}
      </select>
    </label>
  );
}

interface TitleEditorSectionProps {
  block: TitleBlock;
  canEdit: boolean;
  blocks: StoryBlock[];
  onSetSelectedDynamicField: (key: string, value: unknown) => void;
  onUpdateSelectedBlock: (updater: (block: StoryBlock) => StoryBlock) => void;
  onSetConnection: (sourceId: string, sourceHandle: string, targetId: string | null) => void;
  onAssetInput: (fieldName: string) => (event: ChangeEvent<HTMLInputElement>) => void;
  renderAssetAttachment: (fieldName: string, assetId: string | null) => ReactNode;
}

function TitleEditorSection({
  block,
  canEdit,
  blocks,
  onSetSelectedDynamicField,
  onUpdateSelectedBlock,
  onSetConnection,
  onAssetInput,
  renderAssetAttachment,
}: TitleEditorSectionProps) {
  return (
    <div className="subsection">
      <div className="title-with-help">
        <h3>Bloc titre</h3>
        <HelpHint title="Bloc ecran titre">
          Configure la page d&apos;accueil de l&apos;histoire: image de fond, texte et style des
          boutons.
        </HelpHint>
      </div>
      <label>
        Titre histoire
        <input
          value={block.storyTitle}
          onChange={(event) => onSetSelectedDynamicField("storyTitle", event.target.value)}
          disabled={!canEdit}
        />
      </label>
      <label>
        Sous titre
        <input
          value={block.subtitle}
          onChange={(event) => onSetSelectedDynamicField("subtitle", event.target.value)}
          disabled={!canEdit}
        />
      </label>
      <label>
        Image de fond
        <input
          type="file"
          accept="image/*"
          onChange={onAssetInput("backgroundAssetId")}
          disabled={!canEdit}
        />
      </label>
      {renderAssetAttachment("backgroundAssetId", block.backgroundAssetId)}

      <div className="grid-two">
        <label>
          Bouton BG
          <input
            type="color"
            value={block.buttonStyle.backgroundColor}
            onChange={(event) =>
              onUpdateSelectedBlock((candidate) => {
                if (candidate.type !== "title") return candidate;
                return {
                  ...candidate,
                  buttonStyle: { ...candidate.buttonStyle, backgroundColor: event.target.value },
                };
              })
            }
            disabled={!canEdit}
          />
        </label>
        <label>
          Bouton texte
          <input
            type="color"
            value={block.buttonStyle.textColor}
            onChange={(event) =>
              onUpdateSelectedBlock((candidate) => {
                if (candidate.type !== "title") return candidate;
                return {
                  ...candidate,
                  buttonStyle: { ...candidate.buttonStyle, textColor: event.target.value },
                };
              })
            }
            disabled={!canEdit}
          />
        </label>
        <label>
          Border
          <input
            type="color"
            value={block.buttonStyle.borderColor}
            onChange={(event) =>
              onUpdateSelectedBlock((candidate) => {
                if (candidate.type !== "title") return candidate;
                return {
                  ...candidate,
                  buttonStyle: { ...candidate.buttonStyle, borderColor: event.target.value },
                };
              })
            }
            disabled={!canEdit}
          />
        </label>
        <label>
          Rayon
          <input
            type="number"
            value={block.buttonStyle.radius}
            onChange={(event) =>
              onUpdateSelectedBlock((candidate) => {
                if (candidate.type !== "title") return candidate;
                return {
                  ...candidate,
                  buttonStyle: { ...candidate.buttonStyle, radius: normalizeDelta(event.target.value) },
                };
              })
            }
            disabled={!canEdit}
          />
        </label>
      </div>

      <NextBlockSelect
        selectedBlockId={block.id}
        nextBlockId={block.nextBlockId}
        blocks={blocks}
        canEdit={canEdit}
        onChange={(targetId) => onSetConnection(block.id, "next", targetId)}
      />
    </div>
  );
}

interface CinematicEditorSectionProps {
  block: CinematicBlock;
  canEdit: boolean;
  blocks: StoryBlock[];
  assetPreviewSrcById: Record<string, string>;
  onSetSelectedDynamicField: (key: string, value: unknown) => void;
  onUpdateSelectedBlock: (updater: (block: StoryBlock) => StoryBlock) => void;
  onSetConnection: (sourceId: string, sourceHandle: string, targetId: string | null) => void;
  onAssetInput: (fieldName: string) => (event: ChangeEvent<HTMLInputElement>) => void;
  renderAssetAttachment: (fieldName: string, assetId: string | null) => ReactNode;
  onStatusMessage: (message: string) => void;
}

function CinematicEditorSection({
  block,
  canEdit,
  blocks,
  assetPreviewSrcById,
  onSetSelectedDynamicField,
  onUpdateSelectedBlock,
  onSetConnection,
  onAssetInput,
  renderAssetAttachment,
  onStatusMessage,
}: CinematicEditorSectionProps) {
  return (
    <div className="subsection">
      <div className="title-with-help">
        <h3>Bloc cinematique</h3>
        <HelpHint title="Bloc cinematique">
          Permet de raconter une scene avec texte, image/video/voix puis d&apos;avancer vers
          un autre bloc. Tu peux aussi ajouter un personnage et positionner la scene.
        </HelpHint>
      </div>
      <label>
        Titre scene
        <input
          value={block.heading}
          onChange={(event) => onSetSelectedDynamicField("heading", event.target.value)}
          disabled={!canEdit}
        />
      </label>
      <label>
        Texte / narration
        <textarea
          rows={4}
          value={block.body}
          onChange={(event) => onSetSelectedDynamicField("body", event.target.value)}
          disabled={!canEdit}
        />
      </label>
      <label>
        Auto avance (secondes)
        <input
          type="number"
          value={block.autoAdvanceSeconds ?? ""}
          placeholder="vide = manuel"
          onChange={(event) =>
            onSetSelectedDynamicField(
              "autoAdvanceSeconds",
              event.target.value ? normalizeDelta(event.target.value) : null,
            )
          }
          disabled={!canEdit}
        />
      </label>

      {/* --- Scene clipboard: copy / paste images + layout --- */}
      <SceneCopyPaste
        block={block}
        canEdit={canEdit}
        onUpdateSelectedBlock={onUpdateSelectedBlock}
        onStatusMessage={onStatusMessage}
      />

      <label>
        Image fond
        <input
          type="file"
          accept="image/*"
          onChange={onAssetInput("backgroundAssetId")}
          disabled={!canEdit}
        />
      </label>
      {renderAssetAttachment("backgroundAssetId", block.backgroundAssetId)}
      <label>
        Image personnage
        <input
          type="file"
          accept="image/*"
          onChange={onAssetInput("characterAssetId")}
          disabled={!canEdit}
        />
      </label>
      {renderAssetAttachment("characterAssetId", block.characterAssetId)}

      {/* --- Scene Composer --- */}
      {(() => {
        const bgSrc = assetPreviewSrcById[block.backgroundAssetId ?? ""];
        const charSrc = assetPreviewSrcById[block.characterAssetId ?? ""];
        const hasAnyAsset = block.backgroundAssetId || block.characterAssetId;
        if (!hasAnyAsset) return null;
        return (
          <SceneComposer
            layout={block.sceneLayout}
            bgSrc={bgSrc}
            charSrc={charSrc}
            canEdit={canEdit}
            onChange={(newLayout) => {
              onUpdateSelectedBlock((b) =>
                b.type === "cinematic" ? { ...b, sceneLayout: newLayout } : b,
              );
            }}
          />
        );
      })()}

      <label>
        Video
        <input
          type="file"
          accept="video/*"
          onChange={onAssetInput("videoAssetId")}
          disabled={!canEdit}
        />
      </label>
      {renderAssetAttachment("videoAssetId", block.videoAssetId)}
      <label>
        Voix off
        <input
          type="file"
          accept="audio/*"
          onChange={onAssetInput("voiceAssetId")}
          disabled={!canEdit}
        />
      </label>
      {renderAssetAttachment("voiceAssetId", block.voiceAssetId)}

      <NextBlockSelect
        selectedBlockId={block.id}
        nextBlockId={block.nextBlockId}
        blocks={blocks}
        canEdit={canEdit}
        onChange={(targetId) => onSetConnection(block.id, "next", targetId)}
      />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   Scene Copy / Paste — images + layout clipboard (dialogue & cinematic)
   ═══════════════════════════════════════════════════════════ */

interface SceneCopyPasteProps {
  block: DialogueBlock | CinematicBlock;
  canEdit: boolean;
  onUpdateSelectedBlock: (updater: (block: StoryBlock) => StoryBlock) => void;
  onStatusMessage: (message: string) => void;
}

function SceneCopyPaste({
  block,
  canEdit,
  onUpdateSelectedBlock,
  onStatusMessage,
}: SceneCopyPasteProps) {
  const [hasClipboard, setHasClipboard] = useState(dialogueSceneClipboard !== null);

  const copyScene = useCallback(() => {
    dialogueSceneClipboard = {
      backgroundAssetId: block.backgroundAssetId,
      characterAssetId: block.characterAssetId,
      sceneLayout: structuredClone(block.sceneLayout),
    };
    setHasClipboard(true);
    onStatusMessage("Scene copiee (images + positionnement).");
  }, [block.backgroundAssetId, block.characterAssetId, block.sceneLayout, onStatusMessage]);

  const pasteScene = useCallback(() => {
    if (!dialogueSceneClipboard) return;
    const clip = dialogueSceneClipboard;
    onUpdateSelectedBlock((b) => {
      if (b.type === "dialogue") {
        return {
          ...b,
          backgroundAssetId: clip.backgroundAssetId,
          characterAssetId: b.npcProfileBlockId ? b.characterAssetId : clip.characterAssetId,
          sceneLayout: structuredClone(clip.sceneLayout),
        };
      }
      if (b.type === "cinematic") {
        return {
          ...b,
          backgroundAssetId: clip.backgroundAssetId,
          characterAssetId: clip.characterAssetId,
          sceneLayout: structuredClone(clip.sceneLayout),
        };
      }
      return b;
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

/* ═══════════════════════════════════════════════
   Scene Composer — gameplay-style drag & resize
   ═══════════════════════════════════════════════ */

interface SceneComposerProps {
  layout: SceneLayout;
  bgSrc: string | undefined;
  charSrc: string | undefined;
  canEdit: boolean;
  onChange: (layout: SceneLayout) => void;
}

type LayerKey = "background" | "character";

function SceneComposer({ layout, bgSrc, charSrc, canEdit, onChange }: SceneComposerProps) {
  const sceneRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    layer: LayerKey;
    mode: "move" | "resize";
    startX: number;
    startY: number;
    origRect: SceneLayerLayout;
  } | null>(null);

  const hasBg = Boolean(bgSrc);
  const hasChar = Boolean(charSrc);

  const updateLayer = useCallback(
    (layer: LayerKey, patch: Partial<SceneLayerLayout>) => {
      onChange({ ...layout, [layer]: { ...layout[layer], ...patch } });
    },
    [layout, onChange],
  );

  const startDrag = useCallback(
    (e: React.PointerEvent, layer: LayerKey, mode: "move" | "resize") => {
      if (!canEdit) return;
      e.preventDefault();
      e.stopPropagation();
      dragRef.current = {
        layer,
        mode,
        startX: e.clientX,
        startY: e.clientY,
        origRect: { ...layout[layer] },
      };
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    },
    [canEdit, layout],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      const d = dragRef.current;
      if (!d || !sceneRef.current) return;
      const rect = sceneRef.current.getBoundingClientRect();
      const dx = ((e.clientX - d.startX) / rect.width) * 100;
      const dy = ((e.clientY - d.startY) / rect.height) * 100;

      if (d.mode === "move") {
        if (d.layer === "character") {
          // Character may overflow scene bounds
          updateLayer(d.layer, {
            x: Math.round(d.origRect.x + dx),
            y: Math.round(d.origRect.y + dy),
          });
        } else {
          updateLayer(d.layer, {
            x: Math.round(Math.min(100 - d.origRect.width, Math.max(0, d.origRect.x + dx))),
            y: Math.round(Math.min(100 - d.origRect.height, Math.max(0, d.origRect.y + dy))),
          });
        }
      } else {
        if (d.layer === "character") {
          // Character may be scaled beyond 100%
          updateLayer(d.layer, {
            width: Math.round(Math.max(5, d.origRect.width + dx)),
            height: Math.round(Math.max(5, d.origRect.height + dy)),
          });
        } else {
          updateLayer(d.layer, {
            width: Math.round(Math.min(100 - d.origRect.x, Math.max(5, d.origRect.width + dx))),
            height: Math.round(Math.min(100 - d.origRect.y, Math.max(5, d.origRect.height + dy))),
          });
        }
      }
    },
    [updateLayer],
  );

  const handlePointerUp = useCallback(() => {
    dragRef.current = null;
  }, []);

  const renderLayerBox = (layer: LayerKey, src: string | undefined, label: string) => {
    if (!src) return null;
    const r = layout[layer];
    const isChar = layer === "character";
    return (
      <div
        className={`scene-composer-box${isChar ? " scene-composer-box-char" : ""}`}
        style={{
          left: `${r.x}%`,
          top: `${r.y}%`,
          width: `${r.width}%`,
          height: `${r.height}%`,
        }}
        onPointerDown={(e) => startDrag(e, layer, "move")}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <img
          src={src}
          alt={label}
          className="scene-composer-box-img"
          draggable={false}
          style={{ objectFit: isChar ? "contain" : "cover" }}
        />
        <span className="scene-composer-box-label">{label}</span>
        {/* Resize handle (bottom-right corner) */}
        <div
          className="scene-composer-resize-handle"
          onPointerDown={(e) => { e.stopPropagation(); startDrag(e, layer, "resize"); }}
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
            Glisse les images pour les positionner. Tire le coin en bas a droite pour
            redimensionner. Les lignes de repere (tiers + centre) aident a garder des tailles
            coherentes entre les blocs. Les coordonnees sont sauvegardees dans le JSON.
          </HelpHint>
        </div>
        <button
          className="button-secondary"
          onClick={() => onChange({ ...DEFAULT_SCENE_LAYOUT })}
          disabled={!canEdit}
          title="Reinitialiser la composition"
        >↺ Reset</button>
      </div>

      <div
        ref={sceneRef}
        className="scene-composer-scene"
      >
        {/* Visual reference guides — thirds + center */}
        <div className="scene-composer-guide scene-composer-guide-h" style={{ top: "33.33%" }} />
        <div className="scene-composer-guide scene-composer-guide-h" style={{ top: "50%" }}>
          <span className="scene-composer-guide-label">50%</span>
        </div>
        <div className="scene-composer-guide scene-composer-guide-h" style={{ top: "66.66%" }} />
        <div className="scene-composer-guide scene-composer-guide-v" style={{ left: "50%" }} />

        {/* Character size indicator */}
        {hasChar && (
          <div className="scene-composer-size-badge" title="Hauteur du personnage en % de la scene">
            Perso {layout.character.height}%
          </div>
        )}

        {!hasBg && !hasChar && (
          <div className="scene-composer-empty">Ajoute un fond ou un personnage</div>
        )}
        {renderLayerBox("background", bgSrc, "Fond")}
        {renderLayerBox("character", charSrc, "Perso")}
      </div>
    </div>
  );
}

interface DialogueEditorSectionProps {
  block: DialogueBlock;
  canEdit: boolean;
  blocks: StoryBlock[];
  project: ProjectMeta;
  assetPreviewSrcById: Record<string, string>;
  onSetSelectedDynamicField: (key: string, value: unknown) => void;
  onUpdateSelectedBlock: (updater: (block: StoryBlock) => StoryBlock) => void;
  onAssetInput: (fieldName: string) => (event: ChangeEvent<HTMLInputElement>) => void;
  renderAssetAttachment: (fieldName: string, assetId: string | null) => ReactNode;
  onUnlinkDialogueNpcProfile: (dialogueBlockId: string) => void;
  onAddDialogueLine: () => void;
  onRemoveDialogueLine: (lineId: string) => void;
  onUpdateDialogueLineField: (lineId: string, field: string, value: string | null) => void;
  onDialogueLineVoiceInput: (lineId: string) => (event: ChangeEvent<HTMLInputElement>) => void;
  renderLineVoiceAttachment: (lineId: string, assetId: string | null) => ReactNode;
  onAddDialogueLineResponse: (lineId: string) => void;
  onRemoveDialogueLineResponse: (lineId: string, responseId: string) => void;
  onUpdateDialogueResponseField: (lineId: string, responseId: string, field: ResponseField, value: string) => void;
  onAddResponseEffect: (lineId: string, responseId: string) => void;
  onUpdateResponseEffect: (
    lineId: string,
    responseId: string,
    effectIndex: number,
    key: EffectField,
    value: string,
  ) => void;
  onRemoveResponseEffect: (lineId: string, responseId: string, effectIndex: number) => void;
  onStatusMessage: (message: string) => void;
}

function DialogueEditorSection({
  block,
  canEdit,
  blocks,
  project,
  assetPreviewSrcById,
  onSetSelectedDynamicField,
  onUpdateSelectedBlock,
  onAssetInput,
  renderAssetAttachment,
  onUnlinkDialogueNpcProfile,
  onAddDialogueLine,
  onRemoveDialogueLine,
  onUpdateDialogueLineField,
  onDialogueLineVoiceInput,
  renderLineVoiceAttachment,
  onAddDialogueLineResponse,
  onRemoveDialogueLineResponse,
  onUpdateDialogueResponseField,
  onAddResponseEffect,
  onUpdateResponseEffect,
  onRemoveResponseEffect,
  onStatusMessage,
}: DialogueEditorSectionProps) {
  const linkedNpcBlock =
    block.npcProfileBlockId
      ? blocks.find(
          (candidate): candidate is NpcProfileBlock =>
            candidate.id === block.npcProfileBlockId && candidate.type === "npc_profile",
        ) ?? null
      : null;

  const externalBlocks = blocks.filter(
    (candidate) =>
      candidate.id !== block.id &&
      candidate.type !== "hero_profile" &&
      candidate.type !== "npc_profile",
  );

  const npcBlocks = blocks.filter(
    (candidate): candidate is NpcProfileBlock => candidate.type === "npc_profile",
  );

  return (
    <div className="subsection">
      <div className="title-with-help">
        <h3>Bloc dialogue</h3>
        <HelpHint title="Bloc dialogue">
          Contient plusieurs lignes de dialogue. Chaque ligne a ses propres reponses qui peuvent
          mener vers une autre ligne interne ou vers un bloc externe.
        </HelpHint>
      </div>

      {/* --- Block-level NPC link --- */}
      {linkedNpcBlock ? (
        <div className="asset-line">
          <small>PNJ lie: {linkedNpcBlock.npcName || linkedNpcBlock.name}</small>
          <button
            className="button-secondary"
            onClick={() => onUnlinkDialogueNpcProfile(block.id)}
            disabled={!canEdit}
          >
            Retirer lien PNJ
          </button>
        </div>
      ) : (
        <small className="empty-placeholder">
          Astuce: relie un bloc PNJ vers ce dialogue pour piloter automatiquement nom + image.
        </small>
      )}

      {/* --- Scene clipboard: copy / paste images + layout --- */}
      <SceneCopyPaste
        block={block}
        canEdit={canEdit}
        onUpdateSelectedBlock={onUpdateSelectedBlock}
        onStatusMessage={onStatusMessage}
      />

      {/* --- Block-level images --- */}
      <label>
        Image fond
        <input
          type="file"
          accept="image/*"
          onChange={onAssetInput("backgroundAssetId")}
          disabled={!canEdit}
        />
      </label>
      {renderAssetAttachment("backgroundAssetId", block.backgroundAssetId)}
      <label>
        Image personnage
        <input
          type="file"
          accept="image/*"
          onChange={onAssetInput("characterAssetId")}
          disabled={!canEdit}
        />
      </label>
      {renderAssetAttachment("characterAssetId", block.characterAssetId)}
      {linkedNpcBlock && linkedNpcBlock.imageAssetIds.length > 0 && (
        <>
          <label>
            Image PNJ (optionnel)
            <select
              value={block.npcImageAssetId ?? ""}
              onChange={(event) =>
                onSetSelectedDynamicField("npcImageAssetId", event.target.value || null)
              }
              disabled={!canEdit}
            >
              <option value="">Aucune</option>
              {linkedNpcBlock.imageAssetIds.map((assetId, index) => (
                <option key={assetId} value={assetId}>
                  Image PNJ {index + 1}
                </option>
              ))}
            </select>
          </label>
          {renderAssetAttachment(
            "npcImageAssetId",
            block.npcImageAssetId,
          )}
        </>
      )}

      {/* --- Scene Composer --- */}
      {(() => {
        const bgSrc = assetPreviewSrcById[block.backgroundAssetId ?? ""];
        const npcImgSrc = assetPreviewSrcById[block.npcImageAssetId ?? ""];
        const charSrc = npcImgSrc || assetPreviewSrcById[block.characterAssetId ?? ""];
        // Show composer when at least one image asset is assigned (even if URL not yet loaded)
        const hasAnyAsset = block.backgroundAssetId || block.characterAssetId || block.npcImageAssetId;
        if (!hasAnyAsset) return null;
        return (
          <SceneComposer
            layout={block.sceneLayout}
            bgSrc={bgSrc}
            charSrc={charSrc}
            canEdit={canEdit}
            onChange={(newLayout) => {
              onUpdateSelectedBlock((b) =>
                b.type === "dialogue" ? { ...b, sceneLayout: newLayout } : b,
              );
            }}
          />
        );
      })()}

      {/* --- Start line selector --- */}
      <label>
        Ligne de depart
        <select
          value={block.startLineId}
          onChange={(event) => onSetSelectedDynamicField("startLineId", event.target.value)}
          disabled={!canEdit}
        >
          {block.lines.map((line, index) => (
            <option key={line.id} value={line.id}>
              Ligne {index + 1} — {line.speaker || "…"}
            </option>
          ))}
        </select>
      </label>

      {/* --- Lines --- */}
      <div className="section-title-row">
        <div className="title-with-help">
          <h3>Lignes de dialogue ({block.lines.length})</h3>
          <HelpHint title="Lignes de dialogue">
            Chaque ligne represente une replique. Les reponses d&apos;une ligne peuvent pointer vers
            une autre ligne interne (navigation dans le bloc) ou vers un bloc externe (sortie).
          </HelpHint>
        </div>
        <button
          className="button-secondary"
          onClick={onAddDialogueLine}
          disabled={!canEdit}
        >
          + ligne
        </button>
      </div>

      {block.lines.map((line, lineIndex) => (
        <div key={line.id} className="choice-card">
          <div className="section-title-row">
            <strong>Ligne {lineIndex + 1}</strong>
            <button
              className="button-danger"
              onClick={() => onRemoveDialogueLine(line.id)}
              disabled={!canEdit || block.lines.length <= 1}
              title="Supprimer cette ligne"
            >
              x
            </button>
          </div>

          {/* --- Conditions --- */}
          <div className="effect-list">
            <div className="section-title-row">
              <div className="title-with-help">
                <span>Conditions</span>
                <HelpHint title="Conditions de ligne">
                  Conditions qui doivent etre remplies pour afficher cette ligne. Si elles echouent,
                  la ligne de repli est utilisee.
                </HelpHint>
              </div>
              <button
                className="button-secondary"
                onClick={() =>
                  onUpdateSelectedBlock((candidate) => {
                    if (candidate.type !== "dialogue") return candidate;
                    return {
                      ...candidate,
                      lines: candidate.lines.map((l) =>
                        l.id !== line.id
                          ? l
                          : {
                              ...l,
                              conditions: [
                                ...l.conditions,
                                { type: "min_affinity" as const, npcProfileBlockId: npcBlocks[0]?.id ?? "", value: 0 },
                              ],
                            },
                      ),
                    };
                  })
                }
                disabled={!canEdit || npcBlocks.length === 0}
              >
                + condition
              </button>
            </div>
            {line.conditions.map((cond, condIdx) => (
              <div key={`cond-${condIdx}`} className="effect-row" style={{ gridTemplateColumns: "1fr 1fr 60px 28px" }}>
                <select
                  value={cond.type}
                  onChange={(event) =>
                    onUpdateSelectedBlock((candidate) => {
                      if (candidate.type !== "dialogue") return candidate;
                      return {
                        ...candidate,
                        lines: candidate.lines.map((l) =>
                          l.id !== line.id
                            ? l
                            : {
                                ...l,
                                conditions: l.conditions.map((c, ci) =>
                                  ci !== condIdx ? c : { ...c, type: event.target.value as "min_affinity" | "max_affinity" },
                                ),
                              },
                        ),
                      };
                    })
                  }
                  disabled={!canEdit}
                >
                  <option value="min_affinity">Affinite min</option>
                  <option value="max_affinity">Affinite max</option>
                </select>
                <select
                  value={cond.npcProfileBlockId}
                  onChange={(event) =>
                    onUpdateSelectedBlock((candidate) => {
                      if (candidate.type !== "dialogue") return candidate;
                      return {
                        ...candidate,
                        lines: candidate.lines.map((l) =>
                          l.id !== line.id
                            ? l
                            : {
                                ...l,
                                conditions: l.conditions.map((c, ci) =>
                                  ci !== condIdx ? c : { ...c, npcProfileBlockId: event.target.value },
                                ),
                              },
                        ),
                      };
                    })
                  }
                  disabled={!canEdit}
                >
                  {npcBlocks.map((npc) => (
                    <option key={npc.id} value={npc.id}>
                      {npc.npcName || "PNJ sans nom"}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min={0}
                  max={100}
                  style={{ width: "60px" }}
                  value={cond.value}
                  onChange={(event) =>
                    onUpdateSelectedBlock((candidate) => {
                      if (candidate.type !== "dialogue") return candidate;
                      return {
                        ...candidate,
                        lines: candidate.lines.map((l) =>
                          l.id !== line.id
                            ? l
                            : {
                                ...l,
                                conditions: l.conditions.map((c, ci) =>
                                  ci !== condIdx ? c : { ...c, value: Number(event.target.value) },
                                ),
                              },
                        ),
                      };
                    })
                  }
                  disabled={!canEdit}
                />
                <button
                  className="button-danger"
                  onClick={() =>
                    onUpdateSelectedBlock((candidate) => {
                      if (candidate.type !== "dialogue") return candidate;
                      return {
                        ...candidate,
                        lines: candidate.lines.map((l) =>
                          l.id !== line.id
                            ? l
                            : { ...l, conditions: l.conditions.filter((_, ci) => ci !== condIdx) },
                        ),
                      };
                    })
                  }
                  disabled={!canEdit}
                >
                  x
                </button>
              </div>
            ))}
            {line.conditions.length > 0 && (
              <label>
                Ligne de repli
                <select
                  value={line.fallbackLineId ?? ""}
                  onChange={(event) =>
                    onUpdateSelectedBlock((candidate) => {
                      if (candidate.type !== "dialogue") return candidate;
                      return {
                        ...candidate,
                        lines: candidate.lines.map((l) =>
                          l.id !== line.id
                            ? l
                            : { ...l, fallbackLineId: event.target.value || null },
                        ),
                      };
                    })
                  }
                  disabled={!canEdit}
                >
                  <option value="">Sauter (ne rien afficher)</option>
                  {block.lines
                    .filter((candidate) => candidate.id !== line.id)
                    .map((candidate) => {
                      const globalIndex = block.lines.indexOf(candidate);
                      return (
                        <option key={candidate.id} value={candidate.id}>
                          Ligne {globalIndex + 1} — {candidate.speaker || "…"}
                        </option>
                      );
                    })}
                </select>
              </label>
            )}
          </div>

          <label>
            Personnage
            <input
              value={
                linkedNpcBlock?.npcName.trim()
                  ? linkedNpcBlock.npcName
                  : line.speaker
              }
              onChange={(event) =>
                onUpdateDialogueLineField(line.id, "speaker", event.target.value)
              }
              disabled={!canEdit || Boolean(linkedNpcBlock)}
            />
          </label>
          <label>
            Replique
            <textarea
              rows={3}
              value={line.text}
              onChange={(event) =>
                onUpdateDialogueLineField(line.id, "text", event.target.value)
              }
              disabled={!canEdit}
            />
          </label>
          <label>
            Voix
            <input
              type="file"
              accept="audio/*"
              onChange={onDialogueLineVoiceInput(line.id)}
              disabled={!canEdit}
            />
          </label>
          {renderLineVoiceAttachment(line.id, line.voiceAssetId)}

          {/* --- Responses for this line --- */}
          <div className="section-title-row">
            <div className="title-with-help">
              <span>Reponses (max 4)</span>
              <HelpHint title="Reponses">
                Boutons affiches au joueur. Chaque reponse peut mener vers une ligne interne ou un
                bloc externe, et appliquer des effets sur les variables.
              </HelpHint>
            </div>
            <div className="row-inline">
              <button
                className="button-secondary"
                onClick={() => onAddDialogueLineResponse(line.id)}
                disabled={!canEdit || line.responses.length >= 4}
              >
                + reponse
              </button>
            </div>
          </div>

          {line.responses.map((resp) => (
            <div key={resp.id} className="choice-card" style={{ marginLeft: 12 }}>
              <div className="section-title-row">
                <strong>Reponse {resp.label}</strong>
                <button
                  className="button-danger"
                  onClick={() => onRemoveDialogueLineResponse(line.id, resp.id)}
                  disabled={!canEdit || line.responses.length <= 1}
                  title="Supprimer cette reponse"
                >
                  x
                </button>
              </div>
              <label>
                Texte
                <input
                  value={resp.text}
                  onChange={(event) =>
                    onUpdateDialogueResponseField(line.id, resp.id, "text", event.target.value)
                  }
                  disabled={!canEdit}
                />
              </label>

              {/* --- Target: internal line OR external block (mutually exclusive) --- */}
              <label>
                Cible interne (ligne)
                <select
                  value={resp.targetLineId ?? ""}
                  onChange={(event) =>
                    onUpdateDialogueResponseField(line.id, resp.id, "targetLineId", event.target.value)
                  }
                  disabled={!canEdit || Boolean(resp.targetBlockId)}
                >
                  <option value="">Aucune (utiliser cible externe)</option>
                  {block.lines
                    .filter((candidate) => candidate.id !== line.id)
                    .map((candidate) => {
                      const globalIndex = block.lines.indexOf(candidate);
                      return (
                        <option key={candidate.id} value={candidate.id}>
                          Ligne {globalIndex + 1} — {candidate.speaker || "…"}
                        </option>
                      );
                    })}
                </select>
              </label>
              <label>
                Cible externe (bloc)
                <select
                  value={resp.targetBlockId ?? ""}
                  onChange={(event) =>
                    onUpdateDialogueResponseField(line.id, resp.id, "targetBlockId", event.target.value)
                  }
                  disabled={!canEdit || Boolean(resp.targetLineId)}
                >
                  <option value="">Fin histoire</option>
                  {externalBlocks.map((candidate) => (
                    <option key={candidate.id} value={candidate.id}>
                      {candidate.name} ({BLOCK_LABELS[candidate.type]})
                    </option>
                  ))}
                </select>
              </label>

              {/* --- Effects --- */}
              <div className="effect-list">
                <div className="section-title-row">
                  <div className="title-with-help">
                    <span>Effets variables</span>
                    <HelpHint title="Effets de reponse">
                      Modifie les variables globales quand cette reponse est choisie.
                    </HelpHint>
                  </div>
                  <button
                    className="button-secondary"
                    onClick={() => onAddResponseEffect(line.id, resp.id)}
                    disabled={!canEdit || project.variables.length === 0}
                  >
                    + effet
                  </button>
                </div>
                {resp.effects.map((effect, effectIndex) => (
                  <div key={`${resp.id}-effect-${effectIndex}`} className="effect-row">
                    <select
                      value={effect.variableId}
                      onChange={(event) =>
                        onUpdateResponseEffect(
                          line.id,
                          resp.id,
                          effectIndex,
                          "variableId",
                          event.target.value,
                        )
                      }
                      disabled={!canEdit}
                    >
                      {project.variables.map((variable) => (
                        <option key={variable.id} value={variable.id}>
                          {variable.name}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      value={effect.delta}
                      onChange={(event) =>
                        onUpdateResponseEffect(
                          line.id,
                          resp.id,
                          effectIndex,
                          "delta",
                          event.target.value,
                        )
                      }
                      disabled={!canEdit}
                    />
                    <button
                      className="button-danger"
                      onClick={() => onRemoveResponseEffect(line.id, resp.id, effectIndex)}
                      disabled={!canEdit}
                    >
                      x
                    </button>
                  </div>
                ))}
              </div>

              {/* --- Affinity effects --- */}
              <div className="effect-list">
                <div className="section-title-row">
                  <div className="title-with-help">
                    <span>Effets affinite</span>
                    <HelpHint title="Effets affinite">
                      Modifie la jauge d&apos;affinite d&apos;un PNJ quand cette reponse est choisie.
                    </HelpHint>
                  </div>
                  <button
                    className="button-secondary"
                    onClick={() =>
                      onUpdateSelectedBlock((candidate) => {
                        if (candidate.type !== "dialogue") return candidate;
                        return {
                          ...candidate,
                          lines: candidate.lines.map((l) =>
                            l.id !== line.id
                              ? l
                              : {
                                  ...l,
                                  responses: l.responses.map((r) =>
                                    r.id !== resp.id
                                      ? r
                                      : {
                                          ...r,
                                          affinityEffects: [
                                            ...r.affinityEffects,
                                            { npcProfileBlockId: npcBlocks[0]?.id ?? "", delta: 5 },
                                          ],
                                        },
                                  ),
                                },
                          ),
                        };
                      })
                    }
                    disabled={!canEdit || npcBlocks.length === 0}
                  >
                    + affinite
                  </button>
                </div>
                {resp.affinityEffects.map((ae, aeIdx) => (
                  <div key={`ae-${aeIdx}`} className="effect-row">
                    <select
                      value={ae.npcProfileBlockId}
                      onChange={(event) =>
                        onUpdateSelectedBlock((candidate) => {
                          if (candidate.type !== "dialogue") return candidate;
                          return {
                            ...candidate,
                            lines: candidate.lines.map((l) =>
                              l.id !== line.id
                                ? l
                                : {
                                    ...l,
                                    responses: l.responses.map((r) =>
                                      r.id !== resp.id
                                        ? r
                                        : {
                                            ...r,
                                            affinityEffects: r.affinityEffects.map((a, ai) =>
                                              ai !== aeIdx ? a : { ...a, npcProfileBlockId: event.target.value },
                                            ),
                                          },
                                    ),
                                  },
                            ),
                          };
                        })
                      }
                      disabled={!canEdit}
                    >
                      {npcBlocks.map((npc) => (
                        <option key={npc.id} value={npc.id}>
                          {npc.npcName || "PNJ sans nom"}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      value={ae.delta}
                      onChange={(event) =>
                        onUpdateSelectedBlock((candidate) => {
                          if (candidate.type !== "dialogue") return candidate;
                          return {
                            ...candidate,
                            lines: candidate.lines.map((l) =>
                              l.id !== line.id
                                ? l
                                : {
                                    ...l,
                                    responses: l.responses.map((r) =>
                                      r.id !== resp.id
                                        ? r
                                        : {
                                            ...r,
                                            affinityEffects: r.affinityEffects.map((a, ai) =>
                                              ai !== aeIdx ? a : { ...a, delta: Number(event.target.value) },
                                            ),
                                          },
                                    ),
                                  },
                            ),
                          };
                        })
                      }
                      disabled={!canEdit}
                    />
                    <button
                      className="button-danger"
                      onClick={() =>
                        onUpdateSelectedBlock((candidate) => {
                          if (candidate.type !== "dialogue") return candidate;
                          return {
                            ...candidate,
                            lines: candidate.lines.map((l) =>
                              l.id !== line.id
                                ? l
                                : {
                                    ...l,
                                    responses: l.responses.map((r) =>
                                      r.id !== resp.id
                                        ? r
                                        : {
                                            ...r,
                                            affinityEffects: r.affinityEffects.filter((_, ai) => ai !== aeIdx),
                                          },
                                    ),
                                  },
                            ),
                          };
                        })
                      }
                      disabled={!canEdit}
                    >
                      x
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

interface ChoiceEditorSectionProps {
  block: ChoiceBlock;
  canEdit: boolean;
  blocks: StoryBlock[];
  project: ProjectMeta;
  onSetSelectedDynamicField: (key: string, value: unknown) => void;
  onAssetInput: (fieldName: string) => (event: ChangeEvent<HTMLInputElement>) => void;
  renderAssetAttachment: (fieldName: string, assetId: string | null) => ReactNode;
  renderAssetAttachmentWithRemove: (assetId: string | null, onRemove: () => void) => ReactNode;
  onAddChoiceOption: () => void;
  onRemoveChoiceOption: () => void;
  onUpdateChoiceField: (choiceId: string, field: ChoiceField, value: string) => void;
  onUpdateChoiceOptionDescription: (optionId: string, value: string) => void;
  onSetChoiceOptionImage: (optionId: string, file: File) => void;
  onClearChoiceOptionImage: (optionId: string) => void;
  onAddChoiceEffect: (choiceId: string) => void;
  onUpdateChoiceEffect: (
    choiceId: string,
    effectIndex: number,
    key: EffectField,
    value: string,
  ) => void;
  onRemoveChoiceEffect: (choiceId: string, effectIndex: number) => void;
  assetPreviewSrcById: Record<string, string>;
}

function ChoiceEditorSection({
  block,
  canEdit,
  blocks,
  project,
  onSetSelectedDynamicField,
  onAssetInput,
  renderAssetAttachment,
  renderAssetAttachmentWithRemove,
  onAddChoiceOption,
  onRemoveChoiceOption,
  onUpdateChoiceField,
  onUpdateChoiceOptionDescription,
  onSetChoiceOptionImage,
  onClearChoiceOptionImage,
  onAddChoiceEffect,
  onUpdateChoiceEffect,
  onRemoveChoiceEffect,
  assetPreviewSrcById,
}: ChoiceEditorSectionProps) {
  return (
    <div className="subsection">
      <div className="title-with-help">
        <h3>Bloc choix</h3>
        <HelpHint title="Bloc choix">
          Bloc de decision pure: le joueur choisit un chemin parmi plusieurs options. Chaque
          option peut modifier des variables et brancher vers un bloc different.
        </HelpHint>
      </div>
      <label>
        Situation / Prompt
        <textarea
          rows={3}
          value={block.prompt}
          onChange={(event) => onSetSelectedDynamicField("prompt", event.target.value)}
          disabled={!canEdit}
          placeholder="Que fais-tu ?"
        />
      </label>
      <label>
        Image fond
        <input
          type="file"
          accept="image/*"
          onChange={onAssetInput("backgroundAssetId")}
          disabled={!canEdit}
        />
      </label>
      {renderAssetAttachment("backgroundAssetId", block.backgroundAssetId)}
      <label>
        Voix / narration audio
        <input
          type="file"
          accept="audio/*"
          onChange={onAssetInput("voiceAssetId")}
          disabled={!canEdit}
        />
      </label>
      {renderAssetAttachment("voiceAssetId", block.voiceAssetId)}

      <div className="section-title-row">
        <div className="title-with-help">
          <h3>Options (max 4)</h3>
          <HelpHint title="Options du choix">
            Les propositions affichees au joueur. Chaque option peut avoir un texte, une description
            detaillee, une image et des effets sur les variables.
          </HelpHint>
        </div>
        <div className="row-inline">
          <button
            className="button-secondary"
            onClick={onAddChoiceOption}
            disabled={!canEdit || block.choices.length >= 4}
          >
            + option
          </button>
          <button
            className="button-secondary"
            onClick={onRemoveChoiceOption}
            disabled={!canEdit || block.choices.length <= 1}
          >
            - derniere
          </button>
        </div>
      </div>

      {block.choices.map((option) => (
        <div key={option.id} className="choice-card">
          <strong>Option {option.label}</strong>
          <label>
            Texte
            <input
              value={option.text}
              onChange={(event) => onUpdateChoiceField(option.id, "text", event.target.value)}
              disabled={!canEdit}
              placeholder="Aller a gauche"
            />
          </label>
          <label>
            Description
            <textarea
              rows={2}
              value={option.description}
              onChange={(event) =>
                onUpdateChoiceOptionDescription(option.id, event.target.value)
              }
              disabled={!canEdit}
              placeholder="Un chemin sombre serpente entre les arbres..."
            />
          </label>
          <label>
            Image option
            <input
              type="file"
              accept="image/*"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) onSetChoiceOptionImage(option.id, file);
                event.target.value = "";
              }}
              disabled={!canEdit}
            />
          </label>
          {option.imageAssetId &&
            renderAssetAttachmentWithRemove(option.imageAssetId, () =>
              onClearChoiceOptionImage(option.id),
            )}
          {option.imageAssetId && assetPreviewSrcById[option.imageAssetId] && (
            <img
              src={assetPreviewSrcById[option.imageAssetId]}
              alt={`Option ${option.label}`}
              className="asset-preview-thumb"
            />
          )}
          <label>
            Cible bloc
            <select
              value={option.targetBlockId ?? ""}
              onChange={(event) =>
                onUpdateChoiceField(option.id, "targetBlockId", event.target.value)
              }
              disabled={!canEdit}
            >
              <option value="">Fin histoire</option>
              {blocks
                .filter(
                  (candidate) =>
                    candidate.id !== block.id &&
                    candidate.type !== "hero_profile" &&
                    candidate.type !== "npc_profile",
                )
                .map((candidate) => (
                  <option key={candidate.id} value={candidate.id}>
                    {candidate.name} ({BLOCK_LABELS[candidate.type]})
                  </option>
                ))}
            </select>
          </label>

          <div className="effect-list">
            <div className="section-title-row">
              <div className="title-with-help">
                <span>Effets variables</span>
                <HelpHint title="Effets d option">
                  Modifie les variables globales quand cette option est choisie.
                </HelpHint>
              </div>
              <button
                className="button-secondary"
                onClick={() => onAddChoiceEffect(option.id)}
                disabled={!canEdit || project.variables.length === 0}
              >
                + effet
              </button>
            </div>
            {option.effects.map((effect, index) => (
              <div key={`${option.id}-effect-${index}`} className="effect-row">
                <select
                  value={effect.variableId}
                  onChange={(event) =>
                    onUpdateChoiceEffect(option.id, index, "variableId", event.target.value)
                  }
                  disabled={!canEdit}
                >
                  {project.variables.map((variable) => (
                    <option key={variable.id} value={variable.id}>
                      {variable.name}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  value={effect.delta}
                  onChange={(event) =>
                    onUpdateChoiceEffect(option.id, index, "delta", event.target.value)
                  }
                  disabled={!canEdit}
                />
                <button
                  className="button-danger"
                  onClick={() => onRemoveChoiceEffect(option.id, index)}
                  disabled={!canEdit}
                >
                  x
                </button>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

interface GameplayEditorSectionProps {
  block: GameplayBlock;
  canEdit: boolean;
  blocks: StoryBlock[];
  project: ProjectMeta;
  onSetSelectedDynamicField: (key: string, value: unknown) => void;
  onUpdateSelectedBlock: (updater: (block: StoryBlock) => StoryBlock) => void;
  onSetConnection: (sourceId: string, sourceHandle: string, targetId: string | null) => void;
  onAssetInput: (fieldName: string) => (event: ChangeEvent<HTMLInputElement>) => void;
  renderAssetAttachment: (fieldName: string, assetId: string | null) => ReactNode;
  renderAssetAttachmentWithRemove: (assetId: string | null, onRemove: () => void) => ReactNode;
  onAddGameplayObject: () => void;
  onRemoveGameplayObject: (objectId: string) => void;
  onUpdateGameplayObjectField: <K extends keyof GameplayObject>(objectId: string, field: K, value: GameplayObject[K]) => void;
  onUpdateGameplayObjectRect: (objectId: string, field: RectField, value: number) => void;
  onClearGameplayObjectAsset: (objectId: string) => void;
  onClearGameplayObjectSound: (objectId: string) => void;
  onAddGameplayObjectEffect: (objectId: string) => void;
  onUpdateGameplayObjectEffect: (objectId: string, effectIndex: number, field: "variableId" | "delta", value: string | number) => void;
  onRemoveGameplayObjectEffect: (objectId: string, effectIndex: number) => void;
  onAddGameplayCompletionEffect: () => void;
  onUpdateGameplayCompletionEffect: (index: number, field: EffectField, value: string | number) => void;
  onRemoveGameplayCompletionEffect: (index: number) => void;
  gameplayPlacementTarget: GameplayPlacementTarget | null;
  onSetGameplayPlacementTarget: (target: GameplayPlacementTarget | null) => void;
  onStartGameplayObjectDrag: (event: ReactPointerEvent<HTMLDivElement>, objectId: string) => void;
  onGameplaySceneClick: (event: MouseEvent<HTMLDivElement>) => void;
  onGameplayScenePointerMove: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onGameplayScenePointerEnd: (event: ReactPointerEvent<HTMLDivElement>) => void;
  assetPreviewSrcById: Record<string, string>;
  onRegisterAsset: (file: File) => string;
  onEnsureAssetPreviewSrc: (assetId: string) => Promise<string | null>;
  onStatusMessage: (message: string) => void;
}

function GameplayEditorSection({
  block,
  canEdit,
  blocks,
  project,
  onSetSelectedDynamicField,
  onUpdateSelectedBlock,
  onSetConnection,
  onAssetInput,
  renderAssetAttachment,
  renderAssetAttachmentWithRemove,
  onAddGameplayObject,
  onRemoveGameplayObject,
  onUpdateGameplayObjectField,
  onUpdateGameplayObjectRect,
  onClearGameplayObjectAsset,
  onClearGameplayObjectSound,
  onAddGameplayObjectEffect,
  onUpdateGameplayObjectEffect,
  onRemoveGameplayObjectEffect,
  onAddGameplayCompletionEffect,
  onUpdateGameplayCompletionEffect,
  onRemoveGameplayCompletionEffect,
  gameplayPlacementTarget,
  onSetGameplayPlacementTarget,
  onStartGameplayObjectDrag,
  onGameplaySceneClick,
  onGameplayScenePointerMove,
  onGameplayScenePointerEnd,
  assetPreviewSrcById,
  onRegisterAsset,
  onEnsureAssetPreviewSrc,
  onStatusMessage,
}: GameplayEditorSectionProps) {
  const typeLabels: Record<GameplayObjectType, string> = {
    decoration: "Decoration (pas d'action)",
    collectible: "Collectible (inventaire)",
    key: "Cle (a deposer sur serrure)",
    lock: "Serrure (attend une cle)",
  };

  const unlockEffectLabels: Record<GameplayUnlockEffect, string> = {
    go_to_next: "Passe au bloc suivant",
    disappear: "Disparait de la scene",
    modify_stats: "Modifie les stats",
  };

  // Build a helper to draw SVG arrows from key → lock on the scene
  const sceneRef = useRef<HTMLDivElement>(null);
  const keyLockPairs = block.objects
    .filter((o) => o.objectType === "lock" && o.linkedKeyId)
    .map((lock) => {
      const key = block.objects.find((o) => o.id === lock.linkedKeyId);
      return key ? { key, lock } : null;
    })
    .filter(Boolean) as { key: GameplayObject; lock: GameplayObject }[];

  return (
    <div className="subsection">
      <div className="title-with-help">
        <h3>Bloc gameplay</h3>
        <HelpHint title="Scene interactive">
          Place des objets sur un decor. 4 types: decoration, collectible, cle et serrure.
          Les cles sont deplacables a la souris pour les deposer sur leur serrure.
        </HelpHint>
      </div>

      {/* ── Objectif ── */}
      <label>
        Objectif
        <textarea
          rows={3}
          value={block.objective}
          onChange={(event) => onSetSelectedDynamicField("objective", event.target.value)}
          disabled={!canEdit}
        />
      </label>

      {/* ── Background ── */}
      <label>
        Image fond
        <input type="file" accept="image/*" onChange={onAssetInput("backgroundAssetId")} disabled={!canEdit} />
      </label>
      {renderAssetAttachment("backgroundAssetId", block.backgroundAssetId)}

      {/* ── Visual scene with arrows ── */}
      <div className="pointclick-editor-scene-wrap">
        <div className="section-title-row">
          <div className="title-with-help">
            <strong>Scene interactive</strong>
            <HelpHint title="Placement visuel">
              Glisse les objets pour les positionner. Clique &quot;Placer&quot; puis clique dans la scene.
            </HelpHint>
          </div>
          <small>
            {gameplayPlacementTarget
              ? "Clique dans la scene pour placer l'objet"
              : "Deplace les objets a la souris"}
          </small>
        </div>
        <div
          ref={sceneRef}
          className="pointclick-editor-scene"
          onClick={onGameplaySceneClick}
          onPointerMove={onGameplayScenePointerMove}
          onPointerUp={onGameplayScenePointerEnd}
          onPointerCancel={onGameplayScenePointerEnd}
          style={
            assetPreviewSrcById[block.backgroundAssetId ?? ""]
              ? { backgroundImage: `url(${assetPreviewSrcById[block.backgroundAssetId ?? ""]})` }
              : undefined
          }
        >
          {!assetPreviewSrcById[block.backgroundAssetId ?? ""] && (
            <div className="pointclick-editor-empty-bg">Ajoute une image de fond</div>
          )}

          {[...block.objects]
            .sort((a, b) => a.zIndex - b.zIndex)
            .map((obj) => (
              <div
                key={obj.id}
                className={`pointclick-overlay-box ${
                  gameplayPlacementTarget?.objectId === obj.id ? "pointclick-overlay-active" : ""
                } pointclick-type-${obj.objectType}`}
                style={{
                  left: `${obj.x}%`,
                  top: `${obj.y}%`,
                  width: `${obj.width}%`,
                  height: `${obj.height}%`,
                  zIndex: obj.zIndex,
                  backgroundImage: assetPreviewSrcById[obj.assetId ?? ""]
                    ? `url(${assetPreviewSrcById[obj.assetId ?? ""]})`
                    : undefined,
                  opacity: obj.visibleByDefault ? 1 : 0.45,
                }}
                onPointerDown={(event) => onStartGameplayObjectDrag(event, obj.id)}
                onClick={(event) => event.stopPropagation()}
              >
                {!assetPreviewSrcById[obj.assetId ?? ""] && <span>{obj.name || "Objet"}</span>}
              </div>
            ))}

          {/* SVG arrows from key center → lock center */}
          <svg className="pointclick-arrows-svg">
            {keyLockPairs.map(({ key: k, lock: l }) => {
              const kx = k.x + k.width / 2;
              const ky = k.y + k.height / 2;
              const lx = l.x + l.width / 2;
              const ly = l.y + l.height / 2;
              return (
                <line
                  key={`${k.id}-${l.id}`}
                  x1={`${kx}%`} y1={`${ky}%`}
                  x2={`${lx}%`} y2={`${ly}%`}
                  stroke="#f59e0b"
                  strokeWidth="2"
                  strokeDasharray="6 4"
                  markerEnd="url(#arrowhead)"
                />
              );
            })}
            <defs>
              <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                <polygon points="0 0, 8 3, 0 6" fill="#f59e0b" />
              </marker>
            </defs>
          </svg>
        </div>
      </div>

      {/* ── Ambiance ── */}
      <label>
        Audio ambiance
        <input type="file" accept="audio/*" onChange={onAssetInput("voiceAssetId")} disabled={!canEdit} />
      </label>
      {renderAssetAttachment("voiceAssetId", block.voiceAssetId)}

      {/* ── Objects list ── */}
      <div className="section-title-row">
        <div className="title-with-help">
          <h3>Objets</h3>
          <HelpHint title="Les 4 types">
            Decoration: pas d&apos;action. Collectible: va dans l&apos;inventaire.
            Cle: deplacable a la souris jusqu&apos;a la serrure. Serrure: attend sa cle.
          </HelpHint>
        </div>
        <button className="button-secondary" onClick={onAddGameplayObject} disabled={!canEdit}>
          + objet
        </button>
      </div>

      {block.objects.length === 0 && (
        <p className="empty-placeholder">Aucun objet. Clique &quot;+ objet&quot; pour commencer.</p>
      )}

      {block.objects.map((obj) => (
        <div key={obj.id} className="choice-card">
          <div className="section-title-row">
            <strong>{obj.name || "Objet"}</strong>
            <button className="button-danger" onClick={() => onRemoveGameplayObject(obj.id)} disabled={!canEdit}>
              Supprimer
            </button>
          </div>
          <label>
            Nom
            <input
              value={obj.name}
              onChange={(event) => onUpdateGameplayObjectField(obj.id, "name", event.target.value)}
              disabled={!canEdit}
            />
          </label>
          <label>
            Image
            <input
              type="file"
              accept="image/*"
              onChange={(event) => {
                if (!canEdit) return;
                const file = event.target.files?.[0];
                if (!file) return;
                const assetId = onRegisterAsset(file);
                void onEnsureAssetPreviewSrc(assetId);
                onUpdateGameplayObjectField(obj.id, "assetId", assetId);
                onStatusMessage(`Asset ${file.name} ajoute.`);
                event.target.value = "";
              }}
              disabled={!canEdit}
            />
          </label>
          {renderAssetAttachmentWithRemove(obj.assetId, () => onClearGameplayObjectAsset(obj.id))}

          {/* ── Type ── */}
          <label>
            Type
            <select
              value={obj.objectType}
              onChange={(event) => onUpdateGameplayObjectField(obj.id, "objectType", event.target.value as GameplayObjectType)}
              disabled={!canEdit}
            >
              {(Object.keys(typeLabels) as GameplayObjectType[]).map((key) => (
                <option key={key} value={key}>{typeLabels[key]}</option>
              ))}
            </select>
          </label>

          {/* ── Size & zIndex (no X/Y — position via mouse drag only) ── */}
          <div className="grid-two">
            <label>
              Largeur %
              <input type="number" value={obj.width} onChange={(event) => onUpdateGameplayObjectRect(obj.id, "width", normalizeDelta(event.target.value))} disabled={!canEdit} />
            </label>
            <label>
              Hauteur %
              <input type="number" value={obj.height} onChange={(event) => onUpdateGameplayObjectRect(obj.id, "height", normalizeDelta(event.target.value))} disabled={!canEdit} />
            </label>
            <label>
              z-index
              <input
                type="number"
                value={obj.zIndex}
                onChange={(event) => onUpdateGameplayObjectField(obj.id, "zIndex", normalizeDelta(event.target.value))}
                disabled={!canEdit}
              />
            </label>
            <label>
              Visible au depart
              <select
                value={obj.visibleByDefault ? "yes" : "no"}
                onChange={(event) => onUpdateGameplayObjectField(obj.id, "visibleByDefault", event.target.value === "yes")}
                disabled={!canEdit}
              >
                <option value="yes">oui</option>
                <option value="no">non</option>
              </select>
            </label>
          </div>

          {/* ── Type-specific fields ── */}
          {obj.objectType === "collectible" && (
            <label>
              Objet donne
              <select
                value={obj.grantItemId ?? ""}
                onChange={(event) => onUpdateGameplayObjectField(obj.id, "grantItemId", event.target.value || null)}
                disabled={!canEdit}
              >
                <option value="">Aucun</option>
                {project.items.map((item) => (
                  <option key={item.id} value={item.id}>{item.name}</option>
                ))}
              </select>
            </label>
          )}

          {obj.objectType === "lock" && (
            <>
              <label>
                Cle associee
                <select
                  value={obj.linkedKeyId ?? ""}
                  onChange={(event) => onUpdateGameplayObjectField(obj.id, "linkedKeyId", event.target.value || null)}
                  disabled={!canEdit}
                >
                  <option value="">Aucune</option>
                  {block.objects
                    .filter((o) => o.objectType === "key")
                    .map((o) => (
                      <option key={o.id} value={o.id}>{o.name || o.id}</option>
                    ))}
                </select>
              </label>
              <label>
                Effet au deverrouillage
                <select
                  value={obj.unlockEffect}
                  onChange={(event) => onUpdateGameplayObjectField(obj.id, "unlockEffect", event.target.value as GameplayUnlockEffect)}
                  disabled={!canEdit}
                >
                  {(Object.keys(unlockEffectLabels) as GameplayUnlockEffect[]).map((key) => (
                    <option key={key} value={key}>{unlockEffectLabels[key]}</option>
                  ))}
                </select>
              </label>
              <label>
                Message si verrouille
                <textarea
                  rows={2}
                  value={obj.lockedMessage}
                  placeholder="Il te manque quelque chose..."
                  onChange={(event) => onUpdateGameplayObjectField(obj.id, "lockedMessage", event.target.value)}
                  disabled={!canEdit}
                />
              </label>
              <label>
                Message de succes
                <textarea
                  rows={2}
                  value={obj.successMessage}
                  onChange={(event) => onUpdateGameplayObjectField(obj.id, "successMessage", event.target.value)}
                  disabled={!canEdit}
                />
              </label>
            </>
          )}

          {/* ── Sound ── */}
          <label>
            Son au clic
            <input
              type="file"
              accept="audio/*"
              onChange={(event) => {
                if (!canEdit) return;
                const file = event.target.files?.[0];
                if (!file) return;
                const assetId = onRegisterAsset(file);
                onUpdateGameplayObjectField(obj.id, "soundAssetId", assetId);
                onStatusMessage(`Asset ${file.name} ajoute.`);
                event.target.value = "";
              }}
              disabled={!canEdit}
            />
          </label>
          {renderAssetAttachmentWithRemove(obj.soundAssetId, () => onClearGameplayObjectSound(obj.id))}

          {/* ── Effects ── */}
          <div className="effect-list">
            <div className="section-title-row">
              <span>Effets variables</span>
              <button
                className="button-secondary"
                onClick={() => onAddGameplayObjectEffect(obj.id)}
                disabled={!canEdit}
              >
                + effet
              </button>
            </div>
            {obj.effects.map((effect, idx) => (
              <div key={`${obj.id}-effect-${idx}`} className="effect-row">
                <select
                  value={effect.variableId}
                  onChange={(event) => onUpdateGameplayObjectEffect(obj.id, idx, "variableId", event.target.value)}
                  disabled={!canEdit}
                >
                  <option value="">--</option>
                  {project.variables.map((v) => (
                    <option key={v.id} value={v.id}>{v.name}</option>
                  ))}
                </select>
                <input
                  type="number"
                  value={effect.delta}
                  onChange={(event) => onUpdateGameplayObjectEffect(obj.id, idx, "delta", normalizeDelta(event.target.value))}
                  disabled={!canEdit}
                />
                <button className="button-danger" onClick={() => onRemoveGameplayObjectEffect(obj.id, idx)} disabled={!canEdit}>x</button>
              </div>
            ))}
          </div>

          <button
            className="button-secondary"
            onClick={() => onSetGameplayPlacementTarget({ objectId: obj.id })}
            disabled={!canEdit}
          >
            Placer sur la scene
          </button>
        </div>
      ))}

      {/* ── Next block ── */}
      <NextBlockSelect
        selectedBlockId={block.id}
        nextBlockId={block.nextBlockId}
        blocks={blocks}
        canEdit={canEdit}
        onChange={(targetId) => onSetConnection(block.id, "next", targetId)}
      />

      {/* ── Completion effects ── */}
      <div className="effect-list">
        <div className="section-title-row">
          <div className="title-with-help">
            <span>Effets a la fin du gameplay</span>
            <HelpHint title="Recompenses de fin">
              Effets appliques une fois l&apos;objectif de la scene atteint, juste avant de passer
              au bloc suivant.
            </HelpHint>
          </div>
          <button
            className="button-secondary"
            onClick={onAddGameplayCompletionEffect}
            disabled={!canEdit}
          >
            + effet
          </button>
        </div>
        {block.completionEffects.map((effect, index) => (
          <div key={`g-effect-${index}`} className="effect-row">
            <select
              value={effect.variableId}
              onChange={(event) => onUpdateGameplayCompletionEffect(index, "variableId", event.target.value)}
              disabled={!canEdit}
            >
              <option value="">--</option>
              {project.variables.map((v) => (
                <option key={v.id} value={v.id}>{v.name}</option>
              ))}
            </select>
            <input
              type="number"
              value={effect.delta}
              onChange={(event) => onUpdateGameplayCompletionEffect(index, "delta", normalizeDelta(event.target.value))}
              disabled={!canEdit}
            />
            <button className="button-danger" onClick={() => onRemoveGameplayCompletionEffect(index)} disabled={!canEdit}>
              x
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

interface HeroProfileEditorSectionProps {
  block: HeroProfileBlock;
  project: ProjectMeta;
}

function HeroProfileEditorSection({ block, project }: HeroProfileEditorSectionProps) {
  return (
    <div className="subsection">
      <div className="title-with-help">
        <h3>Bloc fiche hero</h3>
        <HelpHint title="Reference hero">
          Bloc visuel qui reutilise les donnees de la fiche hero du projet. Pratique pour garder un
          point de repere dans le graphe.
        </HelpHint>
      </div>
      <p className="empty-placeholder">
        Bloc visuel: cette fiche lit les donnees du heros configurees dans le panneau de projet.
      </p>
      <div className="choice-card">
        <strong>{project.hero.name || block.name}</strong>
        <p>{project.hero.lore || "Lore heros vide."}</p>
      </div>
    </div>
  );
}

interface NpcProfileEditorSectionProps {
  block: NpcProfileBlock;
  canEdit: boolean;
  onSetSelectedDynamicField: (key: string, value: unknown) => void;
  onUpdateSelectedBlock: (updater: (block: StoryBlock) => StoryBlock) => void;
  assetPreviewSrcById: Record<string, string>;
  onRegisterAsset: (file: File) => string;
  onEnsureAssetPreviewSrc: (assetId: string) => Promise<string | null>;
  onStatusMessage: (message: string) => void;
}

function NpcProfileEditorSection({
  block,
  canEdit,
  onSetSelectedDynamicField,
  onUpdateSelectedBlock,
  assetPreviewSrcById,
  onRegisterAsset,
  onEnsureAssetPreviewSrc,
  onStatusMessage,
}: NpcProfileEditorSectionProps) {
  useEffect(() => {
    for (const assetId of block.imageAssetIds) {
      void onEnsureAssetPreviewSrc(assetId);
    }
  }, [block.imageAssetIds, onEnsureAssetPreviewSrc]);

  return (
    <div className="subsection">
      <div className="title-with-help">
        <h3>Bloc fiche PNJ</h3>
        <HelpHint title="Catalogue PNJ">
          Cree le profil d&apos;un PNJ (nom, lore, images) puis lie ce bloc a un dialogue pour
          reutiliser automatiquement ses infos.
        </HelpHint>
      </div>
      <label>
        Nom PNJ
        <input
          value={block.npcName}
          onChange={(event) => onSetSelectedDynamicField("npcName", event.target.value)}
          disabled={!canEdit}
        />
      </label>
      <label>
        Lore PNJ
        <textarea
          rows={3}
          value={block.npcLore}
          onChange={(event) => onSetSelectedDynamicField("npcLore", event.target.value)}
          disabled={!canEdit}
        />
      </label>
      <label>
        Affinite initiale ({block.initialAffinity}/100)
        <input
          type="range"
          min={0}
          max={100}
          value={block.initialAffinity}
          onChange={(event) => onSetSelectedDynamicField("initialAffinity", Number(event.target.value))}
          disabled={!canEdit}
        />
      </label>
      <label>
        Ajouter une image PNJ
        <input
          type="file"
          accept="image/*"
          onChange={(event) => {
            if (!canEdit) return;
            const file = event.target.files?.[0];
            if (!file) return;
            const assetId = onRegisterAsset(file);
            void onEnsureAssetPreviewSrc(assetId);
            onUpdateSelectedBlock((candidate) => {
              if (candidate.type !== "npc_profile") return candidate;
              const nextImageAssetIds = [...candidate.imageAssetIds, assetId];
              const nextDefaultImageAssetId = candidate.defaultImageAssetId ?? assetId;
              return {
                ...candidate,
                imageAssetIds: nextImageAssetIds,
                defaultImageAssetId: nextDefaultImageAssetId,
              };
            });
            onStatusMessage(`Image PNJ ajoutee: ${file.name}`);
            event.target.value = "";
          }}
          disabled={!canEdit}
        />
      </label>
      <div className="effect-list">
        <div className="section-title-row">
          <span>Images PNJ</span>
        </div>
        {block.imageAssetIds.length === 0 && (
          <small className="empty-placeholder">Ajoute au moins une image pour ce PNJ.</small>
        )}
        {block.imageAssetIds.map((assetId, index) => (
          <div key={assetId} className="item-library-row">
            <div className="item-library-thumb">
              {assetPreviewSrcById[assetId] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={assetPreviewSrcById[assetId]} alt={`PNJ ${index + 1}`} />
              ) : (
                <span>image</span>
              )}
            </div>
            <div className="item-library-main">
              <small>Image {index + 1}</small>
            </div>
            <div className="item-library-actions">
              <button
                className="button-danger"
                onClick={() =>
                  onUpdateSelectedBlock((candidate) => {
                    if (candidate.type !== "npc_profile") return candidate;
                    const nextImageAssetIds = candidate.imageAssetIds.filter((item) => item !== assetId);
                    const nextDefaultImageAssetId =
                      candidate.defaultImageAssetId === assetId
                        ? nextImageAssetIds[0] ?? null
                        : candidate.defaultImageAssetId;
                    return {
                      ...candidate,
                      imageAssetIds: nextImageAssetIds,
                      defaultImageAssetId: nextDefaultImageAssetId,
                    };
                  })
                }
                disabled={!canEdit}
              >
                x
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AuthorStudioBlockEditorPanel({
  selectedBlock,
  canEdit,
  project,
  blocks,
  visibleIssues,
  onDeleteSelectedBlock,
  onRunValidation,
  onSetStartBlock,
  onSetSelectedDynamicField,
  onUpdateSelectedBlock,
  onSetConnection,
  onAssetInput,
  renderAssetAttachment,
  renderAssetAttachmentWithRemove,
  onAddDialogueLine,
  onRemoveDialogueLine,
  onUpdateDialogueLineField,
  onDialogueLineVoiceInput,
  renderLineVoiceAttachment,
  onAddDialogueLineResponse,
  onRemoveDialogueLineResponse,
  onUpdateDialogueResponseField,
  onUpdateChoiceField,
  onUnlinkDialogueNpcProfile,
  onAddBlockEntryEffect,
  onUpdateBlockEntryEffect,
  onRemoveBlockEntryEffect,
  onAddResponseEffect,
  onUpdateResponseEffect,
  onRemoveResponseEffect,
  onAddChoiceEffect,
  onUpdateChoiceEffect,
  onRemoveChoiceEffect,
  onAddChoiceOption,
  onRemoveChoiceOption,
  onUpdateChoiceOptionDescription,
  onSetChoiceOptionImage,
  onClearChoiceOptionImage,
  onAddGameplayObject,
  onRemoveGameplayObject,
  onUpdateGameplayObjectField,
  onUpdateGameplayObjectRect,
  onClearGameplayObjectAsset,
  onClearGameplayObjectSound,
  onAddGameplayObjectEffect,
  onUpdateGameplayObjectEffect,
  onRemoveGameplayObjectEffect,
  onAddGameplayCompletionEffect,
  onUpdateGameplayCompletionEffect,
  onRemoveGameplayCompletionEffect,
  gameplayPlacementTarget,
  onSetGameplayPlacementTarget,
  onStartGameplayObjectDrag,
  onGameplaySceneClick,
  onGameplayScenePointerMove,
  onGameplayScenePointerEnd,
  assetPreviewSrcById,
  onRegisterAsset,
  onEnsureAssetPreviewSrc,
  onStatusMessage,
}: AuthorStudioBlockEditorPanelProps) {
  return (
    <aside className="panel panel-right">
      <section className="panel-section">
        <div className="section-title-row">
          <div className="title-with-help">
            <h2>Proprietes bloc</h2>
            <HelpHint title="Edition du bloc">
              Zone centrale d&apos;edition du bloc selectionne dans le graphe: contenu, assets,
              branchements et effets.
            </HelpHint>
          </div>
          <button
            className="button-danger"
            onClick={onDeleteSelectedBlock}
            disabled={!selectedBlock || !canEdit}
          >
            Supprimer
          </button>
        </div>

        {!selectedBlock && (
          <p className="empty-placeholder">
            Selectionne un bloc dans le graphe pour modifier ses proprietes.
          </p>
        )}

        {selectedBlock && (
          <div className="form-stack">
            <label>
              Nom bloc
              <input
                value={selectedBlock.name}
                onChange={(event) => onSetSelectedDynamicField("name", event.target.value)}
                disabled={!canEdit}
              />
            </label>

            <label>
              Notes
              <textarea
                value={selectedBlock.notes}
                rows={2}
                onChange={(event) => onSetSelectedDynamicField("notes", event.target.value)}
                disabled={!canEdit}
              />
            </label>

            <div className="row-inline">
              <button
                className="button-secondary"
                onClick={() => onSetStartBlock(selectedBlock.id)}
                disabled={
                  !canEdit ||
                  selectedBlock.type === "hero_profile" ||
                  selectedBlock.type === "npc_profile"
                }
              >
                Definir comme START
              </button>
              {project.info.startBlockId === selectedBlock.id && (
                <span className="chip chip-start">Bloc de depart</span>
              )}
            </div>

            <div className="effect-list">
              <div className="section-title-row">
                <div className="title-with-help">
                  <span>Effets a l entree du bloc</span>
                  <HelpHint title="Effets d'entree">
                    Effets executes automatiquement quand le joueur entre dans ce bloc.
                  </HelpHint>
                </div>
                <button
                  className="button-secondary"
                  onClick={onAddBlockEntryEffect}
                  disabled={!canEdit || project.variables.length === 0}
                >
                  + effet
                </button>
              </div>
              {(selectedBlock.entryEffects ?? []).length === 0 && (
                <small className="empty-placeholder">
                  Optionnel: applique des points (energie, amitie...) quand ce bloc est atteint.
                </small>
              )}
              {(selectedBlock.entryEffects ?? []).map((effect, index) => (
                <div key={`entry-effect-${index}`} className="effect-row">
                  <select
                    value={effect.variableId}
                    onChange={(event) => onUpdateBlockEntryEffect(index, "variableId", event.target.value)}
                    disabled={!canEdit}
                  >
                    {project.variables.map((variable) => (
                      <option key={variable.id} value={variable.id}>
                        {variable.name}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    value={effect.delta}
                    onChange={(event) => onUpdateBlockEntryEffect(index, "delta", event.target.value)}
                    disabled={!canEdit}
                  />
                  <button
                    className="button-danger"
                    onClick={() => onRemoveBlockEntryEffect(index)}
                    disabled={!canEdit}
                  >
                    x
                  </button>
                </div>
              ))}
            </div>

            {selectedBlock.type === "title" && (
              <TitleEditorSection
                block={selectedBlock}
                canEdit={canEdit}
                blocks={blocks}
                onSetSelectedDynamicField={onSetSelectedDynamicField}
                onUpdateSelectedBlock={onUpdateSelectedBlock}
                onSetConnection={onSetConnection}
                onAssetInput={onAssetInput}
                renderAssetAttachment={renderAssetAttachment}
              />
            )}

            {selectedBlock.type === "cinematic" && (
              <CinematicEditorSection
                block={selectedBlock}
                canEdit={canEdit}
                blocks={blocks}
                assetPreviewSrcById={assetPreviewSrcById}
                onSetSelectedDynamicField={onSetSelectedDynamicField}
                onUpdateSelectedBlock={onUpdateSelectedBlock}
                onSetConnection={onSetConnection}
                onAssetInput={onAssetInput}
                renderAssetAttachment={renderAssetAttachment}
                onStatusMessage={onStatusMessage}
              />
            )}

            {selectedBlock.type === "dialogue" && (
              <DialogueEditorSection
                block={selectedBlock}
                canEdit={canEdit}
                blocks={blocks}
                project={project}
                assetPreviewSrcById={assetPreviewSrcById}
                onSetSelectedDynamicField={onSetSelectedDynamicField}
                onUpdateSelectedBlock={onUpdateSelectedBlock}
                onAssetInput={onAssetInput}
                renderAssetAttachment={renderAssetAttachment}
                onUnlinkDialogueNpcProfile={onUnlinkDialogueNpcProfile}
                onAddDialogueLine={onAddDialogueLine}
                onRemoveDialogueLine={onRemoveDialogueLine}
                onUpdateDialogueLineField={onUpdateDialogueLineField}
                onDialogueLineVoiceInput={onDialogueLineVoiceInput}
                renderLineVoiceAttachment={renderLineVoiceAttachment}
                onAddDialogueLineResponse={onAddDialogueLineResponse}
                onRemoveDialogueLineResponse={onRemoveDialogueLineResponse}
                onUpdateDialogueResponseField={onUpdateDialogueResponseField}
                onAddResponseEffect={onAddResponseEffect}
                onUpdateResponseEffect={onUpdateResponseEffect}
                onRemoveResponseEffect={onRemoveResponseEffect}
                onStatusMessage={onStatusMessage}
              />
            )}

            {selectedBlock.type === "choice" && (
              <ChoiceEditorSection
                block={selectedBlock}
                canEdit={canEdit}
                blocks={blocks}
                project={project}
                onSetSelectedDynamicField={onSetSelectedDynamicField}
                onAssetInput={onAssetInput}
                renderAssetAttachment={renderAssetAttachment}
                renderAssetAttachmentWithRemove={renderAssetAttachmentWithRemove}
                onAddChoiceOption={onAddChoiceOption}
                onRemoveChoiceOption={onRemoveChoiceOption}
                onUpdateChoiceField={onUpdateChoiceField}
                onUpdateChoiceOptionDescription={onUpdateChoiceOptionDescription}
                onSetChoiceOptionImage={onSetChoiceOptionImage}
                onClearChoiceOptionImage={onClearChoiceOptionImage}
                onAddChoiceEffect={onAddChoiceEffect}
                onUpdateChoiceEffect={onUpdateChoiceEffect}
                onRemoveChoiceEffect={onRemoveChoiceEffect}
                assetPreviewSrcById={assetPreviewSrcById}
              />
            )}

            {selectedBlock.type === "hero_profile" && (
              <HeroProfileEditorSection block={selectedBlock} project={project} />
            )}

            {selectedBlock.type === "npc_profile" && (
              <NpcProfileEditorSection
                block={selectedBlock}
                canEdit={canEdit}
                onSetSelectedDynamicField={onSetSelectedDynamicField}
                onUpdateSelectedBlock={onUpdateSelectedBlock}
                assetPreviewSrcById={assetPreviewSrcById}
                onRegisterAsset={onRegisterAsset}
                onEnsureAssetPreviewSrc={onEnsureAssetPreviewSrc}
                onStatusMessage={onStatusMessage}
              />
            )}

            {selectedBlock.type === "gameplay" && (
              <GameplayEditorSection
                block={selectedBlock}
                canEdit={canEdit}
                blocks={blocks}
                project={project}
                onSetSelectedDynamicField={onSetSelectedDynamicField}
                onUpdateSelectedBlock={onUpdateSelectedBlock}
                onSetConnection={onSetConnection}
                onAssetInput={onAssetInput}
                renderAssetAttachment={renderAssetAttachment}
                renderAssetAttachmentWithRemove={renderAssetAttachmentWithRemove}
                onAddGameplayObject={onAddGameplayObject}
                onRemoveGameplayObject={onRemoveGameplayObject}
                onUpdateGameplayObjectField={onUpdateGameplayObjectField}
                onUpdateGameplayObjectRect={onUpdateGameplayObjectRect}
                onClearGameplayObjectAsset={onClearGameplayObjectAsset}
                onClearGameplayObjectSound={onClearGameplayObjectSound}
                onAddGameplayObjectEffect={onAddGameplayObjectEffect}
                onUpdateGameplayObjectEffect={onUpdateGameplayObjectEffect}
                onRemoveGameplayObjectEffect={onRemoveGameplayObjectEffect}
                onAddGameplayCompletionEffect={onAddGameplayCompletionEffect}
                onUpdateGameplayCompletionEffect={onUpdateGameplayCompletionEffect}
                onRemoveGameplayCompletionEffect={onRemoveGameplayCompletionEffect}
                gameplayPlacementTarget={gameplayPlacementTarget}
                onSetGameplayPlacementTarget={onSetGameplayPlacementTarget}
                onStartGameplayObjectDrag={onStartGameplayObjectDrag}
                onGameplaySceneClick={onGameplaySceneClick}
                onGameplayScenePointerMove={onGameplayScenePointerMove}
                onGameplayScenePointerEnd={onGameplayScenePointerEnd}
                assetPreviewSrcById={assetPreviewSrcById}
                onRegisterAsset={onRegisterAsset}
                onEnsureAssetPreviewSrc={onEnsureAssetPreviewSrc}
                onStatusMessage={onStatusMessage}
              />
            )}
          </div>
        )}
      </section>

      <section className="panel-section">
        <div className="section-title-row">
          <div className="title-with-help">
            <h2>Validation</h2>
            <HelpHint title="Controle qualite">
              Verifie les erreurs de structure: blocs non relies, choix incomplets, cibles
              manquantes, etc.
            </HelpHint>
          </div>
          <button className="button-secondary" onClick={onRunValidation}>
            Recontroler
          </button>
        </div>
        {visibleIssues.length === 0 && <p className="ok-line">Aucun probleme detecte.</p>}
        <ul className="issues-list">
          {visibleIssues.map((issue, index) => (
            <li key={`${issue.blockId ?? "global"}-${index}`}>
              <span className={`chip ${issue.level === "error" ? "chip-error" : "chip-warning"}`}>
                {issue.level}
              </span>
              <p>{issue.message}</p>
              {issue.blockId && <small>Bloc: {issue.blockId}</small>}
            </li>
          ))}
        </ul>
      </section>
    </aside>
  );
}
