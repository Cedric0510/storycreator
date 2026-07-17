import { ChangeEvent, ReactNode } from "react";

import {
  SWITCH_DEFAULT_HANDLE,
  normalizeDelta,
} from "@/components/author-studio-core";
import { HelpHint } from "@/components/HelpHint";
import { EditorGroup } from "@/components/EditorGroup";
import { NextBlockSelect } from "@/components/AuthorStudioNextBlockSelect";
import { PlayerTextInput } from "@/components/PlayerTextFormatting";
import {
  BLOCK_LABELS,
  ChoiceBlock,
  NpcProfileBlock,
  ProjectMeta,
  StoryBlock,
  SwitchCondition,
  SwitchConditionType,
  SwitchBlock,
  TitleBlock,
  createId,
  createDefaultSwitchCondition,
  syncSwitchCaseCompatibility,
} from "@/lib/story";

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

export function TitleEditorSection({
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
      <EditorGroup title="Contenu" icon="T">
      <PlayerTextInput
        label="Titre histoire"
        value={block.storyTitle}
        onChange={(value) => onSetSelectedDynamicField("storyTitle", value)}
        disabled={!canEdit}
      />
      <PlayerTextInput
        label="Sous titre"
        value={block.subtitle}
        onChange={(value) => onSetSelectedDynamicField("subtitle", value)}
        disabled={!canEdit}
      />
      </EditorGroup>
      <EditorGroup title="Scene et medias" icon="◫" kind="scene">
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
      </EditorGroup>

      <EditorGroup title="Apparence" icon="◈" kind="appearance">
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

interface SwitchEditorSectionProps {
  block: SwitchBlock;
  canEdit: boolean;
  blocks: StoryBlock[];
  project: ProjectMeta;
  onUpdateSelectedBlock: (updater: (block: StoryBlock) => StoryBlock) => void;
  onSetConnection: (sourceId: string, sourceHandle: string, targetId: string | null) => void;
}

export function SwitchEditorSection({
  block,
  canEdit,
  blocks,
  project,
  onUpdateSelectedBlock,
  onSetConnection,
}: SwitchEditorSectionProps) {
  const linkableBlocks = blocks.filter(
    (candidate) =>
      candidate.id !== block.id &&
      candidate.type !== "hero_profile" &&
      candidate.type !== "npc_profile",
  );
  const choiceBlocks = blocks.filter((candidate): candidate is ChoiceBlock => candidate.type === "choice");
  const npcBlocks = blocks.filter((candidate): candidate is NpcProfileBlock => candidate.type === "npc_profile");
  const choiceBlockById = new Map(choiceBlocks.map((choiceBlock) => [choiceBlock.id, choiceBlock]));
  const defaultConditionType: SwitchConditionType = project.variables[0]
    ? "variable"
    : npcBlocks[0]
      ? "affinity"
      : "choice";
  const buildDefaultCondition = (type: SwitchConditionType = defaultConditionType): SwitchCondition => {
    const condition = createDefaultSwitchCondition(type);
    if (type === "choice") {
      return {
        ...condition,
        choiceBlockId: choiceBlocks[0]?.id ?? null,
        choiceOptionId: choiceBlocks[0]?.choices[0]?.id ?? null,
      };
    }
    if (type === "variable") {
      return {
        ...condition,
        variableId: project.variables[0]?.id ?? null,
      };
    }
    return {
      ...condition,
      npcProfileBlockId: npcBlocks[0]?.id ?? null,
    };
  };
  const syncCase = (caseItem: SwitchBlock["cases"][number]) => syncSwitchCaseCompatibility(caseItem);

  return (
    <div className="subsection">
      <div className="title-with-help">
        <h3>Bloc switch</h3>
        <HelpHint title="Routage conditionnel">
          Redirige selon des cas ordonnes. Chaque cas peut combiner des choix memorises, des
          ressources et des affinites. Toutes les conditions d un meme cas sont en ET. Pour les
          ressources et affinites, la valeur saisie est un minimum a atteindre.
        </HelpHint>
      </div>

      <div className="section-title-row">
        <div className="title-with-help">
          <h3>Cas</h3>
          <HelpHint title="Cas switch">
            Les cas sont evalues de haut en bas. Le premier qui correspond est utilise.
          </HelpHint>
        </div>
        <button
          className="button-secondary"
          onClick={() =>
            onUpdateSelectedBlock((candidate) => {
              if (candidate.type !== "switch") return candidate;
              return {
                ...candidate,
                cases: [
                  ...candidate.cases,
                  syncCase({
                    id: createId("switch_case"),
                    logic: "and",
                    conditionType: "mixed",
                    expectedValue: 0,
                    conditions: [buildDefaultCondition()],
                    choiceConditions: [],
                    choiceBlockId: null,
                    choiceOptionId: null,
                    targetBlockId: null,
                  }),
                ],
              };
            })
          }
          disabled={!canEdit}
        >
          + cas
        </button>
      </div>

      {block.cases.length === 0 && (
        <small className="empty-placeholder">Ajoute au moins un cas.</small>
      )}

      {block.cases.map((item, index) => (
        <div key={item.id} className="choice-card">
          <div className="section-title-row">
            <strong>Cas {index + 1}</strong>
            <button
              className="button-danger"
              onClick={() => {
                onSetConnection(block.id, `switch-case-${item.id}`, null);
                onUpdateSelectedBlock((candidate) => {
                  if (candidate.type !== "switch") return candidate;
                  return {
                    ...candidate,
                    cases: candidate.cases.filter((candidateCase) => candidateCase.id !== item.id),
                  };
                });
              }}
              disabled={!canEdit}
            >
              x
            </button>
          </div>
          <label>
            Mode du cas
            <select
              value={item.logic}
              onChange={(event) =>
                onUpdateSelectedBlock((candidate) => {
                  if (candidate.type !== "switch") return candidate;
                  return {
                    ...candidate,
                    cases: candidate.cases.map((candidateCase) =>
                      candidateCase.id === item.id
                        ? syncCase({
                            ...candidateCase,
                            logic: event.target.value === "or" ? "or" : "and",
                          })
                        : candidateCase,
                    ),
                  };
                })
              }
              disabled={!canEdit}
            >
              <option value="and">Toutes les conditions (ET)</option>
              <option value="or">Au moins une condition (OU)</option>
            </select>
          </label>
          <div className="section-title-row">
            <div className="title-with-help">
              <span>Conditions</span>
              <HelpHint title="Conditions multiples">
                Choisis ET pour exiger toutes les conditions, ou OU pour exiger au moins une
                condition.
              </HelpHint>
            </div>
            <button
              className="button-secondary"
              onClick={() =>
                onUpdateSelectedBlock((candidate) => {
                  if (candidate.type !== "switch") return candidate;
                  return {
                    ...candidate,
                    cases: candidate.cases.map((candidateCase) =>
                      candidateCase.id === item.id
                        ? syncCase({
                            ...candidateCase,
                            conditions: [...candidateCase.conditions, buildDefaultCondition()],
                          })
                        : candidateCase,
                    ),
                  };
                })
              }
              disabled={!canEdit}
            >
              + condition
            </button>
          </div>

          {item.conditions.length === 0 && (
            <small className="empty-placeholder">
              Ajoute au moins une condition.
            </small>
          )}

          {item.conditions.map((condition, conditionIndex) => {
            const sourceChoices = condition.choiceBlockId
              ? choiceBlockById.get(condition.choiceBlockId)?.choices ?? []
              : [];

            return (
              <div key={condition.id} className="effect-row">
                <select
                  value={condition.type}
                  onChange={(event) =>
                    onUpdateSelectedBlock((candidate) => {
                      if (candidate.type !== "switch") return candidate;
                      return {
                        ...candidate,
                        cases: candidate.cases.map((candidateCase) => {
                          if (candidateCase.id !== item.id) return candidateCase;
                          return syncCase({
                            ...candidateCase,
                            conditions: candidateCase.conditions.map((candidateCondition) =>
                              candidateCondition.id === condition.id
                                ? { ...buildDefaultCondition(event.target.value as SwitchConditionType), id: condition.id }
                                : candidateCondition,
                            ),
                          });
                        }),
                      };
                    })
                  }
                  disabled={!canEdit}
                  title={`Condition ${conditionIndex + 1} - type`}
                >
                  <option value="choice">Choix memorise</option>
                  <option value="variable">Ressource</option>
                  <option value="affinity">Affinite</option>
                </select>

                {condition.type === "choice" ? (
                  <>
                    <select
                      value={condition.choiceBlockId ?? ""}
                      onChange={(event) =>
                        onUpdateSelectedBlock((candidate) => {
                          if (candidate.type !== "switch") return candidate;
                          return {
                            ...candidate,
                            cases: candidate.cases.map((candidateCase) => {
                              if (candidateCase.id !== item.id) return candidateCase;
                              return syncCase({
                                ...candidateCase,
                                conditions: candidateCase.conditions.map((candidateCondition) => {
                                  if (candidateCondition.id !== condition.id) return candidateCondition;
                                  const nextChoiceBlockId = event.target.value || null;
                                  const nextChoiceBlock = nextChoiceBlockId
                                    ? choiceBlockById.get(nextChoiceBlockId) ?? null
                                    : null;
                                  return {
                                    ...candidateCondition,
                                    choiceBlockId: nextChoiceBlockId,
                                    choiceOptionId: nextChoiceBlock?.choices[0]?.id ?? null,
                                  };
                                }),
                              });
                            }),
                          };
                        })
                      }
                      disabled={!canEdit}
                      title={`Condition ${conditionIndex + 1} - bloc`}
                    >
                      <option value="">Aucun bloc choix</option>
                      {choiceBlocks.map((choiceBlock) => (
                        <option key={choiceBlock.id} value={choiceBlock.id}>
                          {choiceBlock.name || "Choix"} ({choiceBlock.id.slice(-4)})
                        </option>
                      ))}
                    </select>
                    <select
                      value={condition.choiceOptionId ?? ""}
                      onChange={(event) =>
                        onUpdateSelectedBlock((candidate) => {
                          if (candidate.type !== "switch") return candidate;
                          return {
                            ...candidate,
                            cases: candidate.cases.map((candidateCase) => {
                              if (candidateCase.id !== item.id) return candidateCase;
                              return syncCase({
                                ...candidateCase,
                                conditions: candidateCase.conditions.map((candidateCondition) =>
                                  candidateCondition.id === condition.id
                                    ? { ...candidateCondition, choiceOptionId: event.target.value || null }
                                    : candidateCondition,
                                ),
                              });
                            }),
                          };
                        })
                      }
                      disabled={!canEdit}
                      title={`Condition ${conditionIndex + 1} - option`}
                    >
                      <option value="">Aucune option</option>
                      {sourceChoices.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.label} - {option.text || "Sans texte"}
                        </option>
                      ))}
                    </select>
                  </>
                ) : (
                  <>
                    <select
                      value={
                        condition.type === "variable"
                          ? condition.variableId ?? ""
                          : condition.npcProfileBlockId ?? ""
                      }
                      onChange={(event) =>
                        onUpdateSelectedBlock((candidate) => {
                          if (candidate.type !== "switch") return candidate;
                          return {
                            ...candidate,
                            cases: candidate.cases.map((candidateCase) => {
                              if (candidateCase.id !== item.id) return candidateCase;
                              return syncCase({
                                ...candidateCase,
                                conditions: candidateCase.conditions.map((candidateCondition) => {
                                  if (candidateCondition.id !== condition.id) return candidateCondition;
                                  return condition.type === "variable"
                                    ? { ...candidateCondition, variableId: event.target.value || null }
                                    : { ...candidateCondition, npcProfileBlockId: event.target.value || null };
                                }),
                              });
                            }),
                          };
                        })
                      }
                      disabled={!canEdit}
                      title={`Condition ${conditionIndex + 1} - source`}
                    >
                      <option value="">
                        {condition.type === "variable" ? "Aucune ressource" : "Aucun personnage"}
                      </option>
                      {condition.type === "variable"
                        ? project.variables.map((variable) => (
                            <option key={variable.id} value={variable.id}>
                              {variable.name}
                            </option>
                          ))
                        : npcBlocks.map((npcBlock) => (
                            <option key={npcBlock.id} value={npcBlock.id}>
                              {npcBlock.npcName || npcBlock.name || "PNJ"}
                            </option>
                          ))}
                    </select>
                    <span className="help-text" title="Seuil minimal">Mini</span>
                    <input
                      type="number"
                      value={condition.expectedValue}
                      onChange={(event) =>
                        onUpdateSelectedBlock((candidate) => {
                          if (candidate.type !== "switch") return candidate;
                          return {
                            ...candidate,
                            cases: candidate.cases.map((candidateCase) => {
                              if (candidateCase.id !== item.id) return candidateCase;
                              return syncCase({
                                ...candidateCase,
                                conditions: candidateCase.conditions.map((candidateCondition) =>
                                  candidateCondition.id === condition.id
                                    ? {
                                        ...candidateCondition,
                                        expectedValue: normalizeDelta(event.target.value),
                                      }
                                    : candidateCondition,
                                ),
                              });
                            }),
                          };
                        })
                      }
                      disabled={!canEdit}
                      title={`Condition ${conditionIndex + 1} - seuil minimal`}
                    />
                  </>
                )}
                <button
                  className="button-danger"
                  onClick={() =>
                    onUpdateSelectedBlock((candidate) => {
                      if (candidate.type !== "switch") return candidate;
                      return {
                        ...candidate,
                        cases: candidate.cases.map((candidateCase) => {
                          if (candidateCase.id !== item.id) return candidateCase;
                          return syncCase({
                            ...candidateCase,
                            conditions: candidateCase.conditions.filter(
                              (candidateCondition) => candidateCondition.id !== condition.id,
                            ),
                          });
                        }),
                      };
                    })
                  }
                  disabled={!canEdit}
                  title="Supprimer cette condition"
                >
                  x
                </button>
              </div>
            );
          })}

          {choiceBlocks.length === 0 && item.conditions.some((condition) => condition.type === "choice") && (
            <small className="empty-placeholder">
              Aucun bloc choix dans l histoire. Ajoute un bloc choix pour utiliser cette condition.
            </small>
          )}
          {project.variables.length === 0 && item.conditions.some((condition) => condition.type === "variable") && (
            <small className="empty-placeholder">
              Aucune ressource n est definie dans le projet.
            </small>
          )}
          {npcBlocks.length === 0 && item.conditions.some((condition) => condition.type === "affinity") && (
            <small className="empty-placeholder">
              Aucune fiche PNJ n est definie dans l histoire.
            </small>
          )}
          <label>
            Cible bloc
            <select
              value={item.targetBlockId ?? ""}
              onChange={(event) =>
                onSetConnection(block.id, `switch-case-${item.id}`, event.target.value || null)
              }
              disabled={!canEdit}
            >
              <option value="">Aucune cible</option>
              {linkableBlocks.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {candidate.name} ({BLOCK_LABELS[candidate.type]})
                </option>
              ))}
            </select>
          </label>
        </div>
      ))}

      <label>
        Sortie Sinon
        <select
          value={block.nextBlockId ?? ""}
          onChange={(event) =>
            onSetConnection(block.id, SWITCH_DEFAULT_HANDLE, event.target.value || null)
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
  );
}
