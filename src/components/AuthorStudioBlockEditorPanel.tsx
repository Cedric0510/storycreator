import { ChangeEvent, MouseEvent, PointerEvent as ReactPointerEvent, ReactNode, useCallback, useEffect, useRef } from "react";

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
  GameplayHotspotClickActionType,
  HeroProfileBlock,
  NpcProfileBlock,
  ProjectMeta,
  SceneLayout,
  SceneLayerLayout,
  StoryBlock,
  TitleBlock,
  ValidationIssue,
} from "@/lib/story";

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
  onAddGameplayOverlay: () => void;
  onRemoveGameplayOverlay: (overlayId: string) => void;
  onUpdateGameplayOverlayRect: (overlayId: string, key: RectField, value: number) => void;
  onClearGameplayOverlayAsset: (overlayId: string) => void;
  onAddGameplayHotspot: () => void;
  onRemoveGameplayHotspot: (hotspotId: string) => void;
  onUpdateGameplayHotspotRect: (hotspotId: string, key: RectField, value: number) => void;
  onClearGameplayHotspotSound: (hotspotId: string) => void;
  onAddGameplayHotspotEffect: (hotspotId: string) => void;
  onUpdateGameplayHotspotEffect: (
    hotspotId: string,
    effectIndex: number,
    key: EffectField,
    value: string,
  ) => void;
  onRemoveGameplayHotspotEffect: (hotspotId: string, effectIndex: number) => void;
  onAddGameplayHotspotAction: (
    hotspotId: string,
    type: GameplayHotspotClickActionType,
  ) => void;
  onUpdateGameplayHotspotAction: (
    hotspotId: string,
    actionId: string,
    field: "type" | "message" | "itemId" | "quantity" | "targetHotspotId" | "targetBlockId",
    value: string,
  ) => void;
  onRemoveGameplayHotspotAction: (hotspotId: string, actionId: string) => void;
  onAddGameplayEffect: () => void;
  onUpdateGameplayEffect: (effectIndex: number, key: EffectField, value: string) => void;
  onRemoveGameplayEffect: (effectIndex: number) => void;
  gameplayPlacementTarget: GameplayPlacementTarget | null;
  onSetGameplayPlacementTarget: (target: GameplayPlacementTarget | null) => void;
  onStartGameplayElementDrag: (
    event: ReactPointerEvent<HTMLDivElement>,
    kind: "overlay" | "hotspot",
    id: string,
    x: number,
    y: number,
  ) => void;
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
  onSetSelectedDynamicField: (key: string, value: unknown) => void;
  onSetConnection: (sourceId: string, sourceHandle: string, targetId: string | null) => void;
  onAssetInput: (fieldName: string) => (event: ChangeEvent<HTMLInputElement>) => void;
  renderAssetAttachment: (fieldName: string, assetId: string | null) => ReactNode;
}

function CinematicEditorSection({
  block,
  canEdit,
  blocks,
  onSetSelectedDynamicField,
  onSetConnection,
  onAssetInput,
  renderAssetAttachment,
}: CinematicEditorSectionProps) {
  return (
    <div className="subsection">
      <div className="title-with-help">
        <h3>Bloc cinematique</h3>
        <HelpHint title="Bloc cinematique">
          Permet de raconter une scene avec texte, image, video et voix off, puis d&apos;avancer vers
          un autre bloc.
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
            redimensionner. Les coordonnees sont sauvegardees dans le JSON.
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
      {linkedNpcBlock ? (
        <>
          <label>
            Image PNJ
            <select
              value={block.npcImageAssetId ?? ""}
              onChange={(event) =>
                onSetSelectedDynamicField("npcImageAssetId", event.target.value || null)
              }
              disabled={!canEdit}
            >
              <option value="">Image par defaut du PNJ</option>
              {linkedNpcBlock.imageAssetIds.map((assetId, index) => (
                <option key={assetId} value={assetId}>
                  Image {index + 1}
                </option>
              ))}
            </select>
          </label>
          {renderAssetAttachment(
            "npcImageAssetId",
            block.npcImageAssetId ?? linkedNpcBlock.defaultImageAssetId,
          )}
        </>
      ) : (
        <>
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
        </>
      )}

      {/* --- Scene Composer --- */}
      {(() => {
        const bgSrc = assetPreviewSrcById[block.backgroundAssetId ?? ""];
        const npcImgSrc = assetPreviewSrcById[block.npcImageAssetId ?? ""];
        const npcDefaultSrc = linkedNpcBlock?.defaultImageAssetId
          ? assetPreviewSrcById[linkedNpcBlock.defaultImageAssetId]
          : undefined;
        const charSrc = npcImgSrc || npcDefaultSrc || assetPreviewSrcById[block.characterAssetId ?? ""];
        // Show composer when at least one image asset is assigned (even if URL not yet loaded)
        const hasAnyAsset = block.backgroundAssetId || block.characterAssetId || block.npcImageAssetId || linkedNpcBlock?.defaultImageAssetId;
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
  onAddGameplayOverlay: () => void;
  onRemoveGameplayOverlay: (overlayId: string) => void;
  onUpdateGameplayOverlayRect: (overlayId: string, key: RectField, value: number) => void;
  onClearGameplayOverlayAsset: (overlayId: string) => void;
  onAddGameplayHotspot: () => void;
  onRemoveGameplayHotspot: (hotspotId: string) => void;
  onUpdateGameplayHotspotRect: (hotspotId: string, key: RectField, value: number) => void;
  onClearGameplayHotspotSound: (hotspotId: string) => void;
  onAddGameplayHotspotEffect: (hotspotId: string) => void;
  onUpdateGameplayHotspotEffect: (
    hotspotId: string,
    effectIndex: number,
    key: EffectField,
    value: string,
  ) => void;
  onRemoveGameplayHotspotEffect: (hotspotId: string, effectIndex: number) => void;
  onAddGameplayHotspotAction: (
    hotspotId: string,
    type: GameplayHotspotClickActionType,
  ) => void;
  onUpdateGameplayHotspotAction: (
    hotspotId: string,
    actionId: string,
    field: "type" | "message" | "itemId" | "quantity" | "targetHotspotId" | "targetBlockId",
    value: string,
  ) => void;
  onRemoveGameplayHotspotAction: (hotspotId: string, actionId: string) => void;
  onAddGameplayEffect: () => void;
  onUpdateGameplayEffect: (effectIndex: number, key: EffectField, value: string) => void;
  onRemoveGameplayEffect: (effectIndex: number) => void;
  gameplayPlacementTarget: GameplayPlacementTarget | null;
  onSetGameplayPlacementTarget: (target: GameplayPlacementTarget | null) => void;
  onStartGameplayElementDrag: (
    event: ReactPointerEvent<HTMLDivElement>,
    kind: "overlay" | "hotspot",
    id: string,
    x: number,
    y: number,
  ) => void;
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
  onAddGameplayOverlay,
  onRemoveGameplayOverlay,
  onUpdateGameplayOverlayRect,
  onClearGameplayOverlayAsset,
  onAddGameplayHotspot,
  onRemoveGameplayHotspot,
  onUpdateGameplayHotspotRect,
  onClearGameplayHotspotSound,
  onAddGameplayHotspotEffect,
  onUpdateGameplayHotspotEffect,
  onRemoveGameplayHotspotEffect,
  onAddGameplayHotspotAction,
  onUpdateGameplayHotspotAction,
  onRemoveGameplayHotspotAction,
  onAddGameplayEffect,
  onUpdateGameplayEffect,
  onRemoveGameplayEffect,
  gameplayPlacementTarget,
  onSetGameplayPlacementTarget,
  onStartGameplayElementDrag,
  onGameplaySceneClick,
  onGameplayScenePointerMove,
  onGameplayScenePointerEnd,
  assetPreviewSrcById,
  onRegisterAsset,
  onEnsureAssetPreviewSrc,
  onStatusMessage,
}: GameplayEditorSectionProps) {
  return (
    <div className="subsection">
      <div className="title-with-help">
        <h3>Bloc gameplay</h3>
        <HelpHint title="Bloc point & clic">
          Cree une scene interactive 2D avec objets superposes et zones cliquables. Les actions au
          clic pilotent le scenario.
        </HelpHint>
      </div>
      <p className="empty-placeholder">
        Mode actif: <strong>point_and_click</strong>
      </p>
      <label>
        Objectif
        <textarea
          rows={3}
          value={block.objective}
          onChange={(event) => onSetSelectedDynamicField("objective", event.target.value)}
          disabled={!canEdit}
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
      <div className="pointclick-editor-scene-wrap">
        <div className="section-title-row">
          <div className="title-with-help">
            <strong>Scene interactive</strong>
            <HelpHint title="Placement visuel">
              Clique sur `Placer sur la scene` puis clique dans l&apos;image pour positionner
              overlays et zones. Le glisser-deposer est aussi actif.
            </HelpHint>
          </div>
          <small>
            {gameplayPlacementTarget
              ? `Placement actif: ${gameplayPlacementTarget.kind}`
              : 'Selectionne "Placer" sur un objet/une zone'}
          </small>
        </div>
        <div
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

          {[...block.overlays]
            .sort((a, b) => a.zIndex - b.zIndex)
            .map((overlay) => (
              <div
                key={overlay.id}
                className={`pointclick-overlay-box ${
                  gameplayPlacementTarget?.kind === "overlay" &&
                  gameplayPlacementTarget.id === overlay.id
                    ? "pointclick-overlay-active"
                    : ""
                }`}
                style={{
                  left: `${overlay.x}%`,
                  top: `${overlay.y}%`,
                  width: `${overlay.width}%`,
                  height: `${overlay.height}%`,
                  zIndex: overlay.zIndex,
                  backgroundImage: assetPreviewSrcById[overlay.assetId ?? ""]
                    ? `url(${assetPreviewSrcById[overlay.assetId ?? ""]})`
                    : undefined,
                  opacity: overlay.visibleByDefault ? 1 : 0.45,
                }}
                onPointerDown={(event) =>
                  onStartGameplayElementDrag(event, "overlay", overlay.id, overlay.x, overlay.y)
                }
                onClick={(event) => event.stopPropagation()}
              >
                {!assetPreviewSrcById[overlay.assetId ?? ""] && <span>{overlay.name || "Overlay"}</span>}
              </div>
            ))}

          {block.hotspots.map((hotspot) => (
            <div
              key={hotspot.id}
              className={`pointclick-hotspot-box ${
                gameplayPlacementTarget?.kind === "hotspot" &&
                gameplayPlacementTarget.id === hotspot.id
                  ? "pointclick-hotspot-active"
                  : ""
              }`}
              style={{
                left: `${hotspot.x}%`,
                top: `${hotspot.y}%`,
                width: `${hotspot.width}%`,
                height: `${hotspot.height}%`,
              }}
              onPointerDown={(event) =>
                onStartGameplayElementDrag(event, "hotspot", hotspot.id, hotspot.x, hotspot.y)
              }
              onClick={(event) => event.stopPropagation()}
            >
              <span>{hotspot.name || "Zone"}</span>
            </div>
          ))}
        </div>
      </div>
      <label>
        Audio ambiance
        <input
          type="file"
          accept="audio/*"
          onChange={onAssetInput("voiceAssetId")}
          disabled={!canEdit}
        />
      </label>
      {renderAssetAttachment("voiceAssetId", block.voiceAssetId)}
      <label>
        Condition de fin
        <select
          value={block.completionRule.type}
          onChange={(event) =>
            onUpdateSelectedBlock((candidate) => {
              if (candidate.type !== "gameplay") return candidate;
              return {
                ...candidate,
                completionRule: {
                  ...candidate.completionRule,
                  type:
                    event.target.value === "required_count" ? "required_count" : "all_required",
                },
              };
            })
          }
          disabled={!canEdit}
        >
          <option value="all_required">Tous les hotspots requis</option>
          <option value="required_count">Nombre minimum de hotspots</option>
        </select>
      </label>
      {block.completionRule.type === "required_count" && (
        <label>
          Nombre minimum
          <input
            type="number"
            min={1}
            value={block.completionRule.requiredCount}
            onChange={(event) =>
              onUpdateSelectedBlock((candidate) => {
                if (candidate.type !== "gameplay") return candidate;
                return {
                  ...candidate,
                  completionRule: {
                    ...candidate.completionRule,
                    requiredCount: Math.max(1, normalizeDelta(event.target.value)),
                  },
                };
              })
            }
            disabled={!canEdit}
          />
        </label>
      )}

      <div className="section-title-row">
        <div className="title-with-help">
          <h3>Objets superposes</h3>
          <HelpHint title="Overlays">
            Images placees au-dessus du decor (objets, indices, portes...). Tu controles leur
            taille, position, ordre et visibilite.
          </HelpHint>
        </div>
        <button className="button-secondary" onClick={onAddGameplayOverlay} disabled={!canEdit}>
          + objet
        </button>
      </div>
      {block.overlays.map((overlay) => (
        <div key={overlay.id} className="choice-card">
          <div className="section-title-row">
            <strong>{overlay.name || "Objet"}</strong>
            <button
              className="button-danger"
              onClick={() => onRemoveGameplayOverlay(overlay.id)}
              disabled={!canEdit}
            >
              Supprimer
            </button>
          </div>
          <label>
            Nom
            <input
              value={overlay.name}
              onChange={(event) =>
                onUpdateSelectedBlock((candidate) => {
                  if (candidate.type !== "gameplay") return candidate;
                  return {
                    ...candidate,
                    overlays: candidate.overlays.map((item) =>
                      item.id === overlay.id ? { ...item, name: event.target.value } : item,
                    ),
                  };
                })
              }
              disabled={!canEdit}
            />
          </label>
          <label>
            Image overlay
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
                  if (candidate.type !== "gameplay") return candidate;
                  return {
                    ...candidate,
                    overlays: candidate.overlays.map((item) =>
                      item.id === overlay.id ? { ...item, assetId } : item,
                    ),
                  };
                });
                onStatusMessage(`Asset ${file.name} ajoute.`);
                event.target.value = "";
              }}
              disabled={!canEdit}
            />
          </label>
          {renderAssetAttachmentWithRemove(overlay.assetId, () => onClearGameplayOverlayAsset(overlay.id))}
          <div className="grid-two">
            <label>
              X %
              <input
                type="number"
                value={overlay.x}
                onChange={(event) =>
                  onUpdateGameplayOverlayRect(overlay.id, "x", normalizeDelta(event.target.value))
                }
                disabled={!canEdit}
              />
            </label>
            <label>
              Y %
              <input
                type="number"
                value={overlay.y}
                onChange={(event) =>
                  onUpdateGameplayOverlayRect(overlay.id, "y", normalizeDelta(event.target.value))
                }
                disabled={!canEdit}
              />
            </label>
            <label>
              Largeur %
              <input
                type="number"
                value={overlay.width}
                onChange={(event) =>
                  onUpdateGameplayOverlayRect(overlay.id, "width", normalizeDelta(event.target.value))
                }
                disabled={!canEdit}
              />
            </label>
            <label>
              Hauteur %
              <input
                type="number"
                value={overlay.height}
                onChange={(event) =>
                  onUpdateGameplayOverlayRect(overlay.id, "height", normalizeDelta(event.target.value))
                }
                disabled={!canEdit}
              />
            </label>
          </div>
          <div className="grid-two">
            <label>
              z-index
              <input
                type="number"
                value={overlay.zIndex}
                onChange={(event) =>
                  onUpdateSelectedBlock((candidate) => {
                    if (candidate.type !== "gameplay") return candidate;
                    return {
                      ...candidate,
                      overlays: candidate.overlays.map((item) =>
                        item.id === overlay.id
                          ? { ...item, zIndex: normalizeDelta(event.target.value) }
                          : item,
                      ),
                    };
                  })
                }
                disabled={!canEdit}
              />
            </label>
            <label>
              Visible au depart
              <select
                value={overlay.visibleByDefault ? "yes" : "no"}
                onChange={(event) =>
                  onUpdateSelectedBlock((candidate) => {
                    if (candidate.type !== "gameplay") return candidate;
                    return {
                      ...candidate,
                      overlays: candidate.overlays.map((item) =>
                        item.id === overlay.id
                          ? { ...item, visibleByDefault: event.target.value === "yes" }
                          : item,
                      ),
                    };
                  })
                }
                disabled={!canEdit}
              >
                <option value="yes">oui</option>
                <option value="no">non</option>
              </select>
            </label>
          </div>
          <button
            className="button-secondary"
            onClick={() => onSetGameplayPlacementTarget({ kind: "overlay", id: overlay.id })}
            disabled={!canEdit}
          >
            Placer sur la scene
          </button>
        </div>
      ))}

      <div className="section-title-row">
        <div className="title-with-help">
          <h3>Zones cliquables</h3>
          <HelpHint title="Hotspots">
            Zones invisibles ou visibles que le joueur peut toucher. Elles peuvent afficher un
            message, donner un objet ou changer de bloc.
          </HelpHint>
        </div>
        <button className="button-secondary" onClick={onAddGameplayHotspot} disabled={!canEdit}>
          + zone
        </button>
      </div>
      {block.hotspots.map((hotspot) => (
        <div key={hotspot.id} className="choice-card">
          <div className="section-title-row">
            <strong>{hotspot.name || "Zone cliquable"}</strong>
            <button
              className="button-danger"
              onClick={() => onRemoveGameplayHotspot(hotspot.id)}
              disabled={!canEdit}
            >
              Supprimer
            </button>
          </div>
          <label>
            Nom
            <input
              value={hotspot.name}
              onChange={(event) =>
                onUpdateSelectedBlock((candidate) => {
                  if (candidate.type !== "gameplay") return candidate;
                  return {
                    ...candidate,
                    hotspots: candidate.hotspots.map((item) =>
                      item.id === hotspot.id ? { ...item, name: event.target.value } : item,
                    ),
                  };
                })
              }
              disabled={!canEdit}
            />
          </label>
          <label>
            Message affiche
            <textarea
              rows={2}
              value={hotspot.message}
              onChange={(event) =>
                onUpdateSelectedBlock((candidate) => {
                  if (candidate.type !== "gameplay") return candidate;
                  return {
                    ...candidate,
                    hotspots: candidate.hotspots.map((item) =>
                      item.id === hotspot.id ? { ...item, message: event.target.value } : item,
                    ),
                  };
                })
              }
              disabled={!canEdit}
            />
          </label>
          <label>
            Requise pour terminer
            <select
              value={hotspot.required ? "yes" : "no"}
              onChange={(event) =>
                onUpdateSelectedBlock((candidate) => {
                  if (candidate.type !== "gameplay") return candidate;
                  return {
                    ...candidate,
                    hotspots: candidate.hotspots.map((item) =>
                      item.id === hotspot.id
                        ? { ...item, required: event.target.value === "yes" }
                        : item,
                    ),
                  };
                })
              }
              disabled={!canEdit}
            >
              <option value="yes">oui</option>
              <option value="no">non</option>
            </select>
          </label>
          <div className="grid-two">
            <label>
              X %
              <input
                type="number"
                value={hotspot.x}
                onChange={(event) =>
                  onUpdateGameplayHotspotRect(hotspot.id, "x", normalizeDelta(event.target.value))
                }
                disabled={!canEdit}
              />
            </label>
            <label>
              Y %
              <input
                type="number"
                value={hotspot.y}
                onChange={(event) =>
                  onUpdateGameplayHotspotRect(hotspot.id, "y", normalizeDelta(event.target.value))
                }
                disabled={!canEdit}
              />
            </label>
            <label>
              Largeur %
              <input
                type="number"
                value={hotspot.width}
                onChange={(event) =>
                  onUpdateGameplayHotspotRect(
                    hotspot.id,
                    "width",
                    normalizeDelta(event.target.value),
                  )
                }
                disabled={!canEdit}
              />
            </label>
            <label>
              Hauteur %
              <input
                type="number"
                value={hotspot.height}
                onChange={(event) =>
                  onUpdateGameplayHotspotRect(
                    hotspot.id,
                    "height",
                    normalizeDelta(event.target.value),
                  )
                }
                disabled={!canEdit}
              />
            </label>
          </div>
          <label>
            Toggle overlay au clic
            <select
              value={hotspot.toggleOverlayId ?? ""}
              onChange={(event) =>
                onUpdateSelectedBlock((candidate) => {
                  if (candidate.type !== "gameplay") return candidate;
                  return {
                    ...candidate,
                    hotspots: candidate.hotspots.map((item) =>
                      item.id === hotspot.id
                        ? { ...item, toggleOverlayId: event.target.value || null }
                        : item,
                    ),
                  };
                })
              }
              disabled={!canEdit}
            >
              <option value="">Aucun</option>
              {block.overlays.map((overlay) => (
                <option key={overlay.id} value={overlay.id}>
                  {overlay.name || overlay.id}
                </option>
              ))}
            </select>
          </label>
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
                onUpdateSelectedBlock((candidate) => {
                  if (candidate.type !== "gameplay") return candidate;
                  return {
                    ...candidate,
                    hotspots: candidate.hotspots.map((item) =>
                      item.id === hotspot.id ? { ...item, soundAssetId: assetId } : item,
                    ),
                  };
                });
                onStatusMessage(`Asset ${file.name} ajoute.`);
                event.target.value = "";
              }}
              disabled={!canEdit}
            />
          </label>
          {renderAssetAttachmentWithRemove(hotspot.soundAssetId, () =>
            onClearGameplayHotspotSound(hotspot.id),
          )}
          <button
            className="button-secondary"
            onClick={() => onSetGameplayPlacementTarget({ kind: "hotspot", id: hotspot.id })}
            disabled={!canEdit}
          >
            Placer sur la scene
          </button>
          <div className="effect-list">
            <div className="section-title-row">
              <span>Effets variables (au clic)</span>
              <button
                className="button-secondary"
                onClick={() => onAddGameplayHotspotEffect(hotspot.id)}
                disabled={!canEdit || project.variables.length === 0}
              >
                + effet
              </button>
            </div>
            {hotspot.effects.map((effect, index) => (
              <div key={`${hotspot.id}-effect-${index}`} className="effect-row">
                <select
                  value={effect.variableId}
                  onChange={(event) =>
                    onUpdateGameplayHotspotEffect(
                      hotspot.id,
                      index,
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
                    onUpdateGameplayHotspotEffect(hotspot.id, index, "delta", event.target.value)
                  }
                  disabled={!canEdit}
                />
                <button
                  className="button-danger"
                  onClick={() => onRemoveGameplayHotspotEffect(hotspot.id, index)}
                  disabled={!canEdit}
                >
                  x
                </button>
              </div>
            ))}
          </div>
          <div className="effect-list">
            <div className="section-title-row">
              <div className="title-with-help">
                <span>Actions au clic</span>
                <HelpHint title="Script simple au clic">
                  Chaques action est executee dans l&apos;ordre: texte, ajout d&apos;objet,
                  desactivation de zone, saut vers un bloc.
                </HelpHint>
              </div>
            </div>
            <div className="row-inline">
              <button
                className="button-secondary"
                onClick={() => onAddGameplayHotspotAction(hotspot.id, "message")}
                disabled={!canEdit}
              >
                + texte
              </button>
              <button
                className="button-secondary"
                onClick={() => onAddGameplayHotspotAction(hotspot.id, "add_item")}
                disabled={!canEdit}
              >
                + objet
              </button>
              <button
                className="button-secondary"
                onClick={() => onAddGameplayHotspotAction(hotspot.id, "disable_hotspot")}
                disabled={!canEdit}
              >
                + desactiver zone
              </button>
              <button
                className="button-secondary"
                onClick={() => onAddGameplayHotspotAction(hotspot.id, "go_to_block")}
                disabled={!canEdit}
              >
                + aller bloc
              </button>
            </div>
            {hotspot.onClickActions.length === 0 && (
              <small className="empty-placeholder">
                Astuce: ajoute une action pour afficher un texte, donner un objet, desactiver une
                zone ou sauter vers un autre bloc.
              </small>
            )}
            {hotspot.onClickActions.map((action) => (
              <div key={action.id} className="choice-card">
                <div className="section-title-row">
                  <strong>Action</strong>
                  <button
                    className="button-danger"
                    onClick={() => onRemoveGameplayHotspotAction(hotspot.id, action.id)}
                    disabled={!canEdit}
                  >
                    Supprimer
                  </button>
                </div>
                <label>
                  Type
                  <select
                    value={action.type}
                    onChange={(event) =>
                      onUpdateGameplayHotspotAction(hotspot.id, action.id, "type", event.target.value)
                    }
                    disabled={!canEdit}
                  >
                    <option value="message">Afficher un texte</option>
                    <option value="add_item">Ajouter un objet</option>
                    <option value="disable_hotspot">Desactiver une zone</option>
                    <option value="go_to_block">Aller vers un bloc</option>
                  </select>
                </label>

                {action.type === "message" && (
                  <label>
                    Texte a afficher
                    <textarea
                      rows={2}
                      value={action.message}
                      onChange={(event) =>
                        onUpdateGameplayHotspotAction(
                          hotspot.id,
                          action.id,
                          "message",
                          event.target.value,
                        )
                      }
                      disabled={!canEdit}
                    />
                  </label>
                )}

                {action.type === "add_item" && (
                  <>
                    <label>
                      Objet
                      <select
                        value={action.itemId ?? ""}
                        onChange={(event) =>
                          onUpdateGameplayHotspotAction(
                            hotspot.id,
                            action.id,
                            "itemId",
                            event.target.value,
                          )
                        }
                        disabled={!canEdit}
                      >
                        <option value="">Aucun</option>
                        {project.items.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Quantite
                      <input
                        type="number"
                        min={1}
                        value={action.quantity}
                        onChange={(event) =>
                          onUpdateGameplayHotspotAction(
                            hotspot.id,
                            action.id,
                            "quantity",
                            event.target.value,
                          )
                        }
                        disabled={!canEdit}
                      />
                    </label>
                  </>
                )}

                {action.type === "disable_hotspot" && (
                  <label>
                    Zone a desactiver
                    <select
                      value={action.targetHotspotId ?? ""}
                      onChange={(event) =>
                        onUpdateGameplayHotspotAction(
                          hotspot.id,
                          action.id,
                          "targetHotspotId",
                          event.target.value,
                        )
                      }
                      disabled={!canEdit}
                    >
                      <option value="">Zone cliquee</option>
                      {block.hotspots.map((candidate) => (
                        <option key={candidate.id} value={candidate.id}>
                          {candidate.name || candidate.id}
                        </option>
                      ))}
                    </select>
                  </label>
                )}

                {action.type === "go_to_block" && (
                  <label>
                    Bloc cible
                    <select
                      value={action.targetBlockId ?? ""}
                      onChange={(event) =>
                        onUpdateGameplayHotspotAction(
                          hotspot.id,
                          action.id,
                          "targetBlockId",
                          event.target.value,
                        )
                      }
                      disabled={!canEdit}
                    >
                      <option value="">Aucun</option>
                      {blocks
                        .filter(
                          (candidate) =>
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
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
      <NextBlockSelect
        selectedBlockId={block.id}
        nextBlockId={block.nextBlockId}
        blocks={blocks}
        canEdit={canEdit}
        onChange={(targetId) => onSetConnection(block.id, "next", targetId)}
      />
      <div className="effect-list">
        <div className="section-title-row">
          <div className="title-with-help">
            <span>Effets a la fin du gameplay</span>
            <HelpHint title="Recompenses de fin">
              Effets appliques une fois l&apos;objectif de la scene atteint, juste avant de passer au
              bloc suivant.
            </HelpHint>
          </div>
          <button
            className="button-secondary"
            onClick={onAddGameplayEffect}
            disabled={!canEdit || project.variables.length === 0}
          >
            + effet
          </button>
        </div>
        {block.completionEffects.map((effect, index) => (
          <div key={`g-effect-${index}`} className="effect-row">
            <select
              value={effect.variableId}
              onChange={(event) => onUpdateGameplayEffect(index, "variableId", event.target.value)}
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
              onChange={(event) => onUpdateGameplayEffect(index, "delta", event.target.value)}
              disabled={!canEdit}
            />
            <button
              className="button-danger"
              onClick={() => onRemoveGameplayEffect(index)}
              disabled={!canEdit}
            >
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
                className="button-secondary"
                onClick={() => onSetSelectedDynamicField("defaultImageAssetId", assetId)}
                disabled={!canEdit || block.defaultImageAssetId === assetId}
              >
                {block.defaultImageAssetId === assetId ? "Par defaut" : "Definir defaut"}
              </button>
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
  onAddGameplayOverlay,
  onRemoveGameplayOverlay,
  onUpdateGameplayOverlayRect,
  onClearGameplayOverlayAsset,
  onAddGameplayHotspot,
  onRemoveGameplayHotspot,
  onUpdateGameplayHotspotRect,
  onClearGameplayHotspotSound,
  onAddGameplayHotspotEffect,
  onUpdateGameplayHotspotEffect,
  onRemoveGameplayHotspotEffect,
  onAddGameplayHotspotAction,
  onUpdateGameplayHotspotAction,
  onRemoveGameplayHotspotAction,
  onAddGameplayEffect,
  onUpdateGameplayEffect,
  onRemoveGameplayEffect,
  gameplayPlacementTarget,
  onSetGameplayPlacementTarget,
  onStartGameplayElementDrag,
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
                onSetSelectedDynamicField={onSetSelectedDynamicField}
                onSetConnection={onSetConnection}
                onAssetInput={onAssetInput}
                renderAssetAttachment={renderAssetAttachment}
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
                onAddGameplayOverlay={onAddGameplayOverlay}
                onRemoveGameplayOverlay={onRemoveGameplayOverlay}
                onUpdateGameplayOverlayRect={onUpdateGameplayOverlayRect}
                onClearGameplayOverlayAsset={onClearGameplayOverlayAsset}
                onAddGameplayHotspot={onAddGameplayHotspot}
                onRemoveGameplayHotspot={onRemoveGameplayHotspot}
                onUpdateGameplayHotspotRect={onUpdateGameplayHotspotRect}
                onClearGameplayHotspotSound={onClearGameplayHotspotSound}
                onAddGameplayHotspotEffect={onAddGameplayHotspotEffect}
                onUpdateGameplayHotspotEffect={onUpdateGameplayHotspotEffect}
                onRemoveGameplayHotspotEffect={onRemoveGameplayHotspotEffect}
                onAddGameplayHotspotAction={onAddGameplayHotspotAction}
                onUpdateGameplayHotspotAction={onUpdateGameplayHotspotAction}
                onRemoveGameplayHotspotAction={onRemoveGameplayHotspotAction}
                onAddGameplayEffect={onAddGameplayEffect}
                onUpdateGameplayEffect={onUpdateGameplayEffect}
                onRemoveGameplayEffect={onRemoveGameplayEffect}
                gameplayPlacementTarget={gameplayPlacementTarget}
                onSetGameplayPlacementTarget={onSetGameplayPlacementTarget}
                onStartGameplayElementDrag={onStartGameplayElementDrag}
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
