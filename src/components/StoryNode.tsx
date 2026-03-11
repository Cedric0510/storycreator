"use client";

import { useCallback } from "react";
import {
  BaseEdge,
  EdgeLabelRenderer,
  EdgeProps,
  getBezierPath,
  Handle,
  Node,
  NodeProps,
  Position,
  useReactFlow,
} from "@xyflow/react";

import { HelpHint } from "@/components/HelpHint";
import { BLOCK_LABELS, ChapterStartBlock, ChoiceBlock, DialogueBlock, StoryBlock, blockTypeColor } from "@/lib/story";

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
        </div>
      ))}
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

function blockSummary(block: StoryBlock) {
  if (block.type === "title") return block.storyTitle || "Titre vide";
  if (block.type === "cinematic") return block.heading || "Cinematique";
  if (block.type === "dialogue") {
    const first = block.lines[0];
    return first ? `${first.speaker}: ${first.text || "..."}` : "Dialogue vide";
  }
  if (block.type === "choice") return block.prompt.trim() || "Choix vide";
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
    return "Scene narrative lineaire: texte, image/video/voix puis passage au bloc suivant.";
  }
  if (block.type === "dialogue") {
    return "Dialogue multi-lignes: chaque ligne a des reponses qui menent a d'autres lignes internes ou des blocs externes.";
  }
  if (block.type === "choice") {
    return "Bloc de decision: le joueur choisit un chemin parmi plusieurs options (sans dialogue).";
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
  const summary = blockSummary(data.block);
  const canReceiveConnections =
    data.block.type !== "hero_profile" && data.block.type !== "npc_profile";
  const hasPerLineHandles = data.block.type === "dialogue";

  return (
    <div
      className={`story-node ${selected ? "story-node-selected" : ""}`}
      style={{ borderColor: color }}
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
      ) : data.block.type === "choice" ? (
        <ChoiceOutputs block={data.block} />
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