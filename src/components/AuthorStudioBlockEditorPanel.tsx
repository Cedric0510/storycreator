import { ChangeEvent, MouseEvent, PointerEvent as ReactPointerEvent, ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  GAMEPLAY_BUTTON_SEQUENCE_FAILURE_HANDLE,
  GAMEPLAY_BUTTON_SEQUENCE_SUCCESS_HANDLE,
  normalizeDelta,
} from "@/components/author-studio-core";
import { GameplayPlacementTarget } from "@/components/author-studio-types";
import { HelpHint } from "@/components/HelpHint";
import {
  BLOCK_LABELS,
  CharacterLayer,
  ChapterStartBlock,
  ChapterEndBlock,
  ChoiceBlock,
  CinematicBlock,
  DEFAULT_CHARACTER_LAYOUT,
  DEFAULT_SCENE_LAYOUT,
  DialogueBlock,
  GameplayBlock,
  GameplayLockInputMode,
  GameplayObject,
  GameplayObjectType,
  GameplayUnlockEffect,
  HeroProfileBlock,
  MAX_GAMEPLAY_BUTTONS,
  NpcProfileBlock,
  ProjectMeta,
  SceneLayout,
  SceneLayerLayout,
  StoryBlock,
  TitleBlock,
  ValidationIssue,
  createId,
} from "@/lib/story";

/** Clipboard for dialogue scene visual layout (images + positioning). */
interface DialogueSceneClipboard {
  backgroundAssetId: string | null;
  characterAssetId: string | null;
  characterLayers: CharacterLayer[];
  sceneLayout: SceneLayout;
}

/** Module-level clipboard ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â persists across block selections within the session. */
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
  onDuplicateSelectedBlock: () => void;
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
  onStartGameplayObjectResize: (event: ReactPointerEvent<HTMLDivElement>, objectId: string) => void;
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

/* ÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚Â
   Scene Copy / Paste ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â images + layout clipboard (dialogue & cinematic)
   ÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚Â */

interface SceneCopyPasteProps {
  block: DialogueBlock | CinematicBlock | GameplayBlock;
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
      characterAssetId: block.type !== "gameplay" ? block.characterAssetId : null,
      characterLayers: block.type === "dialogue" ? structuredClone(block.characterLayers ?? []) : [],
      sceneLayout: structuredClone(block.sceneLayout),
    };
    setHasClipboard(true);
    onStatusMessage("Scene copiee (images + positionnement).");
  }, [block, onStatusMessage]);

  const pasteScene = useCallback(() => {
    if (!dialogueSceneClipboard) return;
    const clip = dialogueSceneClipboard;
    onUpdateSelectedBlock((b) => {
      if (b.type === "dialogue") {
        return {
          ...b,
          backgroundAssetId: clip.backgroundAssetId,
          characterLayers: structuredClone(clip.characterLayers),
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
      if (b.type === "gameplay") {
        return {
          ...b,
          backgroundAssetId: clip.backgroundAssetId,
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

/* ÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚Â
   Scene Composer ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â gameplay-style drag & resize
   ÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚Â */

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
  /** @deprecated single character for cinematic blocks */
  charSrc?: string | undefined;
  canEdit: boolean;
  onChange: (layout: SceneLayout) => void;
  onChangeCharacterLayout?: (layerId: string, layout: SceneLayerLayout) => void;
  children?: ReactNode;
  sceneClassName?: string;
  onSceneClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
  onScenePointerMove?: (e: React.PointerEvent<HTMLDivElement>) => void;
  onScenePointerUp?: (e: React.PointerEvent<HTMLDivElement>) => void;
  onScenePointerCancel?: (e: React.PointerEvent<HTMLDivElement>) => void;
}

type DragTarget = { kind: "bg" } | { kind: "char" } | { kind: "layer"; layerId: string };

function SceneComposer({ layout: layoutProp, bgSrc, characterLayers, charSrc, canEdit, onChange, onChangeCharacterLayout, children, sceneClassName, onSceneClick, onScenePointerMove, onScenePointerUp, onScenePointerCancel }: SceneComposerProps) {
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
  // Multi-layer mode
  const layers = characterLayers ?? [];
  const hasLayers = layers.length > 0;
  // Fallback single char for cinematic
  const hasSingleChar = Boolean(charSrc) && !hasLayers;

  const getTargetLayout = useCallback((target: DragTarget): SceneLayerLayout => {
    if (target.kind === "bg") return layout.background;
    if (target.kind === "char") return layout.character;
    return layers.find((l) => l.key === target.layerId)?.layout ?? { x: 0, y: 0, width: 50, height: 80 };
  }, [layout, layers]);

  const applyPatch = useCallback((target: DragTarget, patch: Partial<SceneLayerLayout>) => {
    if (target.kind === "bg") {
      onChange({ ...layout, background: { ...layout.background, ...patch } });
    } else if (target.kind === "char") {
      onChange({ ...layout, character: { ...layout.character, ...patch } });
    } else if (onChangeCharacterLayout) {
      const cur = layers.find((l) => l.key === target.layerId)?.layout ?? { x: 0, y: 0, width: 50, height: 80 };
      onChangeCharacterLayout(target.layerId, { ...cur, ...patch });
    }
  }, [layout, layers, onChange, onChangeCharacterLayout]);

  const startDrag = useCallback(
    (e: React.PointerEvent, target: DragTarget, mode: "move" | "resize") => {
      if (!canEdit) return;
      e.preventDefault();
      e.stopPropagation();
      dragRef.current = {
        target,
        mode,
        startX: e.clientX,
        startY: e.clientY,
        origRect: { ...getTargetLayout(target) },
      };
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    },
    [canEdit, getTargetLayout],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      const d = dragRef.current;
      if (!d || !sceneRef.current) return;
      const rect = sceneRef.current.getBoundingClientRect();
      const dx = ((e.clientX - d.startX) / rect.width) * 100;
      const dy = ((e.clientY - d.startY) / rect.height) * 100;

      if (d.mode === "move") {
        applyPatch(d.target, {
          x: Math.round(d.origRect.x + dx),
          y: Math.round(d.origRect.y + dy),
        });
      } else {
        applyPatch(d.target, {
          width: Math.round(Math.max(5, d.origRect.width + dx)),
          height: Math.round(Math.max(5, d.origRect.height + dy)),
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
    r: SceneLayerLayout,
    src: string | undefined,
    label: string,
    isChar: boolean,
    zStyle?: number,
  ) => {
    if (!src) return null;
    return (
      <div
        key={target.kind === "layer" ? target.layerId : target.kind}
        className={`scene-composer-box${isChar ? " scene-composer-box-char" : ""}`}
        style={{
          left: `${r.x}%`,
          top: `${r.y}%`,
          width: `${r.width}%`,
          height: `${r.height}%`,
          zIndex: zStyle ?? (isChar ? 2 : 1),
        }}
        onPointerDown={(e) => startDrag(e, target, "move")}
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
        <div
          className="scene-composer-resize-handle"
          onPointerDown={(e) => { e.stopPropagation(); startDrag(e, target, "resize"); }}
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
        >ÃƒÂ¢Ã¢â‚¬Â Ã‚Âº Reset</button>
      </div>

      <div
        ref={sceneRef}
        className={`scene-composer-scene${sceneClassName ? ` ${sceneClassName}` : ""}`}
        onClick={onSceneClick}
        onPointerMove={onScenePointerMove}
        onPointerUp={onScenePointerUp}
        onPointerCancel={onScenePointerCancel}
      >
        {/* Visual reference guides ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â thirds + center */}
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
        {/* Multi-character layers sorted by zIndex (higher = behind) */}
        {[...layers]
          .sort((a, b) => b.zIndex - a.zIndex)
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
        {/* Fallback single character for cinematic blocks */}
        {hasSingleChar && renderBox({ kind: "char" }, layout.character, charSrc, "Perso", true)}
        {children}
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
  onRegisterAsset: (file: File) => string;
  onEnsureAssetPreviewSrc: (assetId: string) => Promise<string | null>;
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
  onRegisterAsset,
  onEnsureAssetPreviewSrc,
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

  const layers = block.characterLayers ?? [];

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

      {/* --- Character layers (multi-character with z-index) --- */}
      <div className="section-title-row">
        <div className="title-with-help">
          <h3>Personnages ({layers.length}/5)</h3>
          <HelpHint title="Personnages">
            Ajoute jusqu&apos;a 5 images de personnages. Le cran (1-5) determine le plan : 1 = premier
            plan (devant), 5 = arriere-plan (derriere). Chaque personnage a sa propre position
            dans le compositeur de scene.
          </HelpHint>
        </div>
        {layers.length < 5 && (
          <label className="button-secondary" style={{ cursor: "pointer", margin: 0 }}>
            + personnage
            <input
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={(event) => {
                if (!canEdit) return;
                const file = event.target.files?.[0];
                if (!file) return;
                const assetId = onRegisterAsset(file);
                void onEnsureAssetPreviewSrc(assetId);
                const newLayer: CharacterLayer = {
                  id: createId("clayer"),
                  assetId,
                  label: `Perso ${layers.length + 1}`,
                  zIndex: Math.min(layers.length + 1, 5),
                  layout: { ...DEFAULT_CHARACTER_LAYOUT },
                };
                onUpdateSelectedBlock((b) =>
                  b.type === "dialogue"
                    ? { ...b, characterLayers: [...(b.characterLayers ?? []), newLayer] }
                    : b,
                );
                onStatusMessage(`Personnage ajoute: ${file.name}`);
                event.target.value = "";
              }}
              disabled={!canEdit}
            />
          </label>
        )}
      </div>
      {layers.length === 0 && (
        <small className="empty-placeholder">Aucun personnage. Clique &quot;+ personnage&quot; pour en ajouter.</small>
      )}
      {layers.map((layer, layerIdx) => (
        <div key={layer.id} className="choice-card" style={{ padding: "6px 8px" }}>
          <div className="effect-row" style={{ gridTemplateColumns: "1fr 80px 28px", alignItems: "center" }}>
            <input
              type="text"
              value={layer.label}
              placeholder="Nom"
              onChange={(event) =>
                onUpdateSelectedBlock((b) => {
                  if (b.type !== "dialogue") return b;
                  return {
                    ...b,
                    characterLayers: (b.characterLayers ?? []).map((l, i) =>
                      i !== layerIdx ? l : { ...l, label: event.target.value },
                    ),
                  };
                })
              }
              disabled={!canEdit}
            />
            <select
              value={layer.zIndex}
              onChange={(event) =>
                onUpdateSelectedBlock((b) => {
                  if (b.type !== "dialogue") return b;
                  return {
                    ...b,
                    characterLayers: (b.characterLayers ?? []).map((l, i) =>
                      i !== layerIdx ? l : { ...l, zIndex: Number(event.target.value) },
                    ),
                  };
                })
              }
              disabled={!canEdit}
            >
              <option value={1}>Cran 1</option>
              <option value={2}>Cran 2</option>
              <option value={3}>Cran 3</option>
              <option value={4}>Cran 4</option>
              <option value={5}>Cran 5</option>
            </select>
            <button
              className="button-danger"
              onClick={() =>
                onUpdateSelectedBlock((b) => {
                  if (b.type !== "dialogue") return b;
                  return {
                    ...b,
                    characterLayers: (b.characterLayers ?? []).filter((_, i) => i !== layerIdx),
                  };
                })
              }
              disabled={!canEdit}
              title="Retirer ce personnage"
            >
              x
            </button>
          </div>
          <div className="asset-line">
            <small>{assetPreviewSrcById[layer.assetId ?? ""] ? "Image chargee" : "Aucune image"}</small>
            <label className="button-secondary" style={{ cursor: "pointer", margin: 0, fontSize: "0.75rem" }}>
              Changer
              <input
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={(event) => {
                  if (!canEdit) return;
                  const file = event.target.files?.[0];
                  if (!file) return;
                  const assetId = onRegisterAsset(file);
                  void onEnsureAssetPreviewSrc(assetId);
                  onUpdateSelectedBlock((b) => {
                    if (b.type !== "dialogue") return b;
                    return {
                      ...b,
                      characterLayers: (b.characterLayers ?? []).map((l, i) =>
                        i !== layerIdx ? l : { ...l, assetId },
                      ),
                    };
                  });
                  event.target.value = "";
                }}
                disabled={!canEdit}
              />
            </label>
          </div>
        </div>
      ))}

      {/* --- Scene Composer --- */}
      {(() => {
        const bgSrc = assetPreviewSrcById[block.backgroundAssetId ?? ""];
        const layerSrcs = layers
          .map((layer, idx) => ({
            key: layer.id,
            label: layer.label || `Perso ${idx + 1}`,
            src: assetPreviewSrcById[layer.assetId ?? ""],
            zIndex: layer.zIndex,
            layout: layer.layout,
          }))
          .filter((item) => item.src);
        const hasAnyAsset = block.backgroundAssetId || layerSrcs.length > 0;
        if (!hasAnyAsset) return null;
        return (
          <SceneComposer
            layout={block.sceneLayout}
            bgSrc={bgSrc}
            characterLayers={layerSrcs}
            canEdit={canEdit}
            onChange={(newLayout) => {
              onUpdateSelectedBlock((b) =>
                b.type === "dialogue" ? { ...b, sceneLayout: newLayout } : b,
              );
            }}
            onChangeCharacterLayout={(layerId, newLayerLayout) => {
              onUpdateSelectedBlock((b) => {
                if (b.type !== "dialogue") return b;
                return {
                  ...b,
                  characterLayers: (b.characterLayers ?? []).map((l) =>
                    l.id !== layerId ? l : { ...l, layout: newLayerLayout },
                  ),
                };
              });
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
              Ligne {index + 1} ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â {line.speaker || "ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦"}
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
                          Ligne {globalIndex + 1} ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â {candidate.speaker || "ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦"}
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
              list={`npc-names-${line.id}`}
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
            <datalist id={`npc-names-${line.id}`}>
              {blocks
                .filter((b): b is NpcProfileBlock => b.type === "npc_profile" && b.npcName.trim() !== "")
                .map((npc) => (
                  <option key={npc.id} value={npc.npcName} />
                ))}
            </datalist>
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
                          Ligne {globalIndex + 1} ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â {candidate.speaker || "ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦"}
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
  onStartGameplayObjectResize: (event: ReactPointerEvent<HTMLDivElement>, objectId: string) => void;
  onGameplaySceneClick: (event: MouseEvent<HTMLDivElement>) => void;
  onGameplayScenePointerMove: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onGameplayScenePointerEnd: (event: ReactPointerEvent<HTMLDivElement>) => void;
  assetPreviewSrcById: Record<string, string>;
  onRegisterAsset: (file: File) => string;
  onEnsureAssetPreviewSrc: (assetId: string) => Promise<string | null>;
  onStatusMessage: (message: string) => void;
}

function gameplayClampCran(value: number) {
  return Math.min(5, Math.max(1, Math.round(value)));
}

function gameplayCranFromZIndex(zIndex: number) {
  return 6 - gameplayClampCran(zIndex);
}

function gameplayZIndexFromCran(cran: number) {
  return 6 - gameplayClampCran(cran);
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
  onStartGameplayObjectResize,
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
    button: "Bouton (sequence code)",
  };

  const unlockEffectLabels: Record<GameplayUnlockEffect, string> = {
    go_to_next: "Passe au bloc suivant",
    disappear: "Disparait de la scene",
    modify_stats: "Modifie les stats",
  };
  const lockInputModeLabels: Record<GameplayLockInputMode, string> = {
    scene_key: "Cle dans la scene",
    inventory_item: "Item inventaire",
  };

  const linkableBlocks = blocks.filter(
    (candidate) =>
      candidate.id !== block.id &&
      candidate.type !== "hero_profile" &&
      candidate.type !== "npc_profile",
  );
  const buttonObjects = block.objects.filter((o) => o.objectType === "button");

  // Build keyÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢lock arrow pairs for the scene overlay
  const keyLockPairs = block.objects
    .filter((o) => o.objectType === "lock" && o.lockInputMode !== "inventory_item" && o.linkedKeyId)
    .map((lock) => {
      const key = block.objects.find((o) => o.id === lock.linkedKeyId);
      return key ? { key, lock } : null;
    })
    .filter(Boolean) as { key: GameplayObject; lock: GameplayObject }[];
  const inventoryItemOptions = useMemo(() => {
    const optionsById = new Map<string, { id: string; name: string }>();
    for (const item of project.items) {
      optionsById.set(item.id, { id: item.id, name: item.name });
    }
    for (const candidate of blocks) {
      if (candidate.type !== "gameplay") continue;
      for (const candidateObject of candidate.objects) {
        if (candidateObject.objectType !== "collectible") continue;
        const inventoryItemId = candidateObject.grantItemId ?? candidateObject.id;
        if (optionsById.has(inventoryItemId)) continue;
        const objectName = candidateObject.name.trim();
        const blockName = candidate.name.trim();
        const name = objectName || (blockName ? `Objet de ${blockName}` : "Objet collectible");
        optionsById.set(inventoryItemId, { id: inventoryItemId, name });
      }
    }
    return Array.from(optionsById.values());
  }, [blocks, project.items]);

  return (
    <div className="subsection">
      <div className="title-with-help">
        <h3>Bloc gameplay</h3>
        <HelpHint title="Scene interactive">
          Place des objets sur un decor. 5 types: decoration, collectible, cle, serrure et bouton.
          Les cles sont deplacables a la souris pour les deposer sur leur serrure.
        </HelpHint>
      </div>

      {/* ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ Objectif ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ */}
      <label>
        Objectif
        <textarea
          rows={3}
          value={block.objective}
          onChange={(event) => onSetSelectedDynamicField("objective", event.target.value)}
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

      {/* ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ Background ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ */}
      <label>
        Image fond
        <input type="file" accept="image/*" onChange={onAssetInput("backgroundAssetId")} disabled={!canEdit} />
      </label>
      {renderAssetAttachment("backgroundAssetId", block.backgroundAssetId)}

      {/* ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ Unified scene: background composer + interactive objects ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ */}
      <div className="section-title-row">
        <small>
          {gameplayPlacementTarget
            ? "Clique dans la scene pour placer l'objet"
            : "Deplace le fond ou les objets a la souris"}
        </small>
      </div>
      <SceneComposer
        layout={block.sceneLayout}
        bgSrc={assetPreviewSrcById[block.backgroundAssetId ?? ""]}
        canEdit={canEdit}
        onChange={(newLayout) => {
          onUpdateSelectedBlock((b) =>
            b.type === "gameplay" ? { ...b, sceneLayout: newLayout } : b,
          );
        }}
        onSceneClick={onGameplaySceneClick}
        onScenePointerMove={onGameplayScenePointerMove}
        onScenePointerUp={onGameplayScenePointerEnd}
        onScenePointerCancel={onGameplayScenePointerEnd}
      >
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
                zIndex: obj.zIndex + 10,
                backgroundImage: assetPreviewSrcById[obj.assetId ?? ""]
                  ? `url(${assetPreviewSrcById[obj.assetId ?? ""]})`
                  : undefined,
                opacity: obj.visibleByDefault ? 1 : 0.45,
              }}
              onPointerDown={(event) => onStartGameplayObjectDrag(event, obj.id)}
              onClick={(event) => event.stopPropagation()}
            >
              {!assetPreviewSrcById[obj.assetId ?? ""] && <span>{obj.name || "Objet"}</span>}
              {canEdit && (
                <div
                  className="pointclick-resize-handle"
                  onPointerDown={(event) => { event.stopPropagation(); onStartGameplayObjectResize(event, obj.id); }}
                />
              )}
            </div>
          ))}

        {/* SVG arrows from key center ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ lock center */}
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
      </SceneComposer>

      {/* ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ Ambiance ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ */}
      <label>
        Audio ambiance
        <input type="file" accept="audio/*" onChange={onAssetInput("voiceAssetId")} disabled={!canEdit} />
      </label>
      {renderAssetAttachment("voiceAssetId", block.voiceAssetId)}

      {/* ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ Objects list ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ */}
      <div className="section-title-row">
        <div className="title-with-help">
          <h3>Objets</h3>
          <HelpHint title="Les 5 types">
            Decoration: pas d&apos;action. Collectible: va dans l&apos;inventaire.
            Cle: deplacable a la souris jusqu&apos;a la serrure. Serrure: attend sa cle.
            Bouton: sert au systeme de sequence (code PIN).
          </HelpHint>
        </div>
        <button className="button-secondary" onClick={onAddGameplayObject} disabled={!canEdit}>
          + objet
        </button>
      </div>

      {block.objects.length === 0 && (
        <p className="empty-placeholder">Aucun objet. Clique &quot;+ objet&quot; pour commencer.</p>
      )}

      {block.objects.map((obj) => {
        const currentSequenceIndex = block.buttonSequence.indexOf(obj.id);
        const fallbackButtonIndex = buttonObjects.findIndex((candidate) => candidate.id === obj.id);
        const buttonSequencePosition =
          currentSequenceIndex >= 0
            ? currentSequenceIndex + 1
            : Math.min(MAX_GAMEPLAY_BUTTONS, fallbackButtonIndex + 1);
        return (
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

          {/* ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ Type ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ */}
          <label>
            Type
            <select
              value={obj.objectType}
              onChange={(event) => {
                const nextType = event.target.value as GameplayObjectType;
                const removingLastButton =
                  obj.objectType === "button" && nextType !== "button" && buttonObjects.length === 1;
                if (nextType === "button" && obj.objectType !== "button" && buttonObjects.length >= MAX_GAMEPLAY_BUTTONS) {
                  onStatusMessage(`Maximum ${MAX_GAMEPLAY_BUTTONS} boutons par bloc gameplay.`);
                  return;
                }

                onUpdateSelectedBlock((candidate) => {
                  if (candidate.type !== "gameplay") return candidate;

                  const nextObjects = candidate.objects.map((o) => {
                    if (o.id !== obj.id) return o;
                    const nextObject: GameplayObject = { ...o, objectType: nextType };
                    if (nextType !== "lock") {
                      nextObject.linkedKeyId = null;
                      nextObject.lockInputMode = "scene_key";
                      nextObject.requiredItemId = null;
                      nextObject.consumeRequiredItem = false;
                      nextObject.targetBlockId = null;
                    } else if (o.objectType !== "lock") {
                      nextObject.lockInputMode = "scene_key";
                      nextObject.requiredItemId = null;
                      nextObject.consumeRequiredItem = false;
                    }
                    if (nextType !== "collectible") {
                      nextObject.grantItemId = null;
                    }
                    return nextObject;
                  });

                  const nextOrderedButtonIds = nextObjects
                    .filter((o) => o.objectType === "button")
                    .map((o) => o.id);
                  const nextButtonIds = new Set(nextOrderedButtonIds);
                  let nextButtonSequence = (candidate.buttonSequence ?? [])
                    .filter((buttonId) => nextButtonIds.has(buttonId))
                    .slice(0, MAX_GAMEPLAY_BUTTONS);
                  if (
                    nextType === "button" &&
                    obj.objectType !== "button" &&
                    !nextButtonSequence.includes(obj.id)
                  ) {
                    nextButtonSequence = [...nextButtonSequence, obj.id].slice(0, MAX_GAMEPLAY_BUTTONS);
                  }
                  const missingButtonIds = nextOrderedButtonIds
                    .filter((buttonId) => !nextButtonSequence.includes(buttonId));
                  nextButtonSequence = [...nextButtonSequence, ...missingButtonIds].slice(0, MAX_GAMEPLAY_BUTTONS);
                  const clearButtonOutputs = nextButtonIds.size === 0;

                  return {
                    ...candidate,
                    objects: nextObjects,
                    buttonSequence: nextButtonSequence,
                    buttonSequenceSuccessBlockId: clearButtonOutputs
                      ? null
                      : candidate.buttonSequenceSuccessBlockId,
                    buttonSequenceFailureBlockId: clearButtonOutputs
                      ? null
                      : candidate.buttonSequenceFailureBlockId,
                  };
                });

                if (nextType !== "lock") {
                  onSetConnection(block.id, `lock-${obj.id}`, null);
                }
                if (removingLastButton) {
                  onSetConnection(block.id, GAMEPLAY_BUTTON_SEQUENCE_SUCCESS_HANDLE, null);
                  onSetConnection(block.id, GAMEPLAY_BUTTON_SEQUENCE_FAILURE_HANDLE, null);
                }
              }}
              disabled={!canEdit}
            >
              {(Object.keys(typeLabels) as GameplayObjectType[]).map((key) => (
                <option key={key} value={key}>{typeLabels[key]}</option>
              ))}
            </select>
          </label>

          {/* ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ Plan (1 = devant, 5 = derriere) ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ */}
          <div className="grid-two">
            <label>
              Plan
              <select
                value={gameplayCranFromZIndex(obj.zIndex)}
                onChange={(event) =>
                  onUpdateGameplayObjectField(
                    obj.id,
                    "zIndex",
                    gameplayZIndexFromCran(Number(event.target.value)),
                  )
                }
                disabled={!canEdit}
              >
                <option value={1}>Cran 1</option>
                <option value={2}>Cran 2</option>
                <option value={3}>Cran 3</option>
                <option value={4}>Cran 4</option>
                <option value={5}>Cran 5</option>
              </select>
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

          {/* ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ Type-specific fields ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ */}
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
                Source deverrouillage
                <select
                  value={obj.lockInputMode}
                  onChange={(event) => {
                    const nextMode = event.target.value as GameplayLockInputMode;
                    onUpdateSelectedBlock((candidate) => {
                      if (candidate.type !== "gameplay") return candidate;
                      return {
                        ...candidate,
                        objects: candidate.objects.map((candidateObject) => {
                          if (candidateObject.id !== obj.id) return candidateObject;
                          if (nextMode === "inventory_item") {
                            return {
                              ...candidateObject,
                              lockInputMode: nextMode,
                              linkedKeyId: null,
                            };
                          }
                          return {
                            ...candidateObject,
                            lockInputMode: nextMode,
                            requiredItemId: null,
                            consumeRequiredItem: false,
                          };
                        }),
                      };
                    });
                  }}
                  disabled={!canEdit}
                >
                  {(Object.keys(lockInputModeLabels) as GameplayLockInputMode[]).map((key) => (
                    <option key={key} value={key}>{lockInputModeLabels[key]}</option>
                  ))}
                </select>
              </label>
              {obj.lockInputMode === "scene_key" && (
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
              )}
              {obj.lockInputMode === "inventory_item" && (
                <>
                  <label>
                    Item requis
                    <select
                      value={obj.requiredItemId ?? ""}
                      onChange={(event) => onUpdateGameplayObjectField(obj.id, "requiredItemId", event.target.value || null)}
                      disabled={!canEdit}
                    >
                      <option value="">Aucun</option>
                      {inventoryItemOptions.map((item) => (
                        <option key={item.id} value={item.id}>{item.name}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Consommer item
                    <select
                      value={obj.consumeRequiredItem ? "yes" : "no"}
                      onChange={(event) => onUpdateGameplayObjectField(obj.id, "consumeRequiredItem", event.target.value === "yes")}
                      disabled={!canEdit}
                    >
                      <option value="no">non</option>
                      <option value="yes">oui</option>
                    </select>
                  </label>
                </>
              )}
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
                Bloc cible serrure
                <select
                  value={obj.targetBlockId ?? ""}
                  onChange={(event) =>
                    onSetConnection(block.id, `lock-${obj.id}`, event.target.value || null)
                  }
                  disabled={!canEdit || obj.unlockEffect !== "go_to_next"}
                >
                  <option value="">Fin histoire</option>
                  {linkableBlocks.map((candidate) => (
                    <option key={candidate.id} value={candidate.id}>
                      {candidate.name} ({BLOCK_LABELS[candidate.type]})
                    </option>
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

          {obj.objectType === "button" && (
            <label>
              Position dans la sequence
              <select
                value={String(Math.max(1, buttonSequencePosition))}
                onChange={(event) => {
                  const requested = Number(event.target.value);
                  onUpdateSelectedBlock((candidate) => {
                    if (candidate.type !== "gameplay") return candidate;
                    if (!Number.isFinite(requested)) return candidate;
                    const candidateButtonIds = candidate.objects
                      .filter((button) => button.objectType === "button")
                      .map((button) => button.id);
                    const candidateButtonSet = new Set(candidateButtonIds);
                    if (!candidateButtonSet.has(obj.id)) return candidate;

                    const withoutCurrent = candidate.buttonSequence
                      .filter((buttonId) => buttonId !== obj.id && candidateButtonSet.has(buttonId));
                    const maxPosition = Math.min(MAX_GAMEPLAY_BUTTONS, candidateButtonIds.length);
                    const insertIndex = Math.max(
                      0,
                      Math.min(maxPosition - 1, requested - 1),
                    );
                    const nextSequence = [...withoutCurrent];
                    nextSequence.splice(insertIndex, 0, obj.id);
                    const missingButtonIds = candidateButtonIds.filter(
                      (buttonId) => !nextSequence.includes(buttonId),
                    );
                    return {
                      ...candidate,
                      buttonSequence: [...nextSequence, ...missingButtonIds].slice(0, MAX_GAMEPLAY_BUTTONS),
                    };
                  });
                }}
                disabled={!canEdit}
              >
                {Array.from({ length: Math.min(MAX_GAMEPLAY_BUTTONS, buttonObjects.length) }).map((_, index) => (
                  <option key={`btn-seq-pos-${obj.id}-${index + 1}`} value={String(index + 1)}>
                    {index + 1}
                  </option>
                ))}
              </select>
            </label>
          )}

          {/* ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ Sound ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ */}
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

          {/* ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ Effects ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ */}
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
      );
      })}

      {buttonObjects.length > 0 && (
        <div className="effect-list">
          <div className="section-title-row">
            <div className="title-with-help">
              <span>Sequence boutons (code)</span>
              <HelpHint title="Code PIN">
                Attribue un rang a chaque bouton (1 a {MAX_GAMEPLAY_BUTTONS}) directement dans sa carte.
                Si un rang est duplique, le dernier bouton defini prend la position.
              </HelpHint>
            </div>
          </div>

          <div className="grid-two">
            <label>
              Sortie reussite
              <select
                value={block.buttonSequenceSuccessBlockId ?? ""}
                onChange={(event) =>
                  onSetConnection(
                    block.id,
                    GAMEPLAY_BUTTON_SEQUENCE_SUCCESS_HANDLE,
                    event.target.value || null,
                  )
                }
                disabled={!canEdit}
              >
                <option value="">Fin histoire</option>
                {linkableBlocks.map((candidate) => (
                  <option key={candidate.id} value={candidate.id}>
                    {candidate.name} ({BLOCK_LABELS[candidate.type]})
                  </option>
                ))}
              </select>
            </label>
            <label>
              Sortie echec
              <select
                value={block.buttonSequenceFailureBlockId ?? ""}
                onChange={(event) =>
                  onSetConnection(
                    block.id,
                    GAMEPLAY_BUTTON_SEQUENCE_FAILURE_HANDLE,
                    event.target.value || null,
                  )
                }
                disabled={!canEdit}
              >
                <option value="">Fin histoire</option>
                {linkableBlocks.map((candidate) => (
                  <option key={candidate.id} value={candidate.id}>
                    {candidate.name} ({BLOCK_LABELS[candidate.type]})
                  </option>
                ))}
              </select>
            </label>
          </div>
          <small>
            Sequence active: {block.buttonSequence.length} / {Math.min(MAX_GAMEPLAY_BUTTONS, buttonObjects.length)} bouton(s)
          </small>
        </div>
      )}

      {/* Completion effects */}
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

/* ÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚Â
   ChapterStartEditorSection
   ÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚Â */

function ChapterStartEditorSection({
  block,
  canEdit,
  blocks,
  project,
  onSetSelectedDynamicField,
  onSetConnection,
}: {
  block: ChapterStartBlock;
  canEdit: boolean;
  blocks: StoryBlock[];
  project: ProjectMeta;
  onSetSelectedDynamicField: (key: string, value: unknown) => void;
  onSetConnection: (sourceId: string, sourceHandle: string, targetId: string | null) => void;
}) {
  const chapter = project.chapters.find((ch) => ch.id === block.chapterId);
  return (
    <>
      <label>
        Titre du chapitre
        <input
          value={block.chapterTitle}
          onChange={(event) => onSetSelectedDynamicField("chapterTitle", event.target.value)}
          disabled={!canEdit}
        />
      </label>
      {chapter && (
        <p className="form-hint">Chapitre: {chapter.name}</p>
      )}
      <NextBlockSelect
        selectedBlockId={block.id}
        nextBlockId={block.nextBlockId}
        blocks={blocks}
        canEdit={canEdit}
        onChange={(targetId) => onSetConnection(block.id, "next", targetId)}
      />
    </>
  );
}

/* ÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚Â
   ChapterEndEditorSection
   ÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚Â */

function ChapterEndEditorSection({
  block,
  canEdit,
  blocks,
  onSetConnection,
}: {
  block: ChapterEndBlock;
  canEdit: boolean;
  blocks: StoryBlock[];
  onSetConnection: (sourceId: string, sourceHandle: string, targetId: string | null) => void;
}) {
  return (
    <NextBlockSelect
      selectedBlockId={block.id}
      nextBlockId={block.nextBlockId}
      blocks={blocks}
      canEdit={canEdit}
      onChange={(targetId) => onSetConnection(block.id, "next", targetId)}
    />
  );
}

/* ÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚Â
   ChapterAssignmentSelect ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â assign a block to a chapter
   ÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚Â */

function ChapterAssignmentSelect({
  block,
  project,
  canEdit,
  onSetSelectedDynamicField,
}: {
  block: StoryBlock;
  project: ProjectMeta;
  canEdit: boolean;
  onSetSelectedDynamicField: (key: string, value: unknown) => void;
}) {
  // chapter_start blocks auto-manage their chapterId ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â don't allow manual reassignment
  if (block.type === "chapter_start") return null;
  if (project.chapters.length === 0) return null;

  return (
    <label>
      Chapitre
      <select
        value={block.chapterId ?? ""}
        onChange={(event) => onSetSelectedDynamicField("chapterId", event.target.value || null)}
        disabled={!canEdit}
      >
        <option value="">Aucun chapitre</option>
        {project.chapters.map((ch) => (
          <option key={ch.id} value={ch.id}>
            {ch.name}
          </option>
        ))}
      </select>
    </label>
  );
}

export function AuthorStudioBlockEditorPanel({
  selectedBlock,
  canEdit,
  project,
  blocks,
  visibleIssues,
  onDeleteSelectedBlock,
  onDuplicateSelectedBlock,
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
  onStartGameplayObjectResize,
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
          <div style={{ display: "flex", gap: 6 }}>
            <button
              className="button-secondary"
              onClick={onDuplicateSelectedBlock}
              disabled={!selectedBlock || !canEdit}
            >
              Dupliquer
            </button>
            <button
              className="button-danger"
              onClick={onDeleteSelectedBlock}
              disabled={!selectedBlock || !canEdit}
            >
              Supprimer
            </button>
          </div>
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

            <ChapterAssignmentSelect
              block={selectedBlock}
              project={project}
              canEdit={canEdit}
              onSetSelectedDynamicField={onSetSelectedDynamicField}
            />

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
                onRegisterAsset={onRegisterAsset}
                onEnsureAssetPreviewSrc={onEnsureAssetPreviewSrc}
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
                onStartGameplayObjectResize={onStartGameplayObjectResize}
                onGameplaySceneClick={onGameplaySceneClick}
                onGameplayScenePointerMove={onGameplayScenePointerMove}
                onGameplayScenePointerEnd={onGameplayScenePointerEnd}
                assetPreviewSrcById={assetPreviewSrcById}
                onRegisterAsset={onRegisterAsset}
                onEnsureAssetPreviewSrc={onEnsureAssetPreviewSrc}
                onStatusMessage={onStatusMessage}
              />
            )}

            {selectedBlock.type === "chapter_start" && (
              <ChapterStartEditorSection
                block={selectedBlock}
                canEdit={canEdit}
                blocks={blocks}
                project={project}
                onSetSelectedDynamicField={onSetSelectedDynamicField}
                onSetConnection={onSetConnection}
              />
            )}

            {selectedBlock.type === "chapter_end" && (
              <ChapterEndEditorSection
                block={selectedBlock}
                canEdit={canEdit}
                blocks={blocks}
                onSetConnection={onSetConnection}
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
