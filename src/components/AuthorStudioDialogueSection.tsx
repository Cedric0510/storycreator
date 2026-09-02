import { ChangeEvent, ReactNode } from "react";

import { HelpHint } from "@/components/HelpHint";
import { EditorGroup } from "@/components/EditorGroup";
import { PlayerTextInput } from "@/components/PlayerTextFormatting";
import { AuthorStudioBustEditor } from "@/components/AuthorStudioBustEditor";
import {
  CharacterLayersManager,
  ExpandableSceneComposer,
  SceneCopyPaste,
} from "@/components/AuthorStudioSceneComposer";
import {
  BLOCK_LABELS,
  DialogueBlock,
  NpcProfileBlock,
  ProjectMeta,
  StoryBlock,
} from "@/lib/story";

type EffectField = "variableId" | "delta";
type ResponseField = "text" | "targetLineId" | "targetBlockId";
export interface DialogueEditorSectionProps {
  block: DialogueBlock;
  canEdit: boolean;
  blocks: StoryBlock[];
  project: ProjectMeta;
  assetPreviewSrcById: Record<string, string>;
  getAssetFileName: (assetId: string | null) => string;
  onSetSelectedDynamicField: (key: string, value: unknown) => void;
  onUpdateSelectedBlock: (updater: (block: StoryBlock) => StoryBlock) => void;
  onAssetInput: (fieldName: string) => (event: ChangeEvent<HTMLInputElement>) => void;
  renderAssetAttachment: (fieldName: string, assetId: string | null) => ReactNode;
  onUnlinkDialogueNpcProfile: (dialogueBlockId: string) => void;
  onAddDialogueLine: (afterLineId?: string) => void;
  onRemoveDialogueLine: (lineId: string) => void;
  onUpdateDialogueLineField: (lineId: string, field: string, value: string | number | null) => void;
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

export function DialogueEditorSection({
  block,
  canEdit,
  blocks,
  project,
  assetPreviewSrcById,
  getAssetFileName,
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

      <EditorGroup title="Scene et medias" icon="◫" kind="scene">
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
      <AuthorStudioBustEditor
        bust={block.bust}
        canEdit={canEdit}
        assetPreviewSrcById={assetPreviewSrcById}
        getAssetFileName={getAssetFileName}
        onRegisterAsset={onRegisterAsset}
        onEnsureAssetPreviewSrc={onEnsureAssetPreviewSrc}
        onChange={(bust) =>
          onUpdateSelectedBlock((candidate) =>
            candidate.type === "dialogue" ? { ...candidate, bust } : candidate,
          )
        }
      />

      {/* --- Character layers (multi-character with z-index) --- */}
      <CharacterLayersManager
        layers={layers}
        canEdit={canEdit}
        assetPreviewSrcById={assetPreviewSrcById}
        onRegisterAsset={onRegisterAsset}
        onEnsureAssetPreviewSrc={onEnsureAssetPreviewSrc}
        onStatusMessage={onStatusMessage}
        onAddLayer={(newLayer) =>
          onUpdateSelectedBlock((b) =>
            b.type === "dialogue"
              ? { ...b, characterLayers: [...(b.characterLayers ?? []), newLayer] }
              : b,
          )
        }
        onUpdateLayer={(layerIdx, patch) =>
          onUpdateSelectedBlock((b) => {
            if (b.type !== "dialogue") return b;
            return {
              ...b,
              characterLayers: (b.characterLayers ?? []).map((l, i) =>
                i !== layerIdx ? l : { ...l, ...patch },
              ),
            };
          })
        }
        onRemoveLayer={(layerIdx) =>
          onUpdateSelectedBlock((b) => {
            if (b.type !== "dialogue") return b;
            return {
              ...b,
              characterLayers: (b.characterLayers ?? []).filter((_, i) => i !== layerIdx),
            };
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
        const hasAnyAsset = block.backgroundAssetId || layerSrcs.length > 0;
        if (!hasAnyAsset) return null;
        return (
          <ExpandableSceneComposer
            format={project.info.format}
            layout={block.sceneLayout}
            bgSrc={bgSrc}
            characterLayers={layerSrcs}
            bustConfig={block.bust}
            assetPreviewSrcById={assetPreviewSrcById}
            canEdit={canEdit}
            onChange={(newLayout) =>
              onUpdateSelectedBlock((b) =>
                b.type === "dialogue" ? { ...b, sceneLayout: newLayout } : b,
              )
            }
            onChangeCharacterLayout={(layerId, newLayerLayout) =>
              onUpdateSelectedBlock((b) => {
                if (b.type !== "dialogue") return b;
                return {
                  ...b,
                  characterLayers: (b.characterLayers ?? []).map((l) =>
                    l.id !== layerId ? l : { ...l, layout: newLayerLayout },
                  ),
                };
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
                  onUpdateSelectedBlock((b) =>
                    b.type === "dialogue"
                      ? { ...b, characterLayers: [...(b.characterLayers ?? []), newLayer] }
                      : b,
                  )
                }
                onUpdateLayer={(layerIdx, patch) =>
                  onUpdateSelectedBlock((b) => {
                    if (b.type !== "dialogue") return b;
                    return {
                      ...b,
                      characterLayers: (b.characterLayers ?? []).map((l, i) =>
                        i !== layerIdx ? l : { ...l, ...patch },
                      ),
                    };
                  })
                }
                onRemoveLayer={(layerIdx) =>
                  onUpdateSelectedBlock((b) => {
                    if (b.type !== "dialogue") return b;
                    return {
                      ...b,
                      characterLayers: (b.characterLayers ?? []).filter((_, i) => i !== layerIdx),
                    };
                  })
                }
              />
            }
          />
        );
      })()}

      </EditorGroup>

      <EditorGroup title="Dialogues et interactions" icon="T" kind="logic">
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
              Ligne {index + 1} - {line.speaker || "..."}
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
      </div>

      {block.lines.map((line, lineIndex) => (
        <div key={line.id} className="choice-card">
          <div className="section-title-row">
            <strong>Ligne {lineIndex + 1}</strong>
            <div className="row-inline">
              <button
                className="button-secondary"
                onClick={() => onAddDialogueLine(line.id)}
                disabled={!canEdit}
                title="Ajouter une nouvelle ligne apres celle-ci"
              >
                + ligne
              </button>
              <button
                className="button-danger"
                onClick={() => onRemoveDialogueLine(line.id)}
                disabled={!canEdit || block.lines.length <= 1}
                title="Supprimer cette ligne"
              >
                x
              </button>
            </div>
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
                          Ligne {globalIndex + 1} - {candidate.speaker || "..."}
                        </option>
                      );
                    })}
                </select>
              </label>
            )}
          </div>

          <PlayerTextInput
            label="Personnage"
            value={
              linkedNpcBlock?.npcName.trim()
                ? linkedNpcBlock.npcName
                : line.speaker
            }
            onChange={(value) => onUpdateDialogueLineField(line.id, "speaker", value)}
            disabled={!canEdit || Boolean(linkedNpcBlock)}
            list={`npc-names-${line.id}`}
          >
            <datalist id={`npc-names-${line.id}`}>
              {blocks
                .filter((b): b is NpcProfileBlock => b.type === "npc_profile" && b.npcName.trim() !== "")
                .map((npc) => (
                  <option key={npc.id} value={npc.npcName} />
                ))}
            </datalist>
          </PlayerTextInput>
          <PlayerTextInput
            label="Replique"
            value={line.text}
            onChange={(value) => onUpdateDialogueLineField(line.id, "text", value)}
            disabled={!canEdit}
            multiline
            rows={3}
          />
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
          <label>
            Buste pour cette replique
            <input
              type="file"
              accept="image/*"
              disabled={!canEdit}
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.currentTarget.value = "";
                if (!file) return;
                const assetId = onRegisterAsset(file);
                onUpdateDialogueLineField(line.id, "bustAssetId", assetId);
                void onEnsureAssetPreviewSrc(assetId);
              }}
            />
          </label>
          <small>
            {line.bustAssetId ? getAssetFileName(line.bustAssetId) : "Aucun fichier selectionne"}
          </small>
          {line.bustAssetId && assetPreviewSrcById[line.bustAssetId] && (
            <div
              className="bust-editor-preview"
              role="img"
              aria-label="Apercu du buste de cette replique"
              style={{ backgroundImage: `url("${assetPreviewSrcById[line.bustAssetId]}")` }}
            />
          )}
          <div className="grid-two">
            <label>
              Cote du buste
              <select
                value={line.bustSide ?? "default"}
                disabled={!canEdit}
                onChange={(event) =>
                  onUpdateDialogueLineField(
                    line.id,
                    "bustSide",
                    event.target.value === "default" ? null : event.target.value,
                  )
                }
              >
                <option value="default">Par defaut (buste du bloc)</option>
                <option value="left">Gauche</option>
                <option value="right">Droite</option>
              </select>
            </label>
            <label>
              Largeur ({line.bustWidth ?? block.bust?.width ?? 38}%)
              <input
                type="range"
                min={20}
                max={70}
                value={line.bustWidth ?? block.bust?.width ?? 38}
                disabled={!canEdit}
                onChange={(event) =>
                  onUpdateDialogueLineField(line.id, "bustWidth", Number(event.target.value))
                }
              />
            </label>
          </div>
          <button
            className="button-secondary"
            disabled={!canEdit || !line.bustAssetId}
            onClick={() => onUpdateDialogueLineField(line.id, "bustAssetId", null)}
          >
            Utiliser le buste par defaut
          </button>

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
          {line.responses.length === 0 && (
            <small className="empty-placeholder">
              Aucune reponse: la preview affichera un bouton Continuer.
              Utilise la sortie &quot;Continuer vers sortie&quot; sur le whiteboard pour le relier a un autre bloc.
            </small>
          )}

          {line.responses.map((resp) => (
            <div key={resp.id} className="choice-card" style={{ marginLeft: 12 }}>
              <div className="section-title-row">
                <strong>Reponse {resp.label}</strong>
                <button
                  className="button-danger"
                  onClick={() => onRemoveDialogueLineResponse(line.id, resp.id)}
                  disabled={!canEdit}
                  title="Supprimer cette reponse"
                >
                  x
                </button>
              </div>
              <PlayerTextInput
                label="Texte"
                value={resp.text}
                onChange={(value) =>
                  onUpdateDialogueResponseField(line.id, resp.id, "text", value)
                }
                disabled={!canEdit}
              />

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
                          Ligne {globalIndex + 1} - {candidate.speaker || "..."}
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
      </EditorGroup>
    </div>
  );
}


