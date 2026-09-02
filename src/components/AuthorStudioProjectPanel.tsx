import { Dispatch, SetStateAction, useState, type CSSProperties } from "react";

import { normalizeDelta, toSlug } from "@/components/author-studio-core";
import { CollapsibleSection } from "@/components/CollapsibleSection";
import { HelpHint } from "@/components/HelpHint";
import type { StudioLeftSection } from "@/components/StudioLeftNavigation";
import { BlockType, PROJECT_FORMAT_LABELS, ProjectFormat, ProjectMeta, blockTypeColor, createId } from "@/lib/story";
import { AuthorStudioCommercePanel } from "@/components/AuthorStudioCommercePanel";

const BLOCK_LIBRARY_ITEMS: ReadonlyArray<{ type: BlockType; label: string }> = [
  { type: "title", label: "Ecran titre" },
  { type: "cinematic", label: "Cinematique" },
  { type: "dialogue", label: "Dialogue" },
  { type: "gameplay", label: "Gameplay" },
  { type: "choice", label: "Choix" },
  { type: "switch", label: "Switch" },
  { type: "hero_profile", label: "Fiche Hero" },
  { type: "npc_profile", label: "Fiche PNJ" },
  { type: "chapter_start", label: "Debut chapitre" },
  { type: "chapter_end", label: "Fin chapitre" },
  { type: "part_start", label: "Debut partie" },
  { type: "part_end", label: "Fin partie" },
];

interface AuthorStudioProjectPanelProps {
  activeSection: Exclude<StudioLeftSection, "cloud"> | "project";
  project: ProjectMeta;
  setProject: Dispatch<SetStateAction<ProjectMeta>>;
  canEdit: boolean;
  newVariableName: string;
  onNewVariableNameChange: (value: string) => void;
  onAddVariable: () => void;
  onDeleteVariable: (variableId: string) => void;
  onAddBlock: (type: BlockType) => void;
  assetPreviewSrcById: Record<string, string>;
  getAssetFileName: (assetId: string | null) => string;
  onCreateItem: (name: string, iconFile: File | null) => boolean;
  onRenameItem: (itemId: string, name: string) => void;
  onDeleteItem: (itemId: string) => void;
  onReplaceItemIcon: (itemId: string, file: File) => void;
  openedValidatedChapterIds: string[];
  onToggleValidatedChapterVisibility: (chapterId: string) => void;
  openedValidatedPartIds: string[];
  onToggleValidatedPartVisibility: (partId: string) => void;
  onStatusMessage: (message: string) => void;
}

export function AuthorStudioProjectPanel({
  activeSection,
  project,
  setProject,
  canEdit,
  newVariableName,
  onNewVariableNameChange,
  onAddVariable,
  onDeleteVariable,
  onAddBlock,
  assetPreviewSrcById,
  getAssetFileName,
  onCreateItem,
  onRenameItem,
  onDeleteItem,
  onReplaceItemIcon,
  openedValidatedChapterIds,
  onToggleValidatedChapterVisibility,
  openedValidatedPartIds,
  onToggleValidatedPartVisibility,
  onStatusMessage,
}: AuthorStudioProjectPanelProps) {
  const [newItemName, setNewItemName] = useState("");
  const [newItemIconFile, setNewItemIconFile] = useState<File | null>(null);
  const [itemIconInputKey, setItemIconInputKey] = useState(0);
  const openedValidatedChapterIdSet = new Set(openedValidatedChapterIds);
  const openedValidatedPartIdSet = new Set(openedValidatedPartIds);
  const validatedChapters = project.chapters.filter((chapter) => chapter.validated);
  const validatedParts = project.parts.filter((part) => part.validated);
  const [expandedChapterIds, setExpandedChapterIds] = useState<string[]>([]);
  const [formatSwitchWarningOpen, setFormatSwitchWarningOpen] = useState(false);
  const [formatSwitchAcknowledged, setFormatSwitchAcknowledged] = useState(false);

  const currentFormat = project.info.format;
  const nextFormat: ProjectFormat = currentFormat === "pc" ? "smartphone" : "pc";
  const canSwitchFormat =
    canEdit && project.chapters.length > 0 && project.chapters.every((chapter) => chapter.validated);

  const confirmFormatSwitch = () => {
    setProject((current) => {
      const timestamp = new Date().toISOString();
      const entry = {
        id: createId("log"),
        memberId: current.activeMemberId,
        timestamp,
        action: "switch_format",
        details: `Bascule du format ${PROJECT_FORMAT_LABELS[current.info.format]} vers ${PROJECT_FORMAT_LABELS[nextFormat]}. Tous les chapitres repassent en non-valide.`,
      };
      return {
        ...current,
        info: { ...current.info, format: nextFormat, updatedAt: timestamp },
        chapters: current.chapters.map((chapter) => ({ ...chapter, validated: false })),
        logs: [entry, ...current.logs].slice(0, 250),
      };
    });
    setFormatSwitchWarningOpen(false);
    setFormatSwitchAcknowledged(false);
    onStatusMessage(`Projet bascule au format ${PROJECT_FORMAT_LABELS[nextFormat]}. Tous les chapitres sont a revalider.`);
  };

  const submitCreateItem = () => {
    const created = onCreateItem(newItemName, newItemIconFile);
    if (!created) return;
    setNewItemName("");
    setNewItemIconFile(null);
    setItemIconInputKey((current) => current + 1);
  };

  return (
    activeSection === "commerce" ? (
      <AuthorStudioCommercePanel project={project} setProject={setProject} canEdit={canEdit} />
    ) : (
    <aside className="panel panel-left">
      {activeSection === "project" && (
      <CollapsibleSection
        storageKey="project-info"
        title="Projet"
        headerExtra={
          <HelpHint title="Identite projet">
            Espace dedie au nommage, au slug et au synopsis de l&apos;histoire en cours.
          </HelpHint>
        }
      >
        <label>
          Titre
          <input
            value={project.info.title}
            onChange={(event) =>
              setProject((current) => ({
                ...current,
                info: {
                  ...current.info,
                  title: event.target.value,
                  slug: toSlug(event.target.value) || current.info.slug,
                  updatedAt: new Date().toISOString(),
                },
              }))
            }
            disabled={!canEdit}
          />
        </label>
        <label>
          Slug
          <input
            value={project.info.slug}
            onChange={(event) =>
              setProject((current) => ({
                ...current,
                info: {
                  ...current.info,
                  slug: toSlug(event.target.value),
                  updatedAt: new Date().toISOString(),
                },
              }))
            }
            disabled={!canEdit}
          />
        </label>
        <label>
          Synopsis
          <textarea
            value={project.info.synopsis}
            onChange={(event) =>
              setProject((current) => ({
                ...current,
                info: {
                  ...current.info,
                  synopsis: event.target.value,
                  updatedAt: new Date().toISOString(),
                },
              }))
            }
            disabled={!canEdit}
            rows={3}
          />
        </label>
      </CollapsibleSection>
      )}

      {activeSection === "chapters" && (
      <CollapsibleSection
        storageKey="project-format"
        title="Format du projet"
        headerExtra={
          <HelpHint title="Format du projet">
            Choisi a la creation, fige ensuite. La bascule ci-dessous cree une nouvelle
            composition (le ratio des scenes change) en gardant tout le texte, les
            branchements et les images existantes -- a toi de retoucher les images qui ne
            conviennent plus au nouveau cadrage.
          </HelpHint>
        }
      >
        <p>Format actuel: <strong>{PROJECT_FORMAT_LABELS[currentFormat]}</strong></p>
        <button
          className="button-secondary"
          disabled={!canSwitchFormat}
          onClick={() => setFormatSwitchWarningOpen(true)}
        >
          Basculer vers {PROJECT_FORMAT_LABELS[nextFormat]}
        </button>
        {!canSwitchFormat && (
          <p className="form-hint">
            {project.chapters.length === 0
              ? "Cree et valide au moins un chapitre pour pouvoir basculer le format."
              : "Valide tous les chapitres avant de pouvoir basculer le format."}
          </p>
        )}
      </CollapsibleSection>
      )}

      {activeSection === "chapters" && (
      <CollapsibleSection
        storageKey="project-validated-chapters"
        title="Chapitres valides"
        headerExtra={
          <HelpHint title="Chapitres archives">
            Liste des chapitres valides. Clique pour les reafficher temporairement sur le
            whiteboard.
          </HelpHint>
        }
      >
        {validatedChapters.length === 0 && validatedParts.length === 0 ? (
          <p className="empty-placeholder">Aucun chapitre ou partie valide pour le moment.</p>
        ) : (
          <ul className="list-compact validated-content-tree">
            {validatedChapters.map((chapter, index) => {
              const isOpen = openedValidatedChapterIdSet.has(chapter.id);
              const isExpanded = expandedChapterIds.includes(chapter.id);
              const chapterParts = validatedParts.filter((part) => part.chapterId === chapter.id);
              return (
                <li key={chapter.id} className="validated-content-entry">
                  <div className="variable-line">
                    <button
                      className="validated-content-toggle"
                      onClick={() =>
                        setExpandedChapterIds((current) =>
                          current.includes(chapter.id)
                            ? current.filter((id) => id !== chapter.id)
                            : [...current, chapter.id],
                        )
                      }
                      aria-expanded={isExpanded}
                    >
                      {chapterParts.length > 0 ? (isExpanded ? "▾" : "▸") : "•"} {index + 1}. {chapter.name}
                    </button>
                    <button
                      className="button-secondary"
                      onClick={() => onToggleValidatedChapterVisibility(chapter.id)}
                    >
                      {isOpen ? "Masquer" : "Ouvrir"}
                    </button>
                  </div>
                  {isExpanded && chapterParts.length > 0 && (
                    <ul className="validated-part-list">
                      {chapterParts.map((part) => (
                        <li key={part.id} className="variable-line">
                          <span>{part.name}</span>
                          <button
                            className="button-secondary"
                            onClick={() => onToggleValidatedPartVisibility(part.id)}
                          >
                            {openedValidatedPartIdSet.has(part.id) ? "Masquer" : "Ouvrir"}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
            {validatedParts
              .filter((part) => !validatedChapters.some((chapter) => chapter.id === part.chapterId))
              .map((part) => (
                <li key={part.id} className="variable-line validated-standalone-part">
                  <span>{part.name}</span>
                  <button
                    className="button-secondary"
                    onClick={() => onToggleValidatedPartVisibility(part.id)}
                  >
                    {openedValidatedPartIdSet.has(part.id) ? "Masquer" : "Ouvrir"}
                  </button>
                </li>
              ))}
          </ul>
        )}
      </CollapsibleSection>
      )}

      {formatSwitchWarningOpen && (
        <div className="confirm-overlay">
          <div className="confirm-modal">
            <h2>Basculer vers {PROJECT_FORMAT_LABELS[nextFormat]}</h2>
            <p>
              Cette action transforme <strong>ce projet</strong> pour le format {PROJECT_FORMAT_LABELS[nextFormat]}.
              Le texte, les branchements, les variables et les images sont conserves tels quels --
              mais le cadrage change, donc certaines images pourront deborder ou paraitre trop
              petites tant qu&apos;elles ne sont pas remplacees.
            </p>
            <p className="confirm-warning">
              Rien n&apos;est sauvegarde automatiquement ailleurs. Si tu veux garder une version du
              projet au format {PROJECT_FORMAT_LABELS[currentFormat]}, exporte un ZIP ou sauvegarde dans le
              cloud maintenant, avant de continuer.
            </p>
            <p className="confirm-warning">
              Tous les chapitres repasseront en non-valide, car ils devront etre revus visuellement
              dans le nouveau format.
            </p>
            <label className="row-inline">
              <input
                type="checkbox"
                checked={formatSwitchAcknowledged}
                onChange={(event) => setFormatSwitchAcknowledged(event.target.checked)}
              />
              <span>J&apos;ai compris et sauvegarde une copie si je le souhaitais.</span>
            </label>
            <div className="confirm-actions">
              <button
                className="button-secondary"
                onClick={() => {
                  setFormatSwitchWarningOpen(false);
                  setFormatSwitchAcknowledged(false);
                }}
              >
                Annuler
              </button>
              <button
                className="button-danger"
                disabled={!formatSwitchAcknowledged}
                onClick={confirmFormatSwitch}
              >
                Confirmer la bascule
              </button>
            </div>
          </div>
        </div>
      )}

      {activeSection === "blocks" && (
      <CollapsibleSection
        storageKey="project-blocks"
        title="Bibliotheque de blocs"
        headerExtra={
          <HelpHint title="Creation de blocs">
            Ajoute les blocs narratifs et gameplay dans le graphe. Tu peux ensuite les relier entre
            eux.
          </HelpHint>
        }
      >
        <div className="block-buttons">
          {BLOCK_LIBRARY_ITEMS.map((item) => (
            <button
              key={item.type}
              className="block-library-button"
              style={{ "--block-color": blockTypeColor(item.type) } as CSSProperties}
              onClick={() => onAddBlock(item.type)}
              disabled={!canEdit}
            >
              <span className="block-library-button-marker" aria-hidden="true" />
              <span>{item.label}</span>
              <span className="block-library-button-add" aria-hidden="true">+</span>
            </button>
          ))}
        </div>
      </CollapsibleSection>
      )}

      {activeSection === "variables" && (
      <CollapsibleSection
        storageKey="project-variables"
        title="Variables globales"
        headerExtra={
          <HelpHint title="Stats et points">
            Definis ici les variables globales (energie, relation, etc.) utilisees par les effets
            des blocs.
          </HelpHint>
        }
      >
        <div className="row-inline">
          <input
            placeholder="Nom variable"
            value={newVariableName}
            onChange={(event) => onNewVariableNameChange(event.target.value)}
            disabled={!canEdit}
          />
          <button className="button-secondary" onClick={onAddVariable} disabled={!canEdit}>
            Ajouter
          </button>
        </div>
        <ul className="list-compact">
          {project.variables.map((variable) => (
            <li key={variable.id}>
              <div className="variable-line">
                <input
                  value={variable.name}
                  onChange={(event) =>
                    setProject((current) => ({
                      ...current,
                      variables: current.variables.map((item) =>
                        item.id === variable.id ? { ...item, name: event.target.value } : item,
                      ),
                      info: {
                        ...current.info,
                        updatedAt: new Date().toISOString(),
                      },
                    }))
                  }
                  disabled={!canEdit}
                />
                <input
                  type="number"
                  value={variable.initialValue}
                  onChange={(event) =>
                    setProject((current) => ({
                      ...current,
                      variables: current.variables.map((item) =>
                        item.id === variable.id
                          ? { ...item, initialValue: normalizeDelta(event.target.value) }
                          : item,
                      ),
                      info: {
                        ...current.info,
                        updatedAt: new Date().toISOString(),
                      },
                    }))
                  }
                  disabled={!canEdit}
                />
                <button
                  className="button-danger"
                  onClick={() => onDeleteVariable(variable.id)}
                  disabled={!canEdit}
                >
                  x
                </button>
              </div>
            </li>
          ))}
        </ul>
      </CollapsibleSection>
      )}

      {activeSection === "items" && (
      <CollapsibleSection
        storageKey="project-items"
        title="Objets histoire"
        headerExtra={
          <HelpHint title="Inventaire">
            Cree les objets reutilisables du projet (nom + image). Ils peuvent etre donnes au
            joueur dans les blocs.
          </HelpHint>
        }
      >
        <div className="row-inline">
          <input
            placeholder="Nom objet"
            value={newItemName}
            onChange={(event) => setNewItemName(event.target.value)}
            disabled={!canEdit}
          />
          <button className="button-secondary" onClick={submitCreateItem} disabled={!canEdit}>
            Ajouter
          </button>
        </div>
        <label>
          Image objet
          <input
            key={itemIconInputKey}
            type="file"
            accept="image/*"
            onChange={(event) => setNewItemIconFile(event.target.files?.[0] ?? null)}
            disabled={!canEdit}
          />
        </label>
        <ul className="list-compact">
          {project.items.length === 0 && (
            <li className="empty-placeholder">
              Cree des objets ici, puis utilise-les dans les blocs de recompense.
            </li>
          )}
          {project.items.map((item) => {
            const iconSrc = assetPreviewSrcById[item.iconAssetId ?? ""];
            return (
              <li key={item.id} className="item-library-row">
                <div className="item-library-thumb">
                  {iconSrc ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={iconSrc} alt={item.name} />
                  ) : (
                    <span>image</span>
                  )}
                </div>
                <div className="item-library-main">
                  <input
                    value={item.name}
                    onChange={(event) => onRenameItem(item.id, event.target.value)}
                    disabled={!canEdit}
                  />
                  <small>{getAssetFileName(item.iconAssetId)}</small>
                </div>
                <div className="item-library-actions">
                  <label className="button-secondary item-upload-button">
                    Image
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (!file) return;
                        onReplaceItemIcon(item.id, file);
                        event.target.value = "";
                      }}
                      disabled={!canEdit}
                    />
                  </label>
                  <button
                    className="button-danger"
                    onClick={() => onDeleteItem(item.id)}
                    disabled={!canEdit}
                  >
                    x
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </CollapsibleSection>
      )}

      {activeSection === "logs" && (
      <CollapsibleSection
        storageKey="project-logs"
        title="Journal"
        defaultCollapsed
        headerExtra={
          <HelpHint title="Historique local">
            Liste les dernieres actions enregistrees sur le projet ouvert.
          </HelpHint>
        }
      >
        <ul className="log-list">
          {project.logs.slice(0, 12).map((entry) => {
            const author =
              project.members.find((member) => member.id === entry.memberId)?.name ?? "unknown";
            return (
              <li key={entry.id}>
                <strong>{entry.action}</strong>
                <p>{entry.details}</p>
                <small>
                  {author} - {new Date(entry.timestamp).toLocaleString("fr-FR")}
                </small>
              </li>
            );
          })}
        </ul>
      </CollapsibleSection>
      )}
    </aside>
    )
  );
}
