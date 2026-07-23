import { Dispatch, SetStateAction, useState, type CSSProperties } from "react";

import { normalizeDelta, toSlug } from "@/components/author-studio-core";
import { CollapsibleSection } from "@/components/CollapsibleSection";
import { HelpHint } from "@/components/HelpHint";
import type { StudioLeftSection } from "@/components/StudioLeftNavigation";
import { BlockType, ProjectMeta, blockTypeColor } from "@/lib/story";
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
}: AuthorStudioProjectPanelProps) {
  const [newItemName, setNewItemName] = useState("");
  const [newItemIconFile, setNewItemIconFile] = useState<File | null>(null);
  const [itemIconInputKey, setItemIconInputKey] = useState(0);
  const openedValidatedChapterIdSet = new Set(openedValidatedChapterIds);
  const validatedChapters = project.chapters.filter((chapter) => chapter.validated);

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
        storageKey="project-validated-chapters"
        title="Chapitres valides"
        headerExtra={
          <HelpHint title="Chapitres archives">
            Liste des chapitres valides. Clique pour les reafficher temporairement sur le
            whiteboard.
          </HelpHint>
        }
      >
        {validatedChapters.length === 0 ? (
          <p className="empty-placeholder">Aucun chapitre valide pour le moment.</p>
        ) : (
          <ul className="list-compact">
            {validatedChapters.map((chapter, index) => {
              const isOpen = openedValidatedChapterIdSet.has(chapter.id);
              return (
                <li key={chapter.id} className="variable-line">
                  <span>
                    {index + 1}. {chapter.name}
                  </span>
                  <button
                    className="button-secondary"
                    onClick={() => onToggleValidatedChapterVisibility(chapter.id)}
                  >
                    {isOpen ? "Masquer" : "Ouvrir"}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </CollapsibleSection>
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
