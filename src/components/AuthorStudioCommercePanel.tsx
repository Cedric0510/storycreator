import { Dispatch, SetStateAction, useMemo, useState } from "react";
import { normalizeCommerceCatalog } from "@/lib/commerce";
import { createId, ProjectMeta } from "@/lib/story";

interface AuthorStudioCommercePanelProps {
  project: ProjectMeta;
  setProject: Dispatch<SetStateAction<ProjectMeta>>;
  canEdit: boolean;
}

export function AuthorStudioCommercePanel({
  project,
  setProject,
  canEdit,
}: AuthorStudioCommercePanelProps) {
  const [name, setName] = useState("");
  const [storeId, setStoreId] = useState("");
  const catalog = useMemo(
    () => normalizeCommerceCatalog(project.commerce, project.chapters),
    [project.chapters, project.commerce],
  );
  const validStoreId = /^[a-z0-9][a-z0-9._]*$/.test(storeId);

  const updateCatalog = (products: typeof catalog.products) => {
    setProject((current) => ({
      ...current,
      commerce: { products },
      info: { ...current.info, updatedAt: new Date().toISOString() },
    }));
  };

  const addProduct = () => {
    const cleanStoreId = storeId.trim();
    if (!name.trim() || !validStoreId) return;
    if (catalog.products.some((product) => product.googlePlayProductId === cleanStoreId)) return;
    updateCatalog([
      ...catalog.products,
      {
        id: createId("product"),
        name: name.trim(),
        googlePlayProductId: cleanStoreId,
        chapterIds: [],
      },
    ]);
    setName("");
    setStoreId("");
  };

  return (
    <aside className="panel panel-left commerce-panel">
      <section className="panel-section">
        <h2>Monétisation</h2>
        <p className="form-hint">
          Un chapitre sans produit reste gratuit. Un même produit peut débloquer un chapitre ou un pack.
        </p>
        <label>
          Nom du produit
          <input value={name} onChange={(event) => setName(event.target.value)} disabled={!canEdit} />
        </label>
        <label>
          Identifiant Google Play
          <input
            value={storeId}
            onChange={(event) => setStoreId(event.target.value.trim().toLowerCase())}
            placeholder="cadarium.chapitre.4"
            disabled={!canEdit}
          />
        </label>
        {storeId && !validStoreId && (
          <p className="form-hint">Utilise uniquement des minuscules, chiffres, points et underscores.</p>
        )}
        <button
          className="button-secondary"
          onClick={addProduct}
          disabled={!canEdit || !name.trim() || !validStoreId}
        >
          Ajouter le produit
        </button>
      </section>

      {catalog.products.map((product) => (
        <section className="panel-section commerce-product" key={product.id}>
          <div className="variable-line">
            <strong>{product.name}</strong>
            <button
              className="button-danger"
              onClick={() => updateCatalog(catalog.products.filter((item) => item.id !== product.id))}
              disabled={!canEdit}
            >
              x
            </button>
          </div>
          <small>{product.googlePlayProductId}</small>
          {product.chapterIds.length === 0 && (
            <p className="form-hint">Associe au moins un chapitre avant la publication.</p>
          )}
          <div className="commerce-chapter-list">
            {project.chapters.map((chapter) => {
              const checked = product.chapterIds.includes(chapter.id);
              return (
                <label key={chapter.id} className="commerce-chapter-row">
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={!canEdit}
                    onChange={(event) => updateCatalog(catalog.products.map((item) =>
                      item.id === product.id
                        ? {
                            ...item,
                            chapterIds: event.target.checked
                              ? [...item.chapterIds, chapter.id]
                              : item.chapterIds.filter((id) => id !== chapter.id),
                          }
                        : item,
                    ))}
                  />
                  <span>{chapter.name}</span>
                </label>
              );
            })}
          </div>
        </section>
      ))}
    </aside>
  );
}
