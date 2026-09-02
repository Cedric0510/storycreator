import { ChangeEvent, MouseEvent, PointerEvent as ReactPointerEvent, ReactNode, useCallback, useState } from "react";

import { normalizeDelta } from "@/components/author-studio-core";
import { GameplayPlacementTarget } from "@/components/author-studio-types";
import { HelpHint } from "@/components/HelpHint";
import { InspectorSection } from "@/components/InspectorSection";
import { EditorGroup } from "@/components/EditorGroup";
import { NextBlockSelect } from "@/components/AuthorStudioNextBlockSelect";
import { PlayerTextInput } from "@/components/PlayerTextFormatting";
import { AuthorStudioBustEditor } from "@/components/AuthorStudioBustEditor";
import {
  SwitchEditorSection,
  TitleEditorSection,
} from "@/components/AuthorStudioBasicSections";
import { DialogueEditorSection } from "@/components/AuthorStudioDialogueSection";
import { ChoiceEditorSection } from "@/components/AuthorStudioChoiceSection";
import { GameplayEditorSection } from "@/components/AuthorStudioGameplaySection";
import {
  CharacterLayersManager,
  ExpandableSceneComposer,
  SceneCopyPaste,
} from "@/components/AuthorStudioSceneComposer";
import {
  ChapterAssignmentSelect,
  ChapterEndEditorSection,
  ChapterStartEditorSection,
  HeroProfileEditorSection,
  NpcProfileEditorSection,
  PartEndEditorSection,
  PartStartEditorSection,
} from "@/components/AuthorStudioProfileChapterSections";
import {
  CinematicNarration,
  CharacterLayer,
  ChapterEndBlock,
  CinematicBlock,
  GameplayObject,
  ProjectMeta,
  StoryBlock,
  createDefaultCinematicNarration,
} from "@/lib/story";

type ChoiceField = "text" | "targetBlockId" | "heroMemoryVariableId" | "heroMemoryValue";
type EffectField = "variableId" | "delta";
type ResponseField = "text" | "targetLineId" | "targetBlockId";

interface AuthorStudioBlockEditorPanelProps {
  selectedBlock: StoryBlock | null;
  canEdit: boolean;
  project: ProjectMeta;
  blocks: StoryBlock[];
  chapterEndOptionsByChapterId: Record<string, ChapterEndBlock[]>;
  onDeleteSelectedBlock: () => void;
  onDuplicateSelectedBlock: () => void;
  onSetStartBlock: (blockId: string) => void;
  onSetSelectedDynamicField: (key: string, value: unknown) => void;
  onUpdateSelectedBlock: (updater: (block: StoryBlock) => StoryBlock) => void;
  onSetConnection: (sourceId: string, sourceHandle: string, targetId: string | null) => void;
  onAssetInput: (fieldName: string) => (event: ChangeEvent<HTMLInputElement>) => void;
  renderAssetAttachment: (fieldName: string, assetId: string | null) => ReactNode;
  renderAssetAttachmentWithRemove: (assetId: string | null, onRemove: () => void) => ReactNode;
  onAddDialogueLine: (afterLineId?: string) => void;
  onRemoveDialogueLine: (lineId: string) => void;
  onUpdateDialogueLineField: (lineId: string, field: string, value: string | number | null) => void;
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
  getAssetFileName: (assetId: string | null) => string;
  onRegisterAsset: (file: File) => string;
  onEnsureAssetPreviewSrc: (assetId: string) => Promise<string | null>;
  onStatusMessage: (message: string) => void;
  onSetChapterValidationFromEnd: (chapterEndBlockId: string, validated: boolean) => void;
  onSetPartValidationFromEnd: (partEndBlockId: string, validated: boolean) => void;
  onSetChapterStartPreviousLink: (
    chapterStartBlockId: string,
    previousChapterId: string | null,
    previousChapterEndBlockId: string | null,
  ) => void;
}

interface CinematicEditorSectionProps {
  block: CinematicBlock;
  canEdit: boolean;
  blocks: StoryBlock[];
  project: ProjectMeta;
  assetPreviewSrcById: Record<string, string>;
  getAssetFileName: (assetId: string | null) => string;
  onSetSelectedDynamicField: (key: string, value: unknown) => void;
  onUpdateSelectedBlock: (updater: (block: StoryBlock) => StoryBlock) => void;
  onSetConnection: (sourceId: string, sourceHandle: string, targetId: string | null) => void;
  onAssetInput: (fieldName: string) => (event: ChangeEvent<HTMLInputElement>) => void;
  renderAssetAttachment: (fieldName: string, assetId: string | null) => ReactNode;
  onRegisterAsset: (file: File) => string;
  onEnsureAssetPreviewSrc: (assetId: string) => Promise<string | null>;
  onStatusMessage: (message: string) => void;
}

function CinematicEditorSection({
  block,
  canEdit,
  blocks,
  project,
  assetPreviewSrcById,
  getAssetFileName,
  onSetSelectedDynamicField,
  onUpdateSelectedBlock,
  onSetConnection,
  onAssetInput,
  renderAssetAttachment,
  onRegisterAsset,
  onEnsureAssetPreviewSrc,
  onStatusMessage,
}: CinematicEditorSectionProps) {
  const layers = block.characterLayers ?? [];
  const narrations = block.narrations ?? [];
  const withLegacyCharacterAsset = useCallback((nextLayers: CharacterLayer[]) => {
    const legacyCharacterAssetId =
      nextLayers.find((layer) => layer.assetId)?.assetId ?? null;
    return {
      characterLayers: nextLayers,
      characterAssetId: legacyCharacterAssetId,
    };
  }, []);

  const withSyncedNarrations = useCallback((nextNarrations: CinematicNarration[]) => {
    const safeNarrations =
      nextNarrations.length > 0 ? nextNarrations : [createDefaultCinematicNarration()];
    const startNarration = safeNarrations[0];
    return {
      narrations: safeNarrations,
      startNarrationId: startNarration.id,
      heading: startNarration.heading,
      body: startNarration.body,
    };
  }, []);

  return (
    <div className="subsection">
      <div className="title-with-help">
        <h3>Bloc cinematique</h3>
        <HelpHint title="Bloc cinematique">
          Permet de raconter une scene avec plusieurs ecrans de narration en reutilisant la
          meme scene image/video/voix. Tu peux aussi composer une scene multi-personnages.
        </HelpHint>
      </div>
      <EditorGroup title="Contenu" icon="T">
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

      <div className="section-title-row">
        <div className="title-with-help">
          <h3>Narrations ({narrations.length})</h3>
          <HelpHint title="Narrations">
            Chaque narration correspond a un ecran de texte interne au bloc. Le bouton
            Continuer passe a la narration suivante puis au bloc externe.
          </HelpHint>
        </div>
        <button
          className="button-secondary"
          type="button"
          onClick={() =>
            onUpdateSelectedBlock((b) => {
              if (b.type !== "cinematic") return b;
              return {
                ...b,
                ...withSyncedNarrations([
                  ...(b.narrations ?? []),
                  createDefaultCinematicNarration(),
                ]),
              };
            })
          }
          disabled={!canEdit}
        >
          + narration
        </button>
      </div>
      {narrations.map((narration, narrationIndex) => (
        <div key={narration.id} className="choice-card" style={{ marginBottom: 12 }}>
          <div className="section-title-row" style={{ marginBottom: 8 }}>
            <strong>Narration {narrationIndex + 1}</strong>
            <div className="row-inline">
              <button
                className="button-secondary"
                type="button"
                onClick={() =>
                  onUpdateSelectedBlock((b) => {
                    if (b.type !== "cinematic") return b;
                    const insertAt = narrationIndex + 1;
                    const nextNarrations = [...(b.narrations ?? [])];
                    nextNarrations.splice(insertAt, 0, createDefaultCinematicNarration());
                    return {
                      ...b,
                      ...withSyncedNarrations(nextNarrations),
                    };
                  })
                }
                disabled={!canEdit}
              >
                + narration
              </button>
              <button
                className="button-danger"
                type="button"
                onClick={() =>
                  onUpdateSelectedBlock((b) => {
                    if (b.type !== "cinematic") return b;
                    return {
                      ...b,
                      ...withSyncedNarrations(
                        (b.narrations ?? []).filter((item) => item.id !== narration.id),
                      ),
                    };
                  })
                }
                disabled={!canEdit || narrations.length <= 1}
                title="Supprimer cette narration"
              >
                x
              </button>
            </div>
          </div>
          <PlayerTextInput
            label="Titre narration"
            value={narration.heading}
            onChange={(value) =>
              onUpdateSelectedBlock((b) => {
                if (b.type !== "cinematic") return b;
                return {
                  ...b,
                  ...withSyncedNarrations(
                    (b.narrations ?? []).map((item) =>
                      item.id === narration.id
                        ? { ...item, heading: value }
                        : item,
                    ),
                  ),
                };
              })
            }
            disabled={!canEdit}
          />
          <PlayerTextInput
            label="Texte / narration"
            value={narration.body}
            onChange={(value) =>
              onUpdateSelectedBlock((b) => {
                if (b.type !== "cinematic") return b;
                return {
                  ...b,
                  ...withSyncedNarrations(
                    (b.narrations ?? []).map((item) =>
                      item.id === narration.id
                        ? { ...item, body: value }
                        : item,
                    ),
                  ),
                };
              })
            }
            disabled={!canEdit}
            multiline
            rows={4}
          />
          <label>
            Buste pour cette narration
            <input
              type="file"
              accept="image/*"
              disabled={!canEdit}
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.currentTarget.value = "";
                if (!file) return;
                const assetId = onRegisterAsset(file);
                void onEnsureAssetPreviewSrc(assetId);
                onUpdateSelectedBlock((candidate) => {
                  if (candidate.type !== "cinematic") return candidate;
                  return {
                    ...candidate,
                    narrations: candidate.narrations.map((item) =>
                      item.id === narration.id ? { ...item, bustAssetId: assetId } : item,
                    ),
                  };
                });
              }}
            />
          </label>
          <small>
            {narration.bustAssetId ? getAssetFileName(narration.bustAssetId) : "Aucun fichier selectionne"}
          </small>
          {narration.bustAssetId && assetPreviewSrcById[narration.bustAssetId] && (
            <div
              className="bust-editor-preview"
              role="img"
              aria-label="Apercu du buste de cette narration"
              style={{ backgroundImage: `url("${assetPreviewSrcById[narration.bustAssetId]}")` }}
            />
          )}
          <div className="grid-two">
            <label>
              Cote du buste
              <select
                value={narration.bustSide ?? "default"}
                disabled={!canEdit}
                onChange={(event) => {
                  const nextSide = event.target.value === "default" ? null : event.target.value === "right" ? "right" : "left";
                  onUpdateSelectedBlock((candidate) => {
                    if (candidate.type !== "cinematic") return candidate;
                    return {
                      ...candidate,
                      narrations: candidate.narrations.map((item) =>
                        item.id === narration.id ? { ...item, bustSide: nextSide } : item,
                      ),
                    };
                  });
                }}
              >
                <option value="default">Par defaut (buste du bloc)</option>
                <option value="left">Gauche</option>
                <option value="right">Droite</option>
              </select>
            </label>
            <label>
              Largeur ({narration.bustWidth ?? block.bust?.width ?? 38}%)
              <input
                type="range"
                min={20}
                max={70}
                value={narration.bustWidth ?? block.bust?.width ?? 38}
                disabled={!canEdit}
                onChange={(event) => {
                  const nextWidth = Number(event.target.value);
                  onUpdateSelectedBlock((candidate) => {
                    if (candidate.type !== "cinematic") return candidate;
                    return {
                      ...candidate,
                      narrations: candidate.narrations.map((item) =>
                        item.id === narration.id ? { ...item, bustWidth: nextWidth } : item,
                      ),
                    };
                  });
                }}
              />
            </label>
          </div>
          <button
            className="button-secondary"
            disabled={!canEdit || !narration.bustAssetId}
            onClick={() =>
              onUpdateSelectedBlock((candidate) => {
                if (candidate.type !== "cinematic") return candidate;
                return {
                  ...candidate,
                  narrations: candidate.narrations.map((item) =>
                    item.id === narration.id ? { ...item, bustAssetId: null } : item,
                  ),
                };
              })
            }
          >
            Utiliser le buste par defaut
          </button>
        </div>
      ))}
      </EditorGroup>

      <EditorGroup title="Scene et medias" icon="◫" kind="scene">
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
      <AuthorStudioBustEditor
        bust={block.bust}
        canEdit={canEdit}
        assetPreviewSrcById={assetPreviewSrcById}
        getAssetFileName={getAssetFileName}
        onRegisterAsset={onRegisterAsset}
        onEnsureAssetPreviewSrc={onEnsureAssetPreviewSrc}
        onChange={(bust) =>
          onUpdateSelectedBlock((candidate) =>
            candidate.type === "cinematic" ? { ...candidate, bust } : candidate,
          )
        }
      />

      <CharacterLayersManager
        layers={layers}
        canEdit={canEdit}
        assetPreviewSrcById={assetPreviewSrcById}
        onRegisterAsset={onRegisterAsset}
        onEnsureAssetPreviewSrc={onEnsureAssetPreviewSrc}
        onStatusMessage={onStatusMessage}
        onAddLayer={(newLayer) =>
          onUpdateSelectedBlock((b) => {
            if (b.type !== "cinematic") return b;
            const nextLayers = [...(b.characterLayers ?? []), newLayer];
            return { ...b, ...withLegacyCharacterAsset(nextLayers) };
          })
        }
        onUpdateLayer={(layerIdx, patch) =>
          onUpdateSelectedBlock((b) => {
            if (b.type !== "cinematic") return b;
            const nextLayers = (b.characterLayers ?? []).map((l, i) =>
              i !== layerIdx ? l : { ...l, ...patch },
            );
            return { ...b, ...withLegacyCharacterAsset(nextLayers) };
          })
        }
        onRemoveLayer={(layerIdx) =>
          onUpdateSelectedBlock((b) => {
            if (b.type !== "cinematic") return b;
            const nextLayers = (b.characterLayers ?? []).filter((_, i) => i !== layerIdx);
            return { ...b, ...withLegacyCharacterAsset(nextLayers) };
          })
        }
      />

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
        const fallbackCharSrc = assetPreviewSrcById[block.characterAssetId ?? ""];
        const hasAnyAsset = block.backgroundAssetId || layerSrcs.length > 0 || block.characterAssetId;
        if (!hasAnyAsset) return null;
        return (
          <ExpandableSceneComposer
            format={project.info.format}
            layout={block.sceneLayout}
            bgSrc={bgSrc}
            characterLayers={layerSrcs}
            charSrc={fallbackCharSrc}
            bustConfig={block.bust}
            assetPreviewSrcById={assetPreviewSrcById}
            canEdit={canEdit}
            onChange={(newLayout) =>
              onUpdateSelectedBlock((b) =>
                b.type === "cinematic" ? { ...b, sceneLayout: newLayout } : b,
              )
            }
            onChangeCharacterLayout={(layerId, newLayerLayout) =>
              onUpdateSelectedBlock((b) => {
                if (b.type !== "cinematic") return b;
                const nextLayers = (b.characterLayers ?? []).map((l) =>
                  l.id !== layerId ? l : { ...l, layout: newLayerLayout },
                );
                return { ...b, ...withLegacyCharacterAsset(nextLayers) };
              })
            }
            side={
              <CharacterLayersManager
                layers={layers}
                canEdit={canEdit}
                assetPreviewSrcById={assetPreviewSrcById}
                onRegisterAsset={onRegisterAsset}
                onEnsureAssetPreviewSrc={onEnsureAssetPreviewSrc}
                onStatusMessage={onStatusMessage}
                onAddLayer={(newLayer) =>
                  onUpdateSelectedBlock((b) => {
                    if (b.type !== "cinematic") return b;
                    const nextLayers = [...(b.characterLayers ?? []), newLayer];
                    return { ...b, ...withLegacyCharacterAsset(nextLayers) };
                  })
                }
                onUpdateLayer={(layerIdx, patch) =>
                  onUpdateSelectedBlock((b) => {
                    if (b.type !== "cinematic") return b;
                    const nextLayers = (b.characterLayers ?? []).map((l, i) =>
                      i !== layerIdx ? l : { ...l, ...patch },
                    );
                    return { ...b, ...withLegacyCharacterAsset(nextLayers) };
                  })
                }
                onRemoveLayer={(layerIdx) =>
                  onUpdateSelectedBlock((b) => {
                    if (b.type !== "cinematic") return b;
                    const nextLayers = (b.characterLayers ?? []).filter((_, i) => i !== layerIdx);
                    return { ...b, ...withLegacyCharacterAsset(nextLayers) };
                  })
                }
              />
            }
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
      </EditorGroup>

      <EditorGroup title="Navigation" icon="→" kind="navigation">
      <NextBlockSelect
        selectedBlockId={block.id}
        nextBlockId={block.nextBlockId}
        blocks={blocks}
        canEdit={canEdit}
        onChange={(targetId) => onSetConnection(block.id, "next", targetId)}
      />
      </EditorGroup>
    </div>
  );
}

export function AuthorStudioBlockEditorPanel({
  selectedBlock,
  canEdit,
  project,
  blocks,
  chapterEndOptionsByChapterId,
  onDeleteSelectedBlock,
  onDuplicateSelectedBlock,
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
  getAssetFileName,
  onRegisterAsset,
  onEnsureAssetPreviewSrc,
  onStatusMessage,
  onSetChapterValidationFromEnd,
  onSetPartValidationFromEnd,
  onSetChapterStartPreviousLink,
}: AuthorStudioBlockEditorPanelProps) {
  return (
    <aside className="panel panel-right">
      <section className="panel-section inspector-panel-root">
        <div className="section-title-row inspector-panel-header">
          <div className="title-with-help">
            <h2>Proprietes bloc</h2>
            <HelpHint title="Edition du bloc">
              Zone centrale d&apos;edition du bloc selectionne dans le graphe: contenu, assets,
              branchements et effets.
            </HelpHint>
          </div>
          <div className="inspector-panel-actions">
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
          <div className="inspector-stack">
            <InspectorSection title="Identite du bloc" icon="◆">
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
              </div>
            </InspectorSection>

            <div className="inspector-block-editor">

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
                project={project}
                assetPreviewSrcById={assetPreviewSrcById}
                getAssetFileName={getAssetFileName}
                onSetSelectedDynamicField={onSetSelectedDynamicField}
                onUpdateSelectedBlock={onUpdateSelectedBlock}
                onSetConnection={onSetConnection}
                onAssetInput={onAssetInput}
                renderAssetAttachment={renderAssetAttachment}
                onRegisterAsset={onRegisterAsset}
                onEnsureAssetPreviewSrc={onEnsureAssetPreviewSrc}
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
                getAssetFileName={getAssetFileName}
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
                onUpdateSelectedBlock={onUpdateSelectedBlock}
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
                onRegisterAsset={onRegisterAsset}
                onEnsureAssetPreviewSrc={onEnsureAssetPreviewSrc}
                onStatusMessage={onStatusMessage}
                assetPreviewSrcById={assetPreviewSrcById}
                getAssetFileName={getAssetFileName}
              />
            )}

            {selectedBlock.type === "switch" && (
              <SwitchEditorSection
                block={selectedBlock}
                canEdit={canEdit}
                blocks={blocks}
                project={project}
                onUpdateSelectedBlock={onUpdateSelectedBlock}
                onSetConnection={onSetConnection}
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
                getAssetFileName={getAssetFileName}
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
                chapterEndOptionsByChapterId={chapterEndOptionsByChapterId}
                onSetSelectedDynamicField={onSetSelectedDynamicField}
                onSetConnection={onSetConnection}
                onSetChapterStartPreviousLink={onSetChapterStartPreviousLink}
              />
            )}

            {selectedBlock.type === "chapter_end" && (
              <ChapterEndEditorSection
                block={selectedBlock}
                canEdit={canEdit}
                blocks={blocks}
                project={project}
                onSetConnection={onSetConnection}
                onSetChapterValidationFromEnd={onSetChapterValidationFromEnd}
              />
            )}

            {selectedBlock.type === "part_start" && (
              <PartStartEditorSection
                block={selectedBlock}
                canEdit={canEdit}
                blocks={blocks}
                project={project}
                onSetSelectedDynamicField={onSetSelectedDynamicField}
                onSetConnection={onSetConnection}
              />
            )}

            {selectedBlock.type === "part_end" && (
              <PartEndEditorSection
                block={selectedBlock}
                canEdit={canEdit}
                blocks={blocks}
                project={project}
                onSetSelectedDynamicField={onSetSelectedDynamicField}
                onSetConnection={onSetConnection}
                onSetPartValidationFromEnd={onSetPartValidationFromEnd}
              />
            )}
            </div>
            <InspectorSection title="Effets d'entree" icon="✦" defaultOpen={false}>
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
            </InspectorSection>


          </div>
        )}
      </section>

    </aside>
  );
}




