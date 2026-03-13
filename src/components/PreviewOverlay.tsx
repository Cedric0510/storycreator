"use client";

import { PointerEvent as ReactPointerEvent, useCallback, useRef, useState } from "react";

import { PreviewRuntimeState } from "@/components/usePreviewRuntime";
import { GameplayBlock, StoryBlock } from "@/lib/story";

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

export interface PreviewOverlayProps {
  previewState: PreviewRuntimeState | null;
  previewBlock: StoryBlock | null;
  previewInteractedSet: Set<string>;
  previewGameplayCompleted: boolean;
  previewGameplayProgressLabel: string;
  previewInventoryItems: { id: string; name: string; iconAssetId: string | null; quantity: number }[];
  equippedInventoryItemId: string | null;
  projectVariables: { id: string; name: string }[];
  assetPreviewSrcById: Record<string, string>;
  blockById: Map<string, StoryBlock>;
  onRestart: () => void;
  onClose: () => void;
  onContinue: () => void;
  onPickChoice: (choiceId: string) => void;
  onPickObject: (objectId: string) => void;
  onDropKeyOnLock: (keyId: string, lockId: string) => void;
  onDropInventoryItemOnLock: (itemId: string, lockId: string) => void;
  onEquipInventoryItem: (itemId: string | null) => void;
}

/* ------------------------------------------------------------------ */
/*  GameplayPreviewScene — handles key drag-and-drop on locks          */
/* ------------------------------------------------------------------ */

interface GameplayPreviewSceneProps {
  block: GameplayBlock;
  previewState: PreviewRuntimeState | null;
  previewInteractedSet: Set<string>;
  assetPreviewSrcById: Record<string, string>;
  bgSrc: string | undefined;
  equippedInventoryItem: { id: string; name: string; iconSrc: string | undefined } | null;
  onPickObject: (objectId: string) => void;
  onDropKeyOnLock: (keyId: string, lockId: string) => void;
  onDropInventoryItemOnLock: (itemId: string, lockId: string) => void;
}

function GameplayPreviewScene({
  block,
  previewState,
  previewInteractedSet,
  assetPreviewSrcById,
  bgSrc,
  equippedInventoryItem,
  onPickObject,
  onDropKeyOnLock,
  onDropInventoryItemOnLock,
}: GameplayPreviewSceneProps) {
  const sceneRef = useRef<HTMLDivElement>(null);
  const [dragObject, setDragObject] = useState<{
    kind: "key" | "inventory_item";
    objectId: string;
    pointerId: number;
    startX: number;
    startY: number;
    dx: number;
    dy: number;
  } | null>(null);

  const handleKeyPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLButtonElement>, objectId: string) => {
      const obj = block.objects.find((o) => o.id === objectId);
      if (!obj || obj.objectType !== "key") return;
      e.preventDefault();
      e.stopPropagation();
      const container = sceneRef.current;
      if (!container) return;
      container.setPointerCapture(e.pointerId);
      setDragObject({
        kind: "key",
        objectId,
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        dx: 0,
        dy: 0,
      });
    },
    [block.objects],
  );

  const handleInventoryItemPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLButtonElement>) => {
      if (!equippedInventoryItem) return;
      e.preventDefault();
      e.stopPropagation();
      const container = sceneRef.current;
      if (!container) return;
      container.setPointerCapture(e.pointerId);
      setDragObject({
        kind: "inventory_item",
        objectId: equippedInventoryItem.id,
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        dx: 0,
        dy: 0,
      });
    },
    [equippedInventoryItem],
  );

  const handlePointerMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (!dragObject || e.pointerId !== dragObject.pointerId) return;
      setDragObject({
        ...dragObject,
        dx: e.clientX - dragObject.startX,
        dy: e.clientY - dragObject.startY,
      });
    },
    [dragObject],
  );

  const handlePointerUp = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (!dragObject || e.pointerId !== dragObject.pointerId) return;
      const container = sceneRef.current;
      if (container?.hasPointerCapture(e.pointerId)) {
        container.releasePointerCapture(e.pointerId);
      }

      const rect = container?.getBoundingClientRect();
      if (rect) {
        const xPct = ((e.clientX - rect.left) / rect.width) * 100;
        const yPct = ((e.clientY - rect.top) / rect.height) * 100;
        if (dragObject.kind === "key") {
          const lock = block.objects.find(
            (o) =>
              o.objectType === "lock" &&
              (previewState?.gameplayObjectVisibility[o.id] ?? o.visibleByDefault) &&
              xPct >= o.x && xPct <= o.x + o.width &&
              yPct >= o.y && yPct <= o.y + o.height,
          );
          if (lock) {
            onDropKeyOnLock(dragObject.objectId, lock.id);
          }
        } else {
          const lock = block.objects.find(
            (o) =>
              o.objectType === "lock" &&
              (previewState?.gameplayObjectVisibility[o.id] ?? o.visibleByDefault) &&
              xPct >= o.x && xPct <= o.x + o.width &&
              yPct >= o.y && yPct <= o.y + o.height,
          );
          if (lock) {
            onDropInventoryItemOnLock(dragObject.objectId, lock.id);
          }
        }
      }

      setDragObject(null);
    },
    [block.objects, dragObject, onDropInventoryItemOnLock, onDropKeyOnLock, previewState],
  );

  const sl = block.sceneLayout;

  return (
    <div
      ref={sceneRef}
      className="preview-vn-gameplay-scene"
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      {bgSrc ? (
        <img
          className="preview-vn-bg-layer"
          src={bgSrc}
          alt=""
          style={{
            left: `${sl.background.x}%`,
            top: `${sl.background.y}%`,
            width: `${sl.background.width}%`,
            height: `${sl.background.height}%`,
          }}
        />
      ) : (
        <div className="pointclick-editor-empty-bg">Fond gameplay manquant</div>
      )}

      {[...block.objects]
        .sort((a, b) => a.zIndex - b.zIndex)
        .map((obj) => {
          const isVisible =
            previewState?.gameplayObjectVisibility[obj.id] ?? obj.visibleByDefault;
          if (!isVisible) return null;
          const interacted = previewInteractedSet.has(obj.id);
          const imgSrc = assetPreviewSrcById[obj.assetId ?? ""];
          const isDragging = dragObject?.kind === "key" && dragObject.objectId === obj.id;

          return (
            <button
              key={obj.id}
              type="button"
              className={`preview-pointclick-object${
                interacted ? " preview-pointclick-object-interacted" : ""
              } preview-pointclick-type-${obj.objectType}${
                isDragging ? " preview-pointclick-dragging" : ""
              }`}
              style={{
                left: `${obj.x}%`,
                top: `${obj.y}%`,
                width: `${obj.width}%`,
                height: `${obj.height}%`,
                zIndex: isDragging ? 999 : obj.zIndex,
                backgroundImage: imgSrc ? `url(${imgSrc})` : undefined,
                backgroundSize: "contain",
                backgroundRepeat: "no-repeat",
                backgroundPosition: "center",
                transform: isDragging ? `translate(${dragObject.dx}px, ${dragObject.dy}px)` : undefined,
                cursor: obj.objectType === "key" ? "grab" : undefined,
              }}
              onPointerDown={(e) => handleKeyPointerDown(e, obj.id)}
              onClick={(e) => {
                e.stopPropagation();
                if (!isDragging) onPickObject(obj.id);
              }}
            >
              {!imgSrc && <span>{obj.name || "Objet"}</span>}
            </button>
          );
        })}
      {equippedInventoryItem && (
        <button
          type="button"
          className={`preview-pointclick-floating-item${
            dragObject?.kind === "inventory_item" ? " preview-pointclick-dragging" : ""
          }`}
          style={{
            left: "50%",
            top: "50%",
            width: "14%",
            height: "14%",
            zIndex: dragObject?.kind === "inventory_item" ? 1000 : 996,
            backgroundImage: equippedInventoryItem.iconSrc
              ? `url(${equippedInventoryItem.iconSrc})`
              : undefined,
            backgroundSize: "contain",
            backgroundRepeat: "no-repeat",
            backgroundPosition: "center",
            transform:
              dragObject?.kind === "inventory_item"
                ? `translate(calc(-50% + ${dragObject.dx}px), calc(-50% + ${dragObject.dy}px))`
                : "translate(-50%, -50%)",
          }}
          onPointerDown={handleInventoryItemPointerDown}
          onClick={(e) => e.stopPropagation()}
        >
          {!equippedInventoryItem.iconSrc && <span>{equippedInventoryItem.name}</span>}
        </button>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function PreviewOverlay({
  previewState,
  previewBlock,
  previewInteractedSet,
  previewGameplayCompleted,
  previewGameplayProgressLabel,
  previewInventoryItems,
  equippedInventoryItemId,
  projectVariables,
  assetPreviewSrcById,
  blockById,
  onRestart,
  onClose,
  onContinue,
  onPickChoice,
  onPickObject,
  onDropKeyOnLock,
  onDropInventoryItemOnLock,
  onEquipInventoryItem,
}: PreviewOverlayProps) {
  const [inventoryPanelOpen, setInventoryPanelOpen] = useState(false);
  const equippedInventoryItem =
    equippedInventoryItemId
      ? previewInventoryItems.find((item) => item.id === equippedInventoryItemId) ?? null
      : null;
  const showInventoryPanel = previewBlock?.type === "gameplay" && inventoryPanelOpen;

  return (
    <div className="preview-overlay">
      {/* Left wing — reserved for future options */}
      <div className="preview-wing preview-wing-left" />

      {/* Smartphone device */}
      <div className="preview-device">
        <div className="preview-device-notch" />
        <div className="preview-device-screen">
          {/* ── Status bar ── */}
          <header className="preview-status-bar">
            <span className="preview-status-block">
              {previewBlock ? previewBlock.name : "Fin"}
            </span>
            <div className="row-inline" style={{ gap: 4 }}>
              <button className="preview-status-btn" onClick={onRestart} title="Restart">↺</button>
              <button className="preview-status-btn" onClick={onClose} title="Fermer">✕</button>
            </div>
          </header>

          {/* ── Content viewport ── */}
          <div className="preview-device-viewport">

          {/* ── END ── */}
          {!previewBlock && (
            <div className="preview-vn-end">
              <h3>Fin de parcours</h3>
              <p>Le parcours est terminé ou aucune cible n&apos;a été définie.</p>
            </div>
          )}

          {/* ── TITLE ── */}
          {previewBlock?.type === "title" && (() => {
            const bgSrc = assetPreviewSrcById[previewBlock.backgroundAssetId ?? ""];
            return (
              <div className="preview-vn-scene" style={bgSrc ? { backgroundImage: `url(${bgSrc})` } : undefined}>
                <div className="preview-vn-title-content">
                  <h2 className="preview-vn-title-heading">{previewBlock.storyTitle || "Titre"}</h2>
                  <p className="preview-vn-title-sub">{previewBlock.subtitle}</p>
                  <button
                    className="preview-vn-styled-btn"
                    style={{
                      backgroundColor: previewBlock.buttonStyle.backgroundColor,
                      color: previewBlock.buttonStyle.textColor,
                      borderColor: previewBlock.buttonStyle.borderColor,
                      borderRadius: `${previewBlock.buttonStyle.radius}px`,
                      fontSize: `${previewBlock.buttonStyle.fontSize}px`,
                    }}
                    onClick={onContinue}
                  >
                    Continuer
                  </button>
                </div>
              </div>
            );
          })()}

          {/* ── CINEMATIC ── */}
          {previewBlock?.type === "cinematic" && (() => {
            const bgSrc = assetPreviewSrcById[previewBlock.backgroundAssetId ?? ""];
            const charSrc = assetPreviewSrcById[previewBlock.characterAssetId ?? ""];
            const videoSrc = assetPreviewSrcById[previewBlock.videoAssetId ?? ""];
            const voiceSrc = assetPreviewSrcById[previewBlock.voiceAssetId ?? ""];
            const sl = previewBlock.sceneLayout;
            return (
              <div className="preview-vn-scene">
                {/* Background — positioned via sceneLayout */}
                {bgSrc && (
                  <img
                    className="preview-vn-bg-layer"
                    src={bgSrc}
                    alt=""
                    style={{
                      left: `${sl.background.x}%`,
                      top: `${sl.background.y}%`,
                      width: `${sl.background.width}%`,
                      height: `${sl.background.height}%`,
                    }}
                  />
                )}

                {/* Character — positioned via sceneLayout */}
                {charSrc && (
                  <img
                    className="preview-vn-char-layer"
                    src={charSrc}
                    alt="Personnage"
                    style={{
                      left: `${sl.character.x}%`,
                      top: `${sl.character.y}%`,
                      width: `${sl.character.width}%`,
                      height: `${sl.character.height}%`,
                    }}
                  />
                )}

                {videoSrc && (
                  <video
                    className="preview-vn-video"
                    src={videoSrc}
                    controls
                    autoPlay
                    playsInline
                  />
                )}
                {voiceSrc && (
                  <audio className="preview-vn-audio" src={voiceSrc} controls autoPlay />
                )}
                <div className="preview-vn-textbox">
                  <div className="preview-vn-textbox-inner">
                    {previewBlock.heading && (
                      <span className="preview-vn-speaker">{previewBlock.heading}</span>
                    )}
                    <p className="preview-vn-text">{previewBlock.body || "…"}</p>
                  </div>
                  <button className="preview-vn-next-btn" onClick={onContinue}>▶</button>
                </div>
              </div>
            );
          })()}

          {/* ── DIALOGUE ── */}
          {previewBlock?.type === "dialogue" && (() => {
            const bgSrc = assetPreviewSrcById[previewBlock.backgroundAssetId ?? ""];

            const linkedNpc =
              previewBlock.npcProfileBlockId
                ? blockById.get(previewBlock.npcProfileBlockId)
                : null;

            const currentLine = previewState?.currentDialogueLineId
              ? previewBlock.lines.find((l) => l.id === previewState.currentDialogueLineId) ?? null
              : null;
            if (!currentLine) {
              // No line passes conditions — auto-continue to next block
              return (
                <div className="preview-vn-scene">
                  <div className="preview-vn-dialogue-box">
                    <p style={{ fontStyle: "italic", opacity: 0.7 }}>Aucune ligne de dialogue disponible (conditions non remplies).</p>
                    <button className="preview-vn-next-btn" onClick={onContinue}>▶</button>
                  </div>
                </div>
              );
            }

            const speakerName =
              linkedNpc && linkedNpc.type === "npc_profile" && linkedNpc.npcName.trim()
                ? linkedNpc.npcName
                : currentLine.speaker;

            const voiceSrc = assetPreviewSrcById[currentLine.voiceAssetId ?? ""];
            const sl = previewBlock.sceneLayout;

            // Multi-character layers sorted by zIndex (higher zIndex = further back)
            const charLayers = (previewBlock.characterLayers ?? [])
              .map((layer) => ({
                ...layer,
                src: assetPreviewSrcById[layer.assetId ?? ""],
              }))
              .filter((l) => l.src)
              .sort((a, b) => b.zIndex - a.zIndex);

            return (
              <div className="preview-vn-scene">
                {/* Background — positioned via sceneLayout */}
                {bgSrc && (
                  <img
                    className="preview-vn-bg-layer"
                    src={bgSrc}
                    alt=""
                    style={{
                      left: `${sl.background.x}%`,
                      top: `${sl.background.y}%`,
                      width: `${sl.background.width}%`,
                      height: `${sl.background.height}%`,
                    }}
                  />
                )}

                {/* Character layers — each with own layout and z-order */}
                {charLayers.map((layer) => (
                  <img
                    key={layer.id}
                    className="preview-vn-char-layer"
                    src={layer.src}
                    alt={layer.label}
                    style={{
                      left: `${layer.layout.x}%`,
                      top: `${layer.layout.y}%`,
                      width: `${layer.layout.width}%`,
                      height: `${layer.layout.height}%`,
                      zIndex: 10 - layer.zIndex,
                    }}
                  />
                ))}

                {/* Voice audio */}
                {voiceSrc && (
                  <audio
                    key={currentLine.id}
                    className="preview-vn-audio"
                    src={voiceSrc}
                    controls
                    autoPlay
                  />
                )}

                {/* Textbox + responses */}
                <div className="preview-vn-dialogue-area">
                  <div className="preview-vn-textbox">
                    <div className="preview-vn-textbox-inner">
                      <span className="preview-vn-speaker">{speakerName || "Personnage"}</span>
                      <p className="preview-vn-text">{currentLine.text || "…"}</p>
                    </div>
                  </div>
                  <div className="preview-vn-responses">
                    {currentLine.responses.map((resp) => (
                      <button
                        key={resp.id}
                        className="preview-vn-response-btn"
                        onClick={() => onPickChoice(resp.id)}
                      >
                        <strong>{resp.label}</strong>
                        <span>{resp.text || "…"}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            );
          })()}

          {/* ── CHOICE ── */}
          {previewBlock?.type === "choice" && (() => {
            const bgSrc = assetPreviewSrcById[previewBlock.backgroundAssetId ?? ""];
            const voiceSrc = assetPreviewSrcById[previewBlock.voiceAssetId ?? ""];
            return (
              <div className="preview-vn-scene" style={bgSrc ? { backgroundImage: `url(${bgSrc})` } : undefined}>
                {voiceSrc && (
                  <audio className="preview-vn-audio" src={voiceSrc} controls autoPlay />
                )}
                <div className="preview-vn-choice-area">
                  <h3 className="preview-vn-choice-prompt">{previewBlock.prompt || "Choisissez…"}</h3>
                  <div className="preview-vn-choice-grid">
                    {previewBlock.choices.map((option) => {
                      const imgSrc = assetPreviewSrcById[option.imageAssetId ?? ""];
                      return (
                        <button
                          key={option.id}
                          className="preview-vn-choice-btn"
                          onClick={() => onPickChoice(option.id)}
                        >
                          {imgSrc && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img className="preview-vn-choice-img" src={imgSrc} alt={option.label} />
                          )}
                          <strong>{option.label}</strong>
                          <span>{option.text || "…"}</span>
                          {option.description && <small>{option.description}</small>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })()}

          {/* ── HERO PROFILE ── */}
          {previewBlock?.type === "hero_profile" && (
            <div className="preview-vn-scene preview-vn-profile-scene">
              <div className="preview-vn-profile-card">
                <h3>⚔ Fiche Héros</h3>
                <p>Bloc visuel de référence héros.</p>
                <button className="preview-vn-next-btn" onClick={onContinue}>▶ Continuer</button>
              </div>
            </div>
          )}

          {/* ── NPC PROFILE ── */}
          {previewBlock?.type === "npc_profile" && (() => {
            const defaultImgSrc = assetPreviewSrcById[previewBlock.defaultImageAssetId ?? ""];
            return (
              <div className="preview-vn-scene preview-vn-profile-scene">
                {defaultImgSrc && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img className="preview-vn-character" src={defaultImgSrc} alt={previewBlock.npcName || "PNJ"} />
                )}
                <div className="preview-vn-profile-card">
                  <h3>{previewBlock.npcName || "PNJ"}</h3>
                  <p>{previewBlock.npcLore || "Lore PNJ vide."}</p>
                  <button className="preview-vn-next-btn" onClick={onContinue}>▶ Continuer</button>
                </div>
              </div>
            );
          })()}

          {/* ── GAMEPLAY ── */}
          {previewBlock?.type === "gameplay" && (() => {
            const bgSrc = assetPreviewSrcById[previewBlock.backgroundAssetId ?? ""];
            const voiceSrc = assetPreviewSrcById[previewBlock.voiceAssetId ?? ""];
            const equippedItemIconSrc = equippedInventoryItem
              ? assetPreviewSrcById[equippedInventoryItem.iconAssetId ?? ""]
              : undefined;
            return (
              <div className="preview-vn-scene">
                <div className="preview-vn-gameplay-hud">
                  <span className={`chip ${previewGameplayCompleted ? "chip-start" : "chip-warning"}`}>
                    {previewGameplayCompleted ? "✓ objectif atteint" : "objectif en cours"}
                  </span>
                  <small>{previewGameplayProgressLabel}</small>
                  <button
                    type="button"
                    className="preview-vn-inventory-btn"
                    onClick={() => setInventoryPanelOpen((open) => !open)}
                  >
                    Inventaire ({previewInventoryItems.length})
                  </button>
                </div>

                {equippedInventoryItem && (
                  <div className="preview-vn-equipped-item">
                    {equippedItemIconSrc && (
                      <img src={equippedItemIconSrc} alt={equippedInventoryItem.name} />
                    )}
                    <span>Equipe: {equippedInventoryItem.name}</span>
                  </div>
                )}

                {showInventoryPanel && (
                  <div className="preview-vn-inventory-panel">
                    <div className="preview-vn-inventory-panel-header">
                      <strong>Inventaire</strong>
                      <button
                        type="button"
                        className="preview-status-btn"
                        onClick={() => setInventoryPanelOpen(false)}
                        title="Fermer inventaire"
                      >
                        âœ•
                      </button>
                    </div>
                    {previewInventoryItems.length === 0 && (
                      <p className="empty-placeholder">Aucun item.</p>
                    )}
                    {previewInventoryItems.length > 0 && (
                      <div className="preview-vn-inventory-list">
                        {previewInventoryItems.map((item) => {
                          const iconSrc = assetPreviewSrcById[item.iconAssetId ?? ""];
                          const isSelected = equippedInventoryItemId === item.id;
                          return (
                            <button
                              key={item.id}
                              type="button"
                              className={`preview-vn-inventory-item${isSelected ? " is-selected" : ""}`}
                              onClick={() => {
                                onEquipInventoryItem(item.id);
                                setInventoryPanelOpen(false);
                              }}
                            >
                              {iconSrc ? (
                                <img src={iconSrc} alt={item.name} />
                              ) : (
                                <span className="item-placeholder">item</span>
                              )}
                              <span className="item-label">{item.name}</span>
                              <strong>x{item.quantity}</strong>
                            </button>
                          );
                        })}
                      </div>
                    )}
                    {equippedInventoryItemId && (
                      <button
                        type="button"
                        className="button-secondary"
                        onClick={() => onEquipInventoryItem(null)}
                      >
                        Retirer l&apos;item equipe
                      </button>
                    )}
                  </div>
                )}

                {voiceSrc && (
                  <audio className="preview-vn-audio" src={voiceSrc} controls autoPlay />
                )}

                <GameplayPreviewScene
                  block={previewBlock}
                  previewState={previewState}
                  previewInteractedSet={previewInteractedSet}
                  assetPreviewSrcById={assetPreviewSrcById}
                  bgSrc={bgSrc}
                  equippedInventoryItem={
                    equippedInventoryItem
                      ? {
                          id: equippedInventoryItem.id,
                          name: equippedInventoryItem.name,
                          iconSrc: assetPreviewSrcById[equippedInventoryItem.iconAssetId ?? ""],
                        }
                      : null
                  }
                  onPickObject={onPickObject}
                  onDropKeyOnLock={onDropKeyOnLock}
                  onDropInventoryItemOnLock={onDropInventoryItemOnLock}
                />

                {previewState?.gameplayMessage && (
                  <p className="preview-vn-gameplay-msg">{previewState.gameplayMessage}</p>
                )}

                <div className="preview-vn-gameplay-bottom">
                  <p className="preview-vn-text" style={{ textAlign: "center" }}>
                    {previewBlock.objective || "Objectif…"}
                  </p>
                  <button
                    className="preview-vn-next-btn"
                    onClick={onContinue}
                    disabled={!previewGameplayCompleted}
                  >
                    {previewGameplayCompleted ? "▶ Continuer" : "Objectif non atteint"}
                  </button>
                </div>
              </div>
            );
          })()}
          </div>

          {/* ── Home indicator ── */}
          <div className="preview-device-home" />
        </div>
      </div>

      {/* Right wing — debug sidebar */}
      <div className="preview-wing preview-wing-right">
        <aside className="preview-wing-panel">
          <details open>
            <summary>Variables</summary>
            {previewState && (
              <ul className="preview-wing-var-list">
                {projectVariables.map((variable) => (
                  <li key={variable.id}>
                    <span>{variable.name}</span>
                    <strong>{previewState.variables[variable.id] ?? 0}</strong>
                  </li>
                ))}
              </ul>
            )}
          </details>
          <details>
            <summary>Inventaire</summary>
            {previewState && previewInventoryItems.length > 0 && (
              <ul className="preview-wing-var-list">
                {previewInventoryItems.map((item) => (
                  <li key={item.id}>
                    <span>{item.name}</span>
                    <strong>{item.quantity}</strong>
                  </li>
                ))}
              </ul>
            )}
            {previewState && previewInventoryItems.length === 0 && (
              <p className="empty-placeholder">Aucun objet.</p>
            )}
          </details>
          {previewState && Object.keys(previewState.npcAffinity).length > 0 && (
            <details>
              <summary>Affinite PNJ</summary>
              <ul className="preview-wing-var-list">
                {Object.entries(previewState.npcAffinity).map(([npcBlockId, value]) => {
                  const npcBlock = blockById.get(npcBlockId);
                  const name = npcBlock?.type === "npc_profile" ? npcBlock.npcName : npcBlockId;
                  return (
                    <li key={npcBlockId}>
                      <span>{name}</span>
                      <strong>{value}/100</strong>
                    </li>
                  );
                })}
              </ul>
            </details>
          )}
          {previewState?.ended && <p className="ok-line">Parcours terminé.</p>}
        </aside>
      </div>
    </div>
  );
}
