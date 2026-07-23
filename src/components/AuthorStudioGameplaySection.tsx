import {
  ChangeEvent,
  MouseEvent,
  PointerEvent as ReactPointerEvent,
  ReactNode,
  useMemo,
} from "react";

import {
  GAMEPLAY_BUTTON_SEQUENCE_FAILURE_HANDLE,
  GAMEPLAY_BUTTON_SEQUENCE_SUCCESS_HANDLE,
  normalizeDelta,
} from "@/components/author-studio-core";
import { GameplayPlacementTarget } from "@/components/author-studio-types";
import { HelpHint } from "@/components/HelpHint";
import { EditorGroup } from "@/components/EditorGroup";
import { AuthorStudioBustEditor } from "@/components/AuthorStudioBustEditor";
import {
  SceneComposer,
  SceneCopyPaste,
} from "@/components/AuthorStudioSceneComposer";
import {
  BLOCK_LABELS,
  GameplayBlock,
  GameplayLockInputMode,
  GameplayObject,
  GameplayObjectType,
  GameplayUnlockEffect,
  MAX_GAMEPLAY_BUTTONS,
  ProjectMeta,
  StoryBlock,
} from "@/lib/story";

type EffectField = "variableId" | "delta";
export interface GameplayEditorSectionProps {
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

export function GameplayEditorSection({
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

      <EditorGroup title="Contenu" icon="T">
      <label>
        Objectif
        <textarea
          rows={3}
          value={block.objective}
          onChange={(event) => onSetSelectedDynamicField("objective", event.target.value)}
          disabled={!canEdit}
        />
      </label>
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
        <input type="file" accept="image/*" onChange={onAssetInput("backgroundAssetId")} disabled={!canEdit} />
      </label>
      {renderAssetAttachment("backgroundAssetId", block.backgroundAssetId)}
      <AuthorStudioBustEditor
        bust={block.bust}
        canEdit={canEdit}
        assetPreviewSrcById={assetPreviewSrcById}
        onRegisterAsset={onRegisterAsset}
        onEnsureAssetPreviewSrc={onEnsureAssetPreviewSrc}
        onChange={(bust) =>
          onUpdateSelectedBlock((candidate) =>
            candidate.type === "gameplay" ? { ...candidate, bust } : candidate,
          )
        }
      />

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
        bust={{
          src: assetPreviewSrcById[block.bust?.assetId ?? ""],
          side: block.bust?.side ?? "left",
          width: block.bust?.width ?? 38,
        }}
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

      <label>
        Audio ambiance
        <input type="file" accept="audio/*" onChange={onAssetInput("voiceAssetId")} disabled={!canEdit} />
      </label>
      {renderAssetAttachment("voiceAssetId", block.voiceAssetId)}
      </EditorGroup>

      <EditorGroup title="Objets et interactions" icon="◇" kind="logic">
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
      </EditorGroup>
    </div>
  );
}


