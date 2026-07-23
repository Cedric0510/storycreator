import { useEffect } from "react";

import { HelpHint } from "@/components/HelpHint";
import { NextBlockSelect } from "@/components/AuthorStudioNextBlockSelect";
import {
  ChapterEndBlock,
  ChapterStartBlock,
  HeroProfileBlock,
  NpcProfileBlock,
  PartEndBlock,
  PartStartBlock,
  ProjectMeta,
  StoryBlock,
} from "@/lib/story";

interface PartStartEditorSectionProps {
  block: PartStartBlock;
  canEdit: boolean;
  blocks: StoryBlock[];
  project: ProjectMeta;
  onSetSelectedDynamicField: (key: string, value: unknown) => void;
  onSetConnection: (sourceId: string, sourceHandle: string, targetId: string | null) => void;
}

export function PartStartEditorSection({
  block,
  canEdit,
  blocks,
  project,
  onSetSelectedDynamicField,
  onSetConnection,
}: PartStartEditorSectionProps) {
  return (
    <>
      <label>
        Titre de la partie
        <input
          value={block.partTitle}
          onChange={(event) => onSetSelectedDynamicField("partTitle", event.target.value)}
          disabled={!canEdit}
        />
      </label>
      <label>
        Chapitre parent
        <select
          value={block.chapterId ?? ""}
          onChange={(event) => onSetSelectedDynamicField("chapterId", event.target.value || null)}
          disabled={!canEdit}
        >
          <option value="">Selectionner un chapitre</option>
          {project.chapters.map((chapter) => (
            <option key={chapter.id} value={chapter.id}>{chapter.name}</option>
          ))}
        </select>
      </label>
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

interface PartEndEditorSectionProps {
  block: PartEndBlock;
  canEdit: boolean;
  blocks: StoryBlock[];
  project: ProjectMeta;
  onSetSelectedDynamicField: (key: string, value: unknown) => void;
  onSetConnection: (sourceId: string, sourceHandle: string, targetId: string | null) => void;
  onSetPartValidationFromEnd: (partEndBlockId: string, validated: boolean) => void;
}

export function PartEndEditorSection({
  block,
  canEdit,
  blocks,
  project,
  onSetSelectedDynamicField,
  onSetConnection,
  onSetPartValidationFromEnd,
}: PartEndEditorSectionProps) {
  const part = project.parts.find((candidate) => candidate.id === block.partId);
  return (
    <>
      <label>
        Partie cloturee
        <select
          value={block.partId ?? ""}
          onChange={(event) => onSetSelectedDynamicField("partId", event.target.value || null)}
          disabled={!canEdit}
        >
          <option value="">Selectionner une partie</option>
          {project.parts.map((candidate) => (
            <option key={candidate.id} value={candidate.id}>{candidate.name}</option>
          ))}
        </select>
      </label>
      <button
        className="button-secondary"
        onClick={() => onSetPartValidationFromEnd(block.id, !(part?.validated ?? false))}
        disabled={!canEdit || !part}
      >
        {part?.validated ? "Retirer validation partie" : "Valider cette partie"}
      </button>
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

interface HeroProfileEditorSectionProps {
  block: HeroProfileBlock;
  project: ProjectMeta;
}

export function HeroProfileEditorSection({ block, project }: HeroProfileEditorSectionProps) {
  const heroChoiceMemoryVariables = project.variables.filter((variable) =>
    variable.name.trim().toLowerCase().startsWith("choix_"),
  );

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
      <div className="effect-list">
        <div className="section-title-row">
          <span>Memoire des choix</span>
        </div>
        {heroChoiceMemoryVariables.length === 0 && (
          <small className="empty-placeholder">
            Aucune variable memoire. Cree des variables nommees &quot;choix_*&quot; dans la fiche heros.
          </small>
        )}
        {heroChoiceMemoryVariables.map((variable) => (
          <div key={variable.id} className="effect-row">
            <span>{variable.name}</span>
            <small>Initial: {variable.initialValue}</small>
          </div>
        ))}
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

export function NpcProfileEditorSection({
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

interface ChapterStartEditorSectionProps {
  block: ChapterStartBlock;
  canEdit: boolean;
  blocks: StoryBlock[];
  project: ProjectMeta;
  chapterEndOptionsByChapterId: Record<string, ChapterEndBlock[]>;
  onSetSelectedDynamicField: (key: string, value: unknown) => void;
  onSetConnection: (sourceId: string, sourceHandle: string, targetId: string | null) => void;
  onSetChapterStartPreviousLink: (
    chapterStartBlockId: string,
    previousChapterId: string | null,
    previousChapterEndBlockId: string | null,
  ) => void;
}

export function ChapterStartEditorSection({
  block,
  canEdit,
  blocks,
  project,
  chapterEndOptionsByChapterId,
  onSetSelectedDynamicField,
  onSetConnection,
  onSetChapterStartPreviousLink,
}: ChapterStartEditorSectionProps) {
  const chapter = project.chapters.find((ch) => ch.id === block.chapterId);
  const previousChapters = project.chapters.filter((candidate) => candidate.id !== block.chapterId);
  const inferredPreviousChapterId = block.linkedFromChapterEndBlockId
    ? previousChapters.find((candidate) =>
        (chapterEndOptionsByChapterId[candidate.id] ?? []).some(
          (endBlock) => endBlock.id === block.linkedFromChapterEndBlockId,
        ),
      )?.id ?? null
    : null;
  const selectedPreviousChapterId = previousChapters.some((ch) => ch.id === block.linkedFromChapterId)
    ? block.linkedFromChapterId
    : inferredPreviousChapterId;
  const previousChapterEndBlocks = selectedPreviousChapterId
    ? chapterEndOptionsByChapterId[selectedPreviousChapterId] ?? []
    : [];
  const selectedPreviousEndBlockId = previousChapterEndBlocks.some(
    (candidate) => candidate.id === block.linkedFromChapterEndBlockId,
  )
    ? block.linkedFromChapterEndBlockId
    : null;

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
        <p className="form-hint">
          Chapitre: {chapter.name}
          {chapter.validated ? " (valide)" : ""}
        </p>
      )}
      <label>
        Relie a un chapitre precedent
        <select
          value={selectedPreviousChapterId ?? ""}
          onChange={(event) => {
            const nextChapterId = event.target.value || null;
            if (!nextChapterId) {
              onSetChapterStartPreviousLink(block.id, null, null);
              return;
            }
            const firstEnd = chapterEndOptionsByChapterId[nextChapterId]?.[0];
            onSetChapterStartPreviousLink(block.id, nextChapterId, firstEnd?.id ?? null);
          }}
          disabled={!canEdit}
        >
          <option value="">Aucun</option>
          {previousChapters.map((candidate) => (
            <option key={candidate.id} value={candidate.id}>
              {candidate.name}
            </option>
          ))}
        </select>
      </label>
      {selectedPreviousChapterId && (
        <label>
          Sortie du chapitre precedent
          <select
            value={selectedPreviousEndBlockId ?? ""}
            onChange={(event) =>
              onSetChapterStartPreviousLink(
                block.id,
                selectedPreviousChapterId,
                event.target.value || null,
              )
            }
            disabled={!canEdit}
          >
            <option value="">Aucune sortie</option>
            {previousChapterEndBlocks.map((candidate, index) => (
              <option key={candidate.id} value={candidate.id}>
                {(candidate.name || `Fin ${index + 1}`).trim()}
              </option>
            ))}
          </select>
        </label>
      )}
      {selectedPreviousChapterId && previousChapterEndBlocks.length === 0 && (
        <p className="form-hint">
          Ce chapitre precedent n&apos;a pas de bloc Fin de chapitre disponible.
        </p>
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

interface ChapterEndEditorSectionProps {
  block: ChapterEndBlock;
  canEdit: boolean;
  blocks: StoryBlock[];
  project: ProjectMeta;
  onSetConnection: (sourceId: string, sourceHandle: string, targetId: string | null) => void;
  onSetChapterValidationFromEnd: (chapterEndBlockId: string, validated: boolean) => void;
}

export function ChapterEndEditorSection({
  block,
  canEdit,
  blocks,
  project,
  onSetConnection,
  onSetChapterValidationFromEnd,
}: ChapterEndEditorSectionProps) {
  const chapter = project.chapters.find((candidate) => candidate.id === block.chapterId);

  return (
    <>
      {chapter ? (
        <p className="form-hint">
          Chapitre: {chapter.name}
          {chapter.validated ? " (valide)" : ""}
        </p>
      ) : (
        <p className="form-hint">Ce bloc fin n&apos;est rattache a aucun chapitre.</p>
      )}
      <button
        className="button-secondary"
        onClick={() => onSetChapterValidationFromEnd(block.id, !(chapter?.validated ?? false))}
        disabled={!canEdit || !chapter}
      >
        {chapter?.validated ? "Retirer validation chapitre" : "Valider ce chapitre"}
      </button>
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

interface ChapterAssignmentSelectProps {
  block: StoryBlock;
  project: ProjectMeta;
  canEdit: boolean;
  onSetSelectedDynamicField: (key: string, value: unknown) => void;
}

export function ChapterAssignmentSelect({
  block,
  project,
  canEdit,
  onSetSelectedDynamicField,
}: ChapterAssignmentSelectProps) {
  if (
    block.type === "chapter_start"
    || block.type === "part_start"
    || block.type === "part_end"
  ) return null;
  if (project.chapters.length === 0) return null;
  const chapterLabel = block.type === "chapter_end" ? "Ce block cloture quel chapitre?" : "Chapitre";

  return (
    <label>
      {chapterLabel}
      <select
        value={block.chapterId ?? ""}
        onChange={(event) => onSetSelectedDynamicField("chapterId", event.target.value || null)}
        disabled={!canEdit}
      >
        <option value="">Aucun chapitre</option>
        {project.chapters.map((chapter) => (
          <option key={chapter.id} value={chapter.id}>
            {chapter.name}
          </option>
        ))}
      </select>
    </label>
  );
}
