"use client";

import {
  BaseEdge,
  EdgeLabelRenderer,
  EdgeProps,
  getBezierPath,
  Handle,
  Node,
  NodeProps,
  Position,
} from "@xyflow/react";

import { HelpHint } from "@/components/HelpHint";
import {
  BLOCK_LABELS,
  CinematicBlock,
  ChapterStartBlock,
  ChoiceBlock,
  DialogueBlock,
  GameplayBlock,
  StoryBlock,
  SwitchBlock,
  blockTypeColor,
  describeSwitchCase,
} from "@/lib/story";

export interface StoryNodeData {
  [key: string]: unknown;
  block: StoryBlock;
  isStart: boolean;
  hasError: boolean;
  hasWarning: boolean;
  canEdit?: boolean;
  onDeleteBlock?: (blockId: string) => void;
  onToggleChapterCollapse?: (chapterId: string) => void;
}

type StoryEditorNode = Node<StoryNodeData>;

function DialogueOutputs({ block }: { block: DialogueBlock }) {
  return (
    <div className="story-node-dialogue-outputs">
      {block.lines.map((line, lineIndex) => (
        <div key={line.id} className="story-node-dialogue-line-group">
          <div className="story-node-dialogue-line-header">
            <Handle
              type="target"
              id={`line-${line.id}`}
              position={Position.Left}
              className="story-node-handle"
            />
            <span className="story-node-dialogue-line-title">
              {line.speaker || "…"}: {(line.text || "…").slice(0, 30)}{line.text.length > 30 ? "…" : ""}
            </span>
          </div>
          {line.responses.map((resp) => (
            <div key={resp.id} className="story-node-choice-row">
              <span className="story-node-choice-label">{resp.label}</span>
              <span className="story-node-choice-text">
                {resp.text.trim() || "Reponse vide"}
              </span>
              <Handle
                type="source"
                id={`resp-${resp.id}`}
                position={Position.Right}
                className="story-node-handle"
              />
            </div>
          ))}
          {line.responses.length === 0 && block.lines[lineIndex + 1] && (
            <div className="story-node-choice-row">
              <span className="story-node-choice-label">▶</span>
              <span className="story-node-choice-text">Continuer auto</span>
              <Handle
                type="source"
                id={`line-next-${line.id}`}
                position={Position.Right}
                className="story-node-handle"
              />
            </div>
          )}
          {line.responses.length === 0 && (
            <div className="story-node-choice-row">
              <span className="story-node-choice-label">&gt;&gt;</span>
              <span className="story-node-choice-text">
                {line.continueTargetBlockId
                  ? "Continuer -> bloc"
                  : "Continuer -> sortie"}
              </span>
              <Handle
                type="source"
                id={`line-continue-${line.id}`}
                position={Position.Right}
                className="story-node-handle"
              />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function CinematicOutputs({ block }: { block: CinematicBlock }) {
  return (
    <div className="story-node-dialogue-outputs">
      {block.narrations.map((narration, narrationIndex) => {
        const hasManualTarget =
          Boolean(narration.continueTargetBlockId) || Boolean(narration.continueTargetNarrationId);
        const hasAutoNarration = Boolean(!hasManualTarget && block.narrations[narrationIndex + 1]);
        const hasAutoExit = Boolean(!hasManualTarget && !block.narrations[narrationIndex + 1] && block.nextBlockId);
        return (
          <div key={narration.id} className="story-node-dialogue-line-group">
            <div className="story-node-dialogue-line-header">
              <Handle
                type="target"
                id={`narration-${narration.id}`}
                position={Position.Left}
                className="story-node-handle"
              />
              <span className="story-node-dialogue-line-title">
                {narration.heading || "Narration"}: {(narration.body || "…").slice(0, 30)}
                {narration.body.length > 30 ? "…" : ""}
              </span>
            </div>
            {(hasAutoNarration || hasAutoExit) && (
              <div className="story-node-choice-row">
                <span className="story-node-choice-label">▶</span>
                <span className="story-node-choice-text">
                  {hasAutoNarration ? "Suite auto" : "Sortie auto"}
                </span>
                <Handle
                  type="source"
                  id={`narration-next-${narration.id}`}
                  position={Position.Right}
                  className="story-node-handle"
                />
              </div>
            )}
            <div className="story-node-choice-row">
              <span className="story-node-choice-label">&gt;&gt;</span>
              <span className="story-node-choice-text">
                {narration.continueTargetNarrationId
                  ? "Continuer -> narration"
                  : narration.continueTargetBlockId
                    ? "Continuer -> bloc"
                    : "Continuer -> sortie"}
              </span>
              <Handle
                type="source"
                id={`narration-continue-${narration.id}`}
                position={Position.Right}
                className="story-node-handle"
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ChoiceOutputs({ block }: { block: ChoiceBlock }) {
  return (
    <div className="story-node-dialogue-outputs">
      {block.choices.map((option) => (
        <div key={option.id} className="story-node-choice-row">
          <span className="story-node-choice-label">{option.label}</span>
          <span className="story-node-choice-text">
            {option.text.trim() || "Option vide"}
          </span>
          <Handle
            type="source"
            id={`choice-${option.label}`}
            position={Position.Right}
            className="story-node-handle"
          />
        </div>
      ))}
    </div>
  );
}

function GameplayOutputs({ block }: { block: GameplayBlock }) {
  const lockObjects = block.objects.filter((obj) => obj.objectType === "lock");
  const hasButtons =
    block.objects.some((obj) => obj.objectType === "button") ||
    Boolean(block.buttonSequenceSuccessBlockId || block.buttonSequenceFailureBlockId);

  return (
    <div className="story-node-dialogue-outputs">
      {lockObjects.map((lock, index) => (
        <div key={lock.id} className="story-node-choice-row">
          <span className="story-node-choice-label">S{index + 1}</span>
          <span className="story-node-choice-text">{lock.name.trim() || `Serrure ${index + 1}`}</span>
          <Handle
            type="source"
            id={`lock-${lock.id}`}
            position={Position.Right}
            className="story-node-handle"
          />
        </div>
      ))}
      {hasButtons && (
        <>
          <div className="story-node-choice-row">
            <span className="story-node-choice-label">OK</span>
            <span className="story-node-choice-text">Sequence reussie</span>
            <Handle
              type="source"
              id="button-seq-success"
              position={Position.Right}
              className="story-node-handle"
            />
          </div>
          <div className="story-node-choice-row">
            <span className="story-node-choice-label">KO</span>
            <span className="story-node-choice-text">Sequence echouee</span>
            <Handle
              type="source"
              id="button-seq-failure"
              position={Position.Right}
              className="story-node-handle"
            />
          </div>
        </>
      )}
    </div>
  );
}

function SwitchOutputs({ block }: { block: SwitchBlock }) {
  return (
    <div className="story-node-dialogue-outputs">
      {block.cases.map((item, index) => (
        <div key={item.id} className="story-node-choice-row">
          <span className="story-node-choice-label">C{index + 1}</span>
          <span className="story-node-choice-text">
            {describeSwitchCase(item)}
          </span>
          <Handle
            type="source"
            id={`switch-case-${item.id}`}
            position={Position.Right}
            className="story-node-handle"
          />
        </div>
      ))}
      <div className="story-node-choice-row">
        <span className="story-node-choice-label">Else</span>
        <span className="story-node-choice-text">Sinon</span>
        <Handle
          type="source"
          id="switch-default"
          position={Position.Right}
          className="story-node-handle"
        />
      </div>
    </div>
  );
}

function blockSummary(block: StoryBlock) {
  if (block.type === "title") return block.storyTitle || "Titre vide";
  if (block.type === "cinematic") {
    const startNarration =
      block.narrations.find((item) => item.id === block.startNarrationId)
      ?? block.narrations[0]
      ?? { id: block.startNarrationId || block.id, heading: block.heading, body: block.body };
    if (startNarration.body.trim()) return `${startNarration.heading || "Cinematique"}: ${startNarration.body}`;
    return startNarration.heading || "Cinematique";
  }
  if (block.type === "dialogue") {
    const first = block.lines[0];
    return first ? `${first.speaker}: ${first.text || "..."}` : "Dialogue vide";
  }
  if (block.type === "choice") return block.prompt.trim() || "Choix vide";
  if (block.type === "switch") return `${block.cases.length} cas`;
  if (block.type === "chapter_start") return block.chapterTitle || "Chapitre sans titre";
  if (block.type === "chapter_end") return "Sortie de chapitre";
  if (block.type === "hero_profile") return "Fiche du hero (visuel)";
  if (block.type === "npc_profile") return `${block.npcName || "PNJ"} (${block.imageAssetIds.length} image(s))`;
  const objectCount = block.objects?.length ?? 0;
  if (!block.objective.trim()) return `Gameplay (${objectCount} objet(s))`;
  return `${block.objective} (${objectCount} objet(s))`;
}

function blockHelp(block: StoryBlock) {
  if (block.type === "title") {
    return "Ecran d'accueil de l'histoire: titre, fond, style des boutons et lien vers la suite.";
  }
  if (block.type === "cinematic") {
    return "Scene narrative lineaire: plusieurs narrations internes reutilisent la meme scene, puis passage au bloc suivant.";
  }
  if (block.type === "dialogue") {
    return "Dialogue multi-lignes: chaque ligne a des reponses qui menent a d'autres lignes internes ou des blocs externes.";
  }
  if (block.type === "choice") {
    return "Bloc de decision: le joueur choisit un chemin parmi plusieurs options (sans dialogue).";
  }
  if (block.type === "switch") {
    return "Bloc de routage conditionnel: evalue une variable et redirige vers le premier cas correspondant.";
  }
  if (block.type === "chapter_start") {
    return "Debut de chapitre: point d'entree, avec un bouton pour reduire tout le chapitre sur le whiteboard.";
  }
  if (block.type === "chapter_end") {
    return "Fin de chapitre: portail de sortie vers un autre bloc en dehors du chapitre.";
  }
  if (block.type === "hero_profile") {
    return "Bloc visuel de reference du hero, relie aux donnees definies dans la fiche hero du projet.";
  }
  if (block.type === "npc_profile") {
    return "Profil PNJ reutilisable (nom, lore, images) pour alimenter les blocs dialogue.";
  }
  return "Scene point & clic avec zones interactives, actions au clic, objets et condition de fin.";
}

function NpcProfileOutput() {
  return (
    <div className="story-node-footer">
      <span>Lier a un dialogue</span>
      <Handle
        type="source"
        id="npc-link"
        position={Position.Right}
        className="story-node-handle"
      />
    </div>
  );
}

function ChapterStartFooter({
  block,
  onToggleCollapse,
}: {
  block: ChapterStartBlock;
  onToggleCollapse?: (chapterId: string) => void;
}) {
  return (
    <div className="story-node-footer">
      <span>Suivant</span>
      <Handle
        type="source"
        id="next"
        position={Position.Right}
        className="story-node-handle"
      />
      {block.chapterId && onToggleCollapse && (
        <button
          className="chapter-collapse-btn nodrag nopan"
          title="Reduire ce chapitre"
          onClick={(e) => {
            e.stopPropagation();
            onToggleCollapse(block.chapterId!);
          }}
        >
          Reduire
        </button>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════
   ChapterFolderNode — virtual node shown when a chapter is collapsed
   ═══════════════════════════════════════════════ */

export interface ChapterFolderData {
  [key: string]: unknown;
  chapterId: string;
  chapterName: string;
  blockCount: number;
  onExpand: (chapterId: string) => void;
}

type ChapterFolderEditorNode = Node<ChapterFolderData>;

export function ChapterFolderNode({ data, selected }: NodeProps<ChapterFolderEditorNode>) {
  return (
    <div className={`chapter-folder-node ${selected ? "chapter-folder-node-selected" : ""}`}>
      <Handle type="target" position={Position.Left} className="story-node-handle" />
      <header className="chapter-folder-header">
        <span className="chapter-folder-icon">📁</span>
        <span className="chapter-folder-name">{data.chapterName}</span>
      </header>
      <p className="chapter-folder-count">{data.blockCount} bloc(s)</p>
      <button
        className="chapter-expand-btn nodrag nopan"
        onClick={(e) => {
          e.stopPropagation();
          data.onExpand(data.chapterId);
        }}
      >
        Ouvrir
      </button>
      <Handle type="source" id="next" position={Position.Right} className="story-node-handle" />
    </div>
  );
}

export function StoryNode({ data, selected }: NodeProps<StoryEditorNode>) {
  const color = blockTypeColor(data.block.type);
  const borderColor = data.hasError ? "#dc2626" : color;
  const summary = blockSummary(data.block);
  const canReceiveConnections =
    data.block.type !== "hero_profile" && data.block.type !== "npc_profile";
  const hasPerLineHandles = data.block.type === "dialogue" || data.block.type === "cinematic";

  return (
    <div
      className={`story-node ${data.hasError ? "story-node-error" : ""} ${selected ? "story-node-selected" : ""}`}
      style={{ borderColor }}
    >
      {canReceiveConnections && !hasPerLineHandles && (
        <Handle
          type="target"
          position={Position.Left}
          className="story-node-handle"
        />
      )}
      <header className="story-node-header">
        <div className="story-node-header-main">
          <span
            className="story-node-type-chip"
            style={{ backgroundColor: `${color}20`, color }}
          >
            {BLOCK_LABELS[data.block.type]}
          </span>
          {data.isStart && <span className="story-node-start-chip">START</span>}
        </div>
        <HelpHint
          title={`Bloc ${BLOCK_LABELS[data.block.type]}`}
          className="story-node-help"
          align="right"
        >
          {blockHelp(data.block)}
        </HelpHint>
        {data.canEdit && data.onDeleteBlock && (
          <button
            className="story-node-delete"
            title="Supprimer ce bloc"
            onClick={(e) => {
              e.stopPropagation();
              data.onDeleteBlock!(data.block.id);
            }}
          >
            ✕
          </button>
        )}
      </header>
      <h4 className="story-node-title">{data.block.name || BLOCK_LABELS[data.block.type]}</h4>
      <p className="story-node-summary">{summary}</p>
      {data.block.type === "dialogue" ? (
        <DialogueOutputs block={data.block} />
      ) : data.block.type === "cinematic" ? (
        <CinematicOutputs block={data.block} />
      ) : data.block.type === "choice" ? (
        <ChoiceOutputs block={data.block} />
      ) : data.block.type === "gameplay" ? (
        <GameplayOutputs block={data.block} />
      ) : data.block.type === "switch" ? (
        <SwitchOutputs block={data.block} />
      ) : data.block.type === "npc_profile" ? (
        <NpcProfileOutput />
      ) : data.block.type === "hero_profile" ? (
        <div className="story-node-footer">
          <span>Bloc visuel</span>
        </div>
      ) : data.block.type === "chapter_start" ? (
        <ChapterStartFooter block={data.block} onToggleCollapse={data.onToggleChapterCollapse} />
      ) : data.block.type === "chapter_end" ? (
        <div className="story-node-footer">
          <span>Sortie chapitre</span>
          <Handle
            type="source"
            id="next"
            position={Position.Right}
            className="story-node-handle"
          />
        </div>
      ) : (
        <div className="story-node-footer">
          <span>Suivant</span>
          <Handle
            type="source"
            id="next"
            position={Position.Right}
            className="story-node-handle"
          />
        </div>
      )}
      {(data.hasError || data.hasWarning) && (
        <div className="story-node-issues">
          {data.hasError ? "Erreurs a corriger" : "Warnings detectes"}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════
   DeletableEdge — edge with a delete button at midpoint
   ═══════════════════════════════════════════════ */

export interface DeletableEdgeData {
  [key: string]: unknown;
  label?: string;
  onDeleteEdge?: (sourceId: string, sourceHandle: string) => void;
}

export function DeletableEdge({
  source,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style,
  markerEnd,
  data,
  label,
  labelStyle,
  sourceHandleId,
}: EdgeProps & { data?: DeletableEdgeData }) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  return (
    <>
      <BaseEdge path={edgePath} markerEnd={markerEnd} style={style} />
      <EdgeLabelRenderer>
        <div
          className="edge-label-container"
          style={{
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
          }}
        >
          {label && (
            <span
              className="edge-label-text"
              style={labelStyle as React.CSSProperties}
            >
              {label as string}
            </span>
          )}
          {data?.onDeleteEdge && (
            <button
              className="edge-delete-btn"
              title="Supprimer ce lien"
              onClick={(e) => {
                e.stopPropagation();
                data.onDeleteEdge!(source, sourceHandleId ?? "next");
              }}
            >
              ✕
            </button>
          )}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
