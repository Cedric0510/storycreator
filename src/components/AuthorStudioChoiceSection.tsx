import { ChangeEvent, ReactNode } from "react";

import { HelpHint } from "@/components/HelpHint";
import { SceneComposer } from "@/components/AuthorStudioSceneComposer";
import {
  BLOCK_LABELS,
  CharacterLayer,
  ChoiceBlock,
  DEFAULT_CHARACTER_LAYOUT,
  ProjectMeta,
  StoryBlock,
  createId,
} from "@/lib/story";

type ChoiceField = "text" | "targetBlockId" | "heroMemoryVariableId" | "heroMemoryValue";
type EffectField = "variableId" | "delta";
export interface ChoiceEditorSectionProps {
  block: ChoiceBlock;
  canEdit: boolean;
  blocks: StoryBlock[];
  project: ProjectMeta;
  onSetSelectedDynamicField: (key: string, value: unknown) => void;
  onUpdateSelectedBlock: (updater: (block: StoryBlock) => StoryBlock) => void;
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
  onRegisterAsset: (file: File) => string;
  onEnsureAssetPreviewSrc: (assetId: string) => Promise<string | null>;
  onStatusMessage: (message: string) => void;
  assetPreviewSrcById: Record<string, string>;
}

export function ChoiceEditorSection({
  block,
  canEdit,
  blocks,
  project,
  onSetSelectedDynamicField,
  onUpdateSelectedBlock,
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
  onRegisterAsset,
  onEnsureAssetPreviewSrc,
  onStatusMessage,
  assetPreviewSrcById,
}: ChoiceEditorSectionProps) {
  const choiceVisualSceneLayers = block.choices
    .map((option) => ({
      key: option.id,
      label: `Option ${option.label}`,
      src: assetPreviewSrcById[option.imageAssetId ?? ""],
      zIndex: option.zIndex,
      layout: option.layout,
    }))
    .filter((layer) => layer.src);
  const isTextChoiceMode = block.displayMode === "text";
  const choiceTextLayers = block.characterLayers ?? [];
  const choiceTextSceneLayers = choiceTextLayers
    .map((layer, idx) => ({
      key: layer.id,
      label: layer.label || `Perso ${idx + 1}`,
      src: assetPreviewSrcById[layer.assetId ?? ""],
      zIndex: layer.zIndex,
      layout: layer.layout,
    }))
    .filter((layer) => layer.src);
  const currentSceneLayers = isTextChoiceMode ? choiceTextSceneLayers : choiceVisualSceneLayers;
  const hasSceneAssets = Boolean(block.backgroundAssetId) || currentSceneLayers.length > 0;

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
        Type de choix
        <select
          value={block.displayMode}
          onChange={(event) =>
            onSetSelectedDynamicField(
              "displayMode",
              event.target.value === "text" ? "text" : "visual",
            )
          }
          disabled={!canEdit}
        >
          <option value="text">Texte (type dialogue)</option>
          <option value="visual">Visuel (images cliquables)</option>
        </select>
      </label>
      <small className="empty-placeholder">
        Le choix du joueur est memorise automatiquement pour toute la partie.
      </small>
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
          <h3>{isTextChoiceMode ? "Composition de scene" : "Scene interactive"}</h3>
          <HelpHint title={isTextChoiceMode ? "Scene narrative (mode texte)" : "Scene de choix"}>
            {isTextChoiceMode
              ? "Meme editeur que Dialogue: les PNJ sont decoratifs et les choix restent des boutons texte."
              : "Positionne et redimensionne les images de choix. Chaque image devient un bouton cliquable en preview."}
          </HelpHint>
        </div>
      </div>

      {isTextChoiceMode && (
        <>
          <div className="section-title-row">
            <div className="title-with-help">
              <h3>Personnages ({choiceTextLayers.length}/5)</h3>
              <HelpHint title="Personnages">
                Ajoute jusqu&apos;a 5 personnages independants des options de choix.
              </HelpHint>
            </div>
            {choiceTextLayers.length < 5 && (
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
                      label: `Perso ${choiceTextLayers.length + 1}`,
                      zIndex: Math.min(choiceTextLayers.length + 1, 5),
                      layout: { ...DEFAULT_CHARACTER_LAYOUT },
                    };
                    onUpdateSelectedBlock((candidate) =>
                      candidate.type === "choice"
                        ? { ...candidate, characterLayers: [...(candidate.characterLayers ?? []), newLayer] }
                        : candidate,
                    );
                    onStatusMessage(`Personnage ajoute: ${file.name}`);
                    event.target.value = "";
                  }}
                  disabled={!canEdit}
                />
              </label>
            )}
          </div>
          {choiceTextLayers.length === 0 && (
            <small className="empty-placeholder">
              Aucun personnage. Clique &quot;+ personnage&quot; pour en ajouter.
            </small>
          )}
          {choiceTextLayers.map((layer, layerIdx) => (
            <div key={layer.id} className="choice-card" style={{ padding: "6px 8px" }}>
              <div className="effect-row" style={{ gridTemplateColumns: "1fr 80px 28px", alignItems: "center" }}>
                <input
                  type="text"
                  value={layer.label}
                  placeholder="Nom"
                  onChange={(event) =>
                    onUpdateSelectedBlock((candidate) => {
                      if (candidate.type !== "choice") return candidate;
                      return {
                        ...candidate,
                        characterLayers: (candidate.characterLayers ?? []).map((currentLayer, idx) =>
                          idx !== layerIdx ? currentLayer : { ...currentLayer, label: event.target.value },
                        ),
                      };
                    })
                  }
                  disabled={!canEdit}
                />
                <select
                  value={layer.zIndex}
                  onChange={(event) =>
                    onUpdateSelectedBlock((candidate) => {
                      if (candidate.type !== "choice") return candidate;
                      return {
                        ...candidate,
                        characterLayers: (candidate.characterLayers ?? []).map((currentLayer, idx) =>
                          idx !== layerIdx ? currentLayer : { ...currentLayer, zIndex: Number(event.target.value) },
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
                    onUpdateSelectedBlock((candidate) => {
                      if (candidate.type !== "choice") return candidate;
                      return {
                        ...candidate,
                        characterLayers: (candidate.characterLayers ?? []).filter((_, idx) => idx !== layerIdx),
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
                      onUpdateSelectedBlock((candidate) => {
                        if (candidate.type !== "choice") return candidate;
                        return {
                          ...candidate,
                          characterLayers: (candidate.characterLayers ?? []).map((currentLayer, idx) =>
                            idx !== layerIdx ? currentLayer : { ...currentLayer, assetId },
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
        </>
      )}

      {!hasSceneAssets ? (
        <small className="empty-placeholder">
          Ajoute un fond ou un personnage pour activer la composition de scene.
        </small>
      ) : (
        <SceneComposer
          layout={block.sceneLayout}
          bgSrc={assetPreviewSrcById[block.backgroundAssetId ?? ""]}
          characterLayers={currentSceneLayers}
          canEdit={canEdit}
          onChange={(nextSceneLayout) =>
            onUpdateSelectedBlock((candidate) =>
              candidate.type === "choice"
                ? { ...candidate, sceneLayout: nextSceneLayout }
                : candidate,
            )
          }
          onChangeCharacterLayout={(layerId, layout) =>
            onUpdateSelectedBlock((candidate) => {
              if (candidate.type !== "choice") return candidate;
              if (isTextChoiceMode) {
                return {
                  ...candidate,
                  characterLayers: (candidate.characterLayers ?? []).map((layer) =>
                    layer.id !== layerId ? layer : { ...layer, layout },
                  ),
                };
              }
              return {
                ...candidate,
                choices: candidate.choices.map((candidateOption) =>
                  candidateOption.id === layerId
                    ? { ...candidateOption, layout }
                    : candidateOption,
                ),
              };
            })
          }
        />
      )}

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
            // eslint-disable-next-line @next/next/no-img-element -- local asset preview uses dynamic blob URLs.
            <img
              src={assetPreviewSrcById[option.imageAssetId]}
              alt={`Option ${option.label}`}
              className="choice-option-inline-preview"
            />
          )}
          <label>
            Plan (cran)
            <select
              value={option.zIndex}
              onChange={(event) =>
                onUpdateSelectedBlock((candidate) => {
                  if (candidate.type !== "choice") return candidate;
                  return {
                    ...candidate,
                    choices: candidate.choices.map((candidateOption) =>
                      candidateOption.id === option.id
                        ? {
                            ...candidateOption,
                            zIndex: Math.min(5, Math.max(1, Number(event.target.value) || 1)),
                          }
                        : candidateOption,
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
          </label>
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
                <span>Memoire hero</span>
                <HelpHint title="Memoire de choix">
                  Optionnel: enregistre une valeur de choix dans une variable &quot;choix_*&quot;.
                </HelpHint>
              </div>
            </div>
            <label>
              Variable memoire
              <select
                value={option.heroMemoryVariableId ?? ""}
                onChange={(event) =>
                  onUpdateChoiceField(option.id, "heroMemoryVariableId", event.target.value)
                }
                disabled={!canEdit}
              >
                <option value="">Aucune</option>
                {project.variables
                  .filter((variable) =>
                    variable.name.trim().toLowerCase().startsWith("choix_"),
                  )
                  .map((variable) => (
                    <option key={variable.id} value={variable.id}>
                      {variable.name}
                    </option>
                  ))}
              </select>
            </label>
            {option.heroMemoryVariableId && (
              <label>
                Valeur memoire
                <input
                  type="number"
                  value={option.heroMemoryValue}
                  onChange={(event) =>
                    onUpdateChoiceField(option.id, "heroMemoryValue", event.target.value)
                  }
                  disabled={!canEdit}
                />
              </label>
            )}
          </div>

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


