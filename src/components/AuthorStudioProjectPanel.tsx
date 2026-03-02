import { Dispatch, SetStateAction, useState } from "react";

import { normalizeDelta, toSlug } from "@/components/author-studio-core";
import { HelpHint } from "@/components/HelpHint";
import { BlockType, ProjectMeta, createId } from "@/lib/story";

interface AuthorStudioProjectPanelProps {
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
}

export function AuthorStudioProjectPanel({
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
}: AuthorStudioProjectPanelProps) {
  const [newItemName, setNewItemName] = useState("");
  const [newItemIconFile, setNewItemIconFile] = useState<File | null>(null);
  const [itemIconInputKey, setItemIconInputKey] = useState(0);

  const submitCreateItem = () => {
    const created = onCreateItem(newItemName, newItemIconFile);
    if (!created) return;
    setNewItemName("");
    setNewItemIconFile(null);
    setItemIconInputKey((current) => current + 1);
  };

  const addHeroBaseStat = () => {
    if (!canEdit || project.variables.length === 0) return;
    const fallbackVariableId = project.variables[0]?.id ?? "";
    if (!fallbackVariableId) return;

    setProject((current) => ({
      ...current,
      hero: {
        ...current.hero,
        baseStats: [
          ...current.hero.baseStats,
          { id: createId("hero_stat"), variableId: fallbackVariableId, value: 0 },
        ],
      },
      info: {
        ...current.info,
        updatedAt: new Date().toISOString(),
      },
    }));
  };

  const addHeroNpc = () => {
    if (!canEdit) return;
    setProject((current) => ({
      ...current,
      hero: {
        ...current.hero,
        npcs: [
          ...current.hero.npcs,
          { id: createId("npc"), name: "", lore: "", baseFriendship: 0 },
        ],
      },
      info: {
        ...current.info,
        updatedAt: new Date().toISOString(),
      },
    }));
  };

  const addHeroInventoryItem = () => {
    if (!canEdit || project.items.length === 0) return;
    const fallbackItemId = project.items[0]?.id ?? "";
    if (!fallbackItemId) return;

    setProject((current) => ({
      ...current,
      hero: {
        ...current.hero,
        startingInventory: [
          ...current.hero.startingInventory,
          { id: createId("hero_item"), itemId: fallbackItemId, quantity: 1 },
        ],
      },
      info: {
        ...current.info,
        updatedAt: new Date().toISOString(),
      },
    }));
  };

  return (
    <aside className="panel panel-left">
      <section className="panel-section">
        <div className="title-with-help">
          <h2>Projet</h2>
          <HelpHint title="Identite projet">
            Espace dedie au nommage, au slug et au synopsis de l&apos;histoire en cours.
          </HelpHint>
        </div>
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
      </section>

      <section className="panel-section">
        <div className="title-with-help">
          <h2>Bibliotheque de blocs</h2>
          <HelpHint title="Creation de blocs">
            Ajoute les blocs narratifs et gameplay dans le graphe. Tu peux ensuite les relier entre
            eux.
          </HelpHint>
        </div>
        <div className="block-buttons">
          <button className="button-soft" onClick={() => onAddBlock("title")} disabled={!canEdit}>
            + Ecran titre
          </button>
          <button className="button-soft" onClick={() => onAddBlock("cinematic")} disabled={!canEdit}>
            + Cinematique
          </button>
          <button className="button-soft" onClick={() => onAddBlock("dialogue")} disabled={!canEdit}>
            + Dialogue
          </button>
          <button className="button-soft" onClick={() => onAddBlock("gameplay")} disabled={!canEdit}>
            + Gameplay
          </button>
          <button className="button-soft" onClick={() => onAddBlock("choice")} disabled={!canEdit}>
            + Choix
          </button>
          <button className="button-soft" onClick={() => onAddBlock("hero_profile")} disabled={!canEdit}>
            + Fiche Hero
          </button>
          <button className="button-soft" onClick={() => onAddBlock("npc_profile")} disabled={!canEdit}>
            + Fiche PNJ
          </button>
        </div>
      </section>

      <section className="panel-section">
        <div className="title-with-help">
          <h2>Variables globales</h2>
          <HelpHint title="Stats et points">
            Definis ici les variables globales (energie, relation, etc.) utilisees par les effets
            des blocs.
          </HelpHint>
        </div>
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
      </section>

      <section className="panel-section">
        <div className="title-with-help">
          <h2>Objets histoire</h2>
          <HelpHint title="Inventaire">
            Cree les objets reutilisables du projet (nom + image). Ils peuvent etre donnes au
            joueur dans les blocs.
          </HelpHint>
        </div>
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
      </section>

      <section className="panel-section">
        <div className="title-with-help">
          <h2>Fiche heros</h2>
          <HelpHint title="Profil hero">
            Configure le personnage principal: nom, lore, stats de base, PNJ rencontres et
            inventaire initial.
          </HelpHint>
        </div>
        <label>
          Nom du heros
          <input
            value={project.hero.name}
            onChange={(event) =>
              setProject((current) => ({
                ...current,
                hero: {
                  ...current.hero,
                  name: event.target.value,
                },
                info: {
                  ...current.info,
                  updatedAt: new Date().toISOString(),
                },
              }))
            }
            disabled={!canEdit}
          />
        </label>
        <label>
          Lore du heros
          <textarea
            rows={3}
            value={project.hero.lore}
            onChange={(event) =>
              setProject((current) => ({
                ...current,
                hero: {
                  ...current.hero,
                  lore: event.target.value,
                },
                info: {
                  ...current.info,
                  updatedAt: new Date().toISOString(),
                },
              }))
            }
            disabled={!canEdit}
          />
        </label>

        <div className="effect-list">
          <div className="section-title-row">
            <span>Stats de base</span>
            <button
              className="button-secondary"
              onClick={addHeroBaseStat}
              disabled={!canEdit || project.variables.length === 0}
            >
              + stat
            </button>
          </div>
          {project.hero.baseStats.length === 0 && (
            <small className="empty-placeholder">
              Ajoute les points de depart (energie, relation, etc.).
            </small>
          )}
          {project.hero.baseStats.map((stat) => (
            <div key={stat.id} className="effect-row">
              <select
                value={stat.variableId}
                onChange={(event) =>
                  setProject((current) => ({
                    ...current,
                    hero: {
                      ...current.hero,
                      baseStats: current.hero.baseStats.map((item) =>
                        item.id === stat.id
                          ? { ...item, variableId: event.target.value }
                          : item,
                      ),
                    },
                    info: {
                      ...current.info,
                      updatedAt: new Date().toISOString(),
                    },
                  }))
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
                value={stat.value}
                onChange={(event) =>
                  setProject((current) => ({
                    ...current,
                    hero: {
                      ...current.hero,
                      baseStats: current.hero.baseStats.map((item) =>
                        item.id === stat.id
                          ? { ...item, value: normalizeDelta(event.target.value) }
                          : item,
                      ),
                    },
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
                onClick={() =>
                  setProject((current) => ({
                    ...current,
                    hero: {
                      ...current.hero,
                      baseStats: current.hero.baseStats.filter((item) => item.id !== stat.id),
                    },
                    info: {
                      ...current.info,
                      updatedAt: new Date().toISOString(),
                    },
                  }))
                }
                disabled={!canEdit}
              >
                x
              </button>
            </div>
          ))}
        </div>

        <div className="effect-list">
          <div className="section-title-row">
            <span>PNJ rencontres</span>
            <button className="button-secondary" onClick={addHeroNpc} disabled={!canEdit}>
              + PNJ
            </button>
          </div>
          {project.hero.npcs.length === 0 && (
            <small className="empty-placeholder">Ajoute les PNJ que le heros croisera.</small>
          )}
          {project.hero.npcs.map((npc) => (
            <div key={npc.id} className="choice-card">
              <div className="section-title-row">
                <strong>{npc.name || "PNJ"}</strong>
                <button
                  className="button-danger"
                  onClick={() =>
                    setProject((current) => ({
                      ...current,
                      hero: {
                        ...current.hero,
                        npcs: current.hero.npcs.filter((item) => item.id !== npc.id),
                      },
                      info: {
                        ...current.info,
                        updatedAt: new Date().toISOString(),
                      },
                    }))
                  }
                  disabled={!canEdit}
                >
                  x
                </button>
              </div>
              <label>
                Nom PNJ
                <input
                  value={npc.name}
                  onChange={(event) =>
                    setProject((current) => ({
                      ...current,
                      hero: {
                        ...current.hero,
                        npcs: current.hero.npcs.map((item) =>
                          item.id === npc.id
                            ? { ...item, name: event.target.value }
                            : item,
                        ),
                      },
                      info: {
                        ...current.info,
                        updatedAt: new Date().toISOString(),
                      },
                    }))
                  }
                  disabled={!canEdit}
                />
              </label>
              <label>
                Points amitie de base
                <input
                  type="number"
                  value={npc.baseFriendship}
                  onChange={(event) =>
                    setProject((current) => ({
                      ...current,
                      hero: {
                        ...current.hero,
                        npcs: current.hero.npcs.map((item) =>
                          item.id === npc.id
                            ? { ...item, baseFriendship: normalizeDelta(event.target.value) }
                            : item,
                        ),
                      },
                      info: {
                        ...current.info,
                        updatedAt: new Date().toISOString(),
                      },
                    }))
                  }
                  disabled={!canEdit}
                />
              </label>
              <label>
                Lore PNJ
                <textarea
                  rows={2}
                  value={npc.lore}
                  onChange={(event) =>
                    setProject((current) => ({
                      ...current,
                      hero: {
                        ...current.hero,
                        npcs: current.hero.npcs.map((item) =>
                          item.id === npc.id
                            ? { ...item, lore: event.target.value }
                            : item,
                        ),
                      },
                      info: {
                        ...current.info,
                        updatedAt: new Date().toISOString(),
                      },
                    }))
                  }
                  disabled={!canEdit}
                />
              </label>
            </div>
          ))}
        </div>

        <div className="effect-list">
          <div className="section-title-row">
            <span>Inventaire de base</span>
            <button
              className="button-secondary"
              onClick={addHeroInventoryItem}
              disabled={!canEdit || project.items.length === 0}
            >
              + objet
            </button>
          </div>
          {project.hero.startingInventory.length === 0 && (
            <small className="empty-placeholder">Ajoute les objets que le heros possede au depart.</small>
          )}
          {project.hero.startingInventory.map((entry) => {
            const item = project.items.find((candidate) => candidate.id === entry.itemId) ?? null;
            const iconSrc = assetPreviewSrcById[item?.iconAssetId ?? ""];

            return (
              <div key={entry.id} className="item-library-row">
                <div className="item-library-thumb">
                  {iconSrc ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={iconSrc} alt={item?.name ?? "item"} />
                  ) : (
                    <span>item</span>
                  )}
                </div>
                <div className="item-library-main">
                  <select
                    value={entry.itemId}
                    onChange={(event) =>
                      setProject((current) => ({
                        ...current,
                        hero: {
                          ...current.hero,
                          startingInventory: current.hero.startingInventory.map((itemEntry) =>
                            itemEntry.id === entry.id
                              ? { ...itemEntry, itemId: event.target.value }
                              : itemEntry,
                          ),
                        },
                        info: {
                          ...current.info,
                          updatedAt: new Date().toISOString(),
                        },
                      }))
                    }
                    disabled={!canEdit}
                  >
                    {project.items.map((catalogItem) => (
                      <option key={catalogItem.id} value={catalogItem.id}>
                        {catalogItem.name}
                      </option>
                    ))}
                  </select>
                  <small>{item ? getAssetFileName(item.iconAssetId) : "Objet introuvable"}</small>
                </div>
                <div className="item-library-actions">
                  <input
                    type="number"
                    min={1}
                    value={entry.quantity}
                    onChange={(event) =>
                      setProject((current) => ({
                        ...current,
                        hero: {
                          ...current.hero,
                          startingInventory: current.hero.startingInventory.map((itemEntry) =>
                            itemEntry.id === entry.id
                              ? {
                                  ...itemEntry,
                                  quantity: Math.max(1, Math.floor(normalizeDelta(event.target.value))),
                                }
                              : itemEntry,
                          ),
                        },
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
                    onClick={() =>
                      setProject((current) => ({
                        ...current,
                        hero: {
                          ...current.hero,
                          startingInventory: current.hero.startingInventory.filter(
                            (itemEntry) => itemEntry.id !== entry.id,
                          ),
                        },
                        info: {
                          ...current.info,
                          updatedAt: new Date().toISOString(),
                        },
                      }))
                    }
                    disabled={!canEdit}
                  >
                    x
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="panel-section">
        <div className="title-with-help">
          <h2>Journal</h2>
          <HelpHint title="Historique local">
            Liste les dernieres actions enregistrees sur le projet ouvert.
          </HelpHint>
        </div>
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
      </section>
    </aside>
  );
}
