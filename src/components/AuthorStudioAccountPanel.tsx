import Link from "next/link";

import { CloudProjectSummary, PlatformRole } from "@/lib/backend/types";
import { CollapsibleSection } from "@/components/CollapsibleSection";
import { HelpHint } from "@/components/HelpHint";

interface AuthorStudioAccountPanelProps {
  backendEnabled: boolean;
  authLoading: boolean;
  isAuthenticated: boolean;
  authEmail: string | null;
  platformRole: PlatformRole;
  cloudEnabled: boolean;
  cloudBusy: boolean;
  cloudProjects: CloudProjectSummary[];
  activeCloudProjectId: string | null;
  onSaveCloud: () => void;
  onRefreshCloud: () => void;
  onLoadCloud: (projectId: string) => void;
  onArchiveCloud: (projectId: string) => void;
}

export function AuthorStudioAccountPanel({
  backendEnabled,
  authLoading,
  isAuthenticated,
  authEmail,
  platformRole,
  cloudEnabled,
  cloudBusy,
  cloudProjects,
  activeCloudProjectId,
  onSaveCloud,
  onRefreshCloud,
  onLoadCloud,
  onArchiveCloud,
}: AuthorStudioAccountPanelProps) {
  return (
    <aside className="panel panel-cloud">
      <CollapsibleSection
        storageKey="cloud-connection"
        title="Compte"
        headerExtra={
          <HelpHint title="Compte">
            Etat de la connexion au compte. Les projets se sauvegardent en local
            avec Export ZIP et se reprennent avec Import ZIP.
          </HelpHint>
        }
      >
        {!backendEnabled && (
          <p className="empty-placeholder">
            Le backend Cadarium n&apos;est pas configuré.
          </p>
        )}

        {backendEnabled && authLoading && <p>Chargement session...</p>}

        {backendEnabled && !authLoading && !isAuthenticated && (
          <div className="subsection">
            <p className="empty-placeholder">
              Connecte-toi depuis la page d&apos;accueil pour acceder au studio.
            </p>
            <Link className="button-secondary" href="/">
              Aller a la connexion
            </Link>
          </div>
        )}

        {backendEnabled && !authLoading && isAuthenticated && (
          <div className="subsection">
            <p>
              Connecte: <strong>{authEmail ?? "compte sans email"}</strong>{" "}
              <span className="chip chip-start">{platformRole}</span>
            </p>
            <p className="empty-placeholder">
              {cloudEnabled
                ? "Cadarium Cloud est disponible pour sauvegarder et restaurer tes projets."
                : "Cadarium Cloud est indisponible. Utilise Export ZIP pour conserver une copie locale."}
            </p>
          </div>
        )}
      </CollapsibleSection>

      {cloudEnabled && isAuthenticated && (
        <CollapsibleSection storageKey="cloud-projects" title="Cadarium Cloud">
          <div className="row-inline">
            <button className="button-primary" onClick={onSaveCloud} disabled={cloudBusy}>
              {activeCloudProjectId ? "Sauvegarder" : "Créer la sauvegarde"}
            </button>
            <button className="button-secondary" onClick={onRefreshCloud} disabled={cloudBusy}>
              Actualiser
            </button>
          </div>
          {cloudProjects.length === 0 ? (
            <p className="empty-placeholder">Aucune sauvegarde dans Cadarium Cloud.</p>
          ) : (
            <ul className="cloud-project-list">
              {cloudProjects.map((project) => (
                <li className="cloud-project-row" key={project.id}>
                  <div>
                    <strong>{project.title}</strong>
                    <small>Version {project.revision} · {new Date(project.updatedAt).toLocaleString("fr-FR")}</small>
                  </div>
                  <div className="row-inline">
                    <button className="button-secondary" onClick={() => onLoadCloud(project.id)} disabled={cloudBusy}>
                      {activeCloudProjectId === project.id ? "Recharger" : "Ouvrir"}
                    </button>
                    <button className="button-danger" onClick={() => onArchiveCloud(project.id)} disabled={cloudBusy}>
                      Archiver
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CollapsibleSection>
      )}
    </aside>
  );
}
