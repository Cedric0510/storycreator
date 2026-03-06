import { useState } from "react";
import { User } from "@supabase/supabase-js";

import {
  CloudAccessLevel,
  CloudAccessRow,
  CloudLogRow,
  CloudProfileRow,
  CloudProjectRow,
  PlatformProfileRow,
  PlatformRole,
} from "@/components/author-studio-types";
import { CollapsibleSection } from "@/components/CollapsibleSection";
import { HelpHint } from "@/components/HelpHint";

interface AuthorStudioCloudPanelProps {
  supabaseEnabled: boolean;
  allowSelfSignup: boolean;
  authLoading: boolean;
  authUser: User | null;
  authEmailInput: string;
  authPasswordInput: string;
  platformRole: PlatformRole;
  isPlatformAdmin: boolean;
  onAuthEmailInputChange: (value: string) => void;
  onAuthPasswordInputChange: (value: string) => void;
  onSignIn: () => void;
  onSignUp: () => void;
  onSignOut: () => void;
  ownPasswordInput: string;
  ownPasswordConfirmInput: string;
  accountMustChangePassword: boolean;
  onOwnPasswordInputChange: (value: string) => void;
  onOwnPasswordConfirmInputChange: (value: string) => void;
  onChangeOwnPassword: () => void;
  onRefreshProjects: () => void;
  onSaveProject: () => void;
  onAcquireLock: () => void;
  onReleaseLock: () => void;
  onForceTakeoverLock: () => void;
  cloudBusy: boolean;
  cloudCanWrite: boolean;
  cloudProjectId: string | null;
  cloudAccessLevel: CloudAccessLevel | null;
  cloudProjectUpdatedAt: string | null;
  cloudEditingLockUserId: string | null;
  cloudLockHolderName: string;
  cloudLockHeldByOther: boolean;
  cloudProjects: CloudProjectRow[];
  onOpenProject: (projectId: string) => void;
  onDownloadProjectBundle: (projectId: string) => void;
  onDeleteProject: (projectId: string) => void;
  canEdit: boolean;
  onCleanupLocalOrphanAssetRefs: () => void;
  onCleanupCloudOrphanAssets: () => void;
  cloudCanManageAccess: boolean;
  shareEmailInput: string;
  onShareEmailInputChange: (value: string) => void;
  shareAccessLevel: "read" | "write";
  onShareAccessLevelChange: (value: "read" | "write") => void;
  onGrantAccess: () => void;
  cloudAccessRows: CloudAccessRow[];
  cloudProfiles: Record<string, CloudProfileRow>;
  onRevokeAccess: (userId: string) => void;
  cloudLogs: CloudLogRow[];
  platformProfiles: PlatformProfileRow[];
  adminCreateUserEmailInput: string;
  adminCreateUserPasswordInput: string;
  adminCreateUserRole: PlatformRole;
  onAdminCreateUserEmailInputChange: (value: string) => void;
  onAdminCreateUserPasswordInputChange: (value: string) => void;
  onAdminCreateUserRoleChange: (value: PlatformRole) => void;
  onAdminCreateUser: () => void;
  onRefreshPlatformProfiles: () => void;
  onSetPlatformProfileRole: (userId: string, role: PlatformRole) => void;
}

export function AuthorStudioCloudPanel({
  supabaseEnabled,
  allowSelfSignup,
  authLoading,
  authUser,
  authEmailInput,
  authPasswordInput,
  platformRole,
  isPlatformAdmin,
  onAuthEmailInputChange,
  onAuthPasswordInputChange,
  onSignIn,
  onSignUp,
  onSignOut,
  ownPasswordInput,
  ownPasswordConfirmInput,
  accountMustChangePassword,
  onOwnPasswordInputChange,
  onOwnPasswordConfirmInputChange,
  onChangeOwnPassword,
  onRefreshProjects,
  onSaveProject,
  onAcquireLock,
  onReleaseLock,
  onForceTakeoverLock,
  cloudBusy,
  cloudCanWrite,
  cloudProjectId,
  cloudAccessLevel,
  cloudProjectUpdatedAt,
  cloudEditingLockUserId,
  cloudLockHolderName,
  cloudLockHeldByOther,
  cloudProjects,
  onOpenProject,
  onDownloadProjectBundle,
  onDeleteProject,
  canEdit,
  onCleanupLocalOrphanAssetRefs,
  onCleanupCloudOrphanAssets,
  cloudCanManageAccess,
  shareEmailInput,
  onShareEmailInputChange,
  shareAccessLevel,
  onShareAccessLevelChange,
  onGrantAccess,
  cloudAccessRows,
  cloudProfiles,
  onRevokeAccess,
  cloudLogs,
  platformProfiles,
  adminCreateUserEmailInput,
  adminCreateUserPasswordInput,
  adminCreateUserRole,
  onAdminCreateUserEmailInputChange,
  onAdminCreateUserPasswordInputChange,
  onAdminCreateUserRoleChange,
  onAdminCreateUser,
  onRefreshPlatformProfiles,
  onSetPlatformProfileRole,
}: AuthorStudioCloudPanelProps) {
  const adminCount = platformProfiles.filter((profile) => profile.platform_role === "admin").length;
  const maskEmail = (email: string | null | undefined) => {
    if (!email) return null;
    const [local, domain] = email.split("@");
    if (!local || !domain) return email;
    const head = local.slice(0, 2);
    return `${head}***@${domain}`;
  };
  const displayEmail = (email: string | null | undefined) => {
    if (!email) return null;
    return isPlatformAdmin ? email : maskEmail(email);
  };

  const [pendingDeleteProject, setPendingDeleteProject] = useState<{
    id: string;
    title: string;
  } | null>(null);

  return (
    <aside className="panel panel-cloud">
      <CollapsibleSection
        storageKey="cloud-connection"
        title="Supabase Cloud"
        headerExtra={
          <HelpHint title="Connexion cloud">
            Espace de connexion et sauvegarde en ligne. Depuis ici, tu te connectes, tu
            sauvegardes le projet actif et tu geres le verrou d&apos;edition cloud.
          </HelpHint>
        }
      >
        {!supabaseEnabled && (
          <p className="empty-placeholder">
            Configure `NEXT_PUBLIC_SUPABASE_URL` et `NEXT_PUBLIC_SUPABASE_ANON_KEY` (ou
            `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`).
          </p>
        )}

        {supabaseEnabled && (
          <>
            {authLoading && <p>Chargement session...</p>}

            {!authLoading && !authUser && (
              <div className="subsection">
                <label>
                  Email
                  <input
                    type="email"
                    placeholder="auteur@studio.com"
                    value={authEmailInput ?? ""}
                    onChange={(event) => onAuthEmailInputChange(event.target.value)}
                  />
                </label>
                <label>
                  Mot de passe
                  <input
                    type="password"
                    placeholder="********"
                    value={authPasswordInput ?? ""}
                    onChange={(event) => onAuthPasswordInputChange(event.target.value)}
                  />
                </label>
                <div className="row-inline">
                  <button className="button-secondary" onClick={onSignIn} disabled={cloudBusy}>
                    Se connecter
                  </button>
                  {allowSelfSignup && (
                    <button className="button-secondary" onClick={onSignUp} disabled={cloudBusy}>
                      Creer un compte
                    </button>
                  )}
                </div>
                <small>
                  {allowSelfSignup
                    ? "`Se connecter` n'ouvre que les comptes existants. `Creer un compte` enregistre un nouveau compte (role lecteur par defaut)."
                    : "Inscription desactivee sur cette instance: demande a un admin de creer/activer ton compte, puis utilise `Se connecter`."}
                </small>
              </div>
            )}

            {authUser && (
              <div className="subsection">
                <p>
                  Connecte: <strong>{displayEmail(authUser.email) ?? authUser.id}</strong>{" "}
                  <span className="chip chip-start">{platformRole}</span>
                </p>
                <div className="cloud-auth-actions">
                  <div className="cloud-auth-top-row">
                    <button className="button-secondary" onClick={onSignOut} disabled={cloudBusy}>
                      Se deconnecter
                    </button>
                    <button
                      className="button-secondary"
                      onClick={onRefreshProjects}
                      disabled={cloudBusy}
                    >
                      Refresh liste
                    </button>
                  </div>
                  <button
                    className="button-primary cloud-save-button"
                    onClick={onSaveProject}
                    disabled={cloudBusy || !cloudCanWrite}
                  >
                    {cloudBusy
                      ? "Sauvegarde en cours..."
                      : cloudProjectId
                        ? "Sauvegarder cloud"
                        : "Creer + sauvegarder"}
                  </button>
                  {!cloudCanWrite && (
                    <small className="cloud-save-disabled-hint">
                      Sauvegarde desactivee: verifie que ton compte a le role auteur
                      et que tu as les droits write/owner sur ce projet.
                    </small>
                  )}
                  {cloudProjectId && (
                    <div className="cloud-auth-top-row">
                      <button
                        className="button-secondary"
                        onClick={onAcquireLock}
                        disabled={
                          cloudBusy || !cloudCanWrite || cloudEditingLockUserId === authUser.id
                        }
                      >
                        Prendre verrou cloud
                      </button>
                      <button
                        className="button-secondary"
                        onClick={onReleaseLock}
                        disabled={
                          cloudBusy || !cloudProjectId || cloudEditingLockUserId !== authUser.id
                        }
                      >
                        Liberer verrou cloud
                      </button>
                    </div>
                  )}
                  {cloudProjectId && cloudAccessLevel === "owner" && cloudLockHeldByOther && (
                    <button
                      className="button-danger"
                      onClick={onForceTakeoverLock}
                      disabled={cloudBusy}
                    >
                      Reprendre verrou (owner)
                    </button>
                  )}
                </div>
                {cloudProjectId && (
                  <small>
                    Projet cloud actif: <strong>{cloudProjectId}</strong> ({cloudAccessLevel ?? "none"})
                    {cloudProjectUpdatedAt && (
                      <> - rev. {new Date(cloudProjectUpdatedAt).toLocaleString("fr-FR")}</>
                    )}
                    {cloudEditingLockUserId && <> - lock {cloudLockHolderName}</>}
                  </small>
                )}
                <div className="subsection">
                  <div className="title-with-help">
                    <strong>Securite compte</strong>
                    <HelpHint title="Mot de passe utilisateur">
                      Change ton mot de passe ici. Pour un compte cree par un admin, fais ce
                      changement des la premiere connexion.
                    </HelpHint>
                  </div>
                  {accountMustChangePassword && (
                    <p className="empty-placeholder">
                      Action requise: change ton mot de passe provisoire.
                    </p>
                  )}
                  <label>
                    Nouveau mot de passe
                    <input
                      type="password"
                      placeholder="Minimum 8 caracteres"
                      value={ownPasswordInput ?? ""}
                      onChange={(event) => onOwnPasswordInputChange(event.target.value)}
                    />
                  </label>
                  <label>
                    Confirmation mot de passe
                    <input
                      type="password"
                      placeholder="Retape le mot de passe"
                      value={ownPasswordConfirmInput ?? ""}
                      onChange={(event) => onOwnPasswordConfirmInputChange(event.target.value)}
                    />
                  </label>
                  <button
                    className="button-secondary"
                    onClick={onChangeOwnPassword}
                    disabled={cloudBusy}
                  >
                    Changer mon mot de passe
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </CollapsibleSection>

      <CollapsibleSection
        storageKey="cloud-username"
        title="User name (mail)"
        headerExtra={
          <HelpHint title="Compte actif">
            Affiche le compte actuellement connecte dans le studio. Si rien n&apos;apparait, aucun
            utilisateur n&apos;est connecte.
          </HelpHint>
        }
      >
        <p className="empty-placeholder">{displayEmail(authUser?.email ?? null) ?? "Aucun utilisateur connecte."}</p>
      </CollapsibleSection>

      {authUser && (
        <CollapsibleSection
          storageKey="cloud-projects"
          title="Mes projets cloud"
          headerExtra={
            <HelpHint title="Liste projets">
              Clique &laquo;&nbsp;Ouvrir&nbsp;&raquo; pour charger un projet directement dans
              l&apos;editeur (graphe + images). &laquo;&nbsp;Export&nbsp;&raquo; telecharge un ZIP
              avec le JSON et les images (destine au moteur de jeu, pas a l&apos;editeur).
            </HelpHint>
          }
        >
          <small>Clique Ouvrir pour charger un projet. Les images se chargent automatiquement depuis le cloud.</small>
          {cloudProjects.length === 0 ? (
            <p className="empty-placeholder">
              Aucun projet visible. Clique sur Creer + sauvegarder puis sur Refresh liste.
            </p>
          ) : (
            <ul className="list-compact">
              {cloudProjects.map((item) => {
                const isActive = item.id === cloudProjectId;
                return (
                  <li key={item.id} className={`cloud-project-row${isActive ? " cloud-project-active" : ""}`}>
                    <div>
                      <strong>{item.title}</strong>
                      <small>{new Date(item.updated_at).toLocaleString("fr-FR")}</small>
                    </div>
                    <div className="row-inline">
                      <span className="chip chip-start">{item.access_level}</span>
                      {isActive ? (
                        <span className="chip chip-active">Actif</span>
                      ) : (
                        <button
                          className="button-primary"
                          onClick={() => onOpenProject(item.id)}
                          disabled={cloudBusy}
                        >
                          Ouvrir
                        </button>
                      )}
                      <button
                        className="button-secondary button-small"
                        onClick={() => onDownloadProjectBundle(item.id)}
                        disabled={cloudBusy}
                        title="Exporter un ZIP avec le JSON et les images (pour le moteur de jeu)"
                      >
                        Export
                      </button>
                      {isPlatformAdmin && (
                        <button
                          className="button-danger button-small"
                          onClick={() => setPendingDeleteProject({ id: item.id, title: item.title })}
                          disabled={cloudBusy}
                          title="Supprimer definitivement ce projet (admin)"
                        >
                          Supprimer
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CollapsibleSection>
      )}

      {authUser && isPlatformAdmin && (
        <CollapsibleSection
          storageKey="cloud-admin"
          title="Administration plateforme"
          defaultCollapsed
          headerExtra={
            <HelpHint title="Roles plateforme">
              Zone reservee admin pour promouvoir ou retrograder les comptes entre `reader`,
              `author` et `admin`.
            </HelpHint>
          }
        >
          <div className="row-inline">
            <button
              className="button-secondary"
              onClick={onRefreshPlatformProfiles}
              disabled={cloudBusy}
            >
              Refresh utilisateurs
            </button>
            <small>Total: {platformProfiles.length}</small>
          </div>
          <div className="subsection">
            <div className="title-with-help">
              <strong>Creer un compte utilisateur</strong>
              <HelpHint title="Provisionning comptes">
                Cree directement un compte avec email, mot de passe provisoire et grade
                (reader/author/admin).
              </HelpHint>
            </div>
            <label>
              Email utilisateur
                <input
                  type="email"
                  placeholder="utilisateur@studio.com"
                  value={adminCreateUserEmailInput ?? ""}
                  onChange={(event) => onAdminCreateUserEmailInputChange(event.target.value)}
                />
            </label>
            <label>
              Mot de passe provisoire
                <input
                  type="password"
                  placeholder="Minimum 8 caracteres"
                  value={adminCreateUserPasswordInput ?? ""}
                  onChange={(event) => onAdminCreateUserPasswordInputChange(event.target.value)}
                />
            </label>
            <label>
              Grade initial
              <select
                value={adminCreateUserRole ?? "reader"}
                onChange={(event) => onAdminCreateUserRoleChange(event.target.value as PlatformRole)}
              >
                <option value="reader">reader</option>
                <option value="author">author</option>
                <option value="admin">admin</option>
              </select>
            </label>
            <button className="button-primary" onClick={onAdminCreateUser} disabled={cloudBusy}>
              Creer compte
            </button>
          </div>
          {platformProfiles.length === 0 ? (
            <p className="empty-placeholder">Aucun compte utilisateur trouve.</p>
          ) : (
            <ul className="list-compact">
              {platformProfiles.map((profile) => {
                const isAdmin = profile.platform_role === "admin";
                return (
                  <li key={profile.user_id} className="platform-profile-card">
                    <div className="platform-profile-head">
                      <div>
                        <strong>{profile.display_name}</strong>
                        <small>{displayEmail(profile.email) ?? profile.user_id}</small>
                      </div>
                      <span className={`chip ${isAdmin ? "chip-start" : "chip-warning"}`}>
                        {profile.platform_role}
                      </span>
                    </div>
                    <div className="platform-role-actions">
                      <button
                        className="button-secondary"
                        onClick={() => onSetPlatformProfileRole(profile.user_id, "admin")}
                        disabled={cloudBusy || isAdmin}
                      >
                        Passer admin
                      </button>
                      <button
                        className="button-secondary"
                        onClick={() => onSetPlatformProfileRole(profile.user_id, "author")}
                        disabled={
                          cloudBusy ||
                          profile.platform_role === "author" ||
                          (isAdmin && adminCount <= 1)
                        }
                      >
                        Passer auteur
                      </button>
                      <button
                        className="button-secondary"
                        onClick={() => onSetPlatformProfileRole(profile.user_id, "reader")}
                        disabled={
                          cloudBusy ||
                          profile.platform_role === "reader" ||
                          (isAdmin && adminCount <= 1)
                        }
                      >
                        Passer lecteur
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CollapsibleSection>
      )}

      {isPlatformAdmin && (
        <CollapsibleSection
          storageKey="cloud-maintenance"
          title="Maintenance assets"
          defaultCollapsed
          headerExtra={
            <HelpHint title="Nettoyage">
              Outils admin pour supprimer les references ou fichiers assets inutilises.
              Utiliser apres sauvegarde cloud.
            </HelpHint>
          }
        >
          <p className="empty-placeholder">
            Nettoie les references assets non utilisees et les fichiers cloud orphelins.
          </p>
          <div className="row-inline">
            <button
              className="button-secondary"
              onClick={onCleanupLocalOrphanAssetRefs}
              disabled={!canEdit}
            >
              Nettoyer refs locales
            </button>
            <button
              className="button-secondary"
              onClick={onCleanupCloudOrphanAssets}
              disabled={cloudBusy || !authUser || !cloudProjectId || !cloudCanWrite}
            >
              Nettoyer assets cloud
            </button>
          </div>
          <small>Conseil: fais d&apos;abord une sauvegarde cloud, puis lance la purge cloud.</small>
        </CollapsibleSection>
      )}

      {cloudProjectId && (cloudCanManageAccess || isPlatformAdmin) && (
        <CollapsibleSection
          storageKey="cloud-share"
          title="Partager le projet"
          headerExtra={
            <HelpHint title="Partage projet">
              Invite un collaborateur par email pour qu&apos;il puisse ouvrir le projet.
              Le niveau &laquo;&nbsp;write&nbsp;&raquo; autorise l&apos;edition,
              &laquo;&nbsp;read&nbsp;&raquo; autorise uniquement la consultation.
            </HelpHint>
          }
        >
          {cloudAccessLevel !== "owner" && (
            <p className="empty-placeholder">Seul le owner peut modifier les droits du projet.</p>
          )}

          {cloudCanManageAccess && (
            <div className="subsection">
              <label>
                Email collaborateur
                <input
                  type="email"
                  placeholder="auteur@studio.com"
                  value={shareEmailInput}
                  onChange={(event) => onShareEmailInputChange(event.target.value)}
                />
              </label>
              <label>
                Niveau
                <select
                  value={shareAccessLevel}
                  onChange={(event) => onShareAccessLevelChange(event.target.value as "read" | "write")}
                >
                  <option value="write">write</option>
                  <option value="read">read</option>
                </select>
              </label>
              <button className="button-secondary" onClick={onGrantAccess} disabled={cloudBusy}>
                Donner acces
              </button>
            </div>
          )}

          <ul className="list-compact">
            {cloudAccessRows.map((row) => {
              const profile = cloudProfiles[row.user_id];
              return (
                <li key={row.user_id} className="cloud-access-row">
                  <div>
                    <strong>{profile?.display_name ?? row.user_id}</strong>
                    <small>{displayEmail(profile?.email ?? null) ?? row.user_id}</small>
                  </div>
                  <div className="row-inline">
                    <span className="chip chip-start">{row.access_level}</span>
                    {cloudCanManageAccess && row.access_level !== "owner" && (
                      <button
                        className="button-danger"
                        onClick={() => onRevokeAccess(row.user_id)}
                        disabled={cloudBusy}
                      >
                        Retirer
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </CollapsibleSection>
      )}

      {cloudProjectId && cloudLogs.length > 0 && (
        <CollapsibleSection
          storageKey="cloud-logs"
          title="Logs cloud"
          defaultCollapsed
          headerExtra={
            <HelpHint title="Historique cloud">
              Journal des actions cloud sur le projet courant: ouvertures, sauvegardes, droits et
              verrous.
            </HelpHint>
          }
        >
          <ul className="log-list">
            {cloudLogs.map((entry) => {
              const profile = cloudProfiles[entry.actor_id];
              return (
                <li key={entry.id}>
                  <strong>{entry.action}</strong>
                  <p>{entry.details}</p>
                  <small>
                    {profile?.display_name ?? entry.actor_id} -{" "}
                    {new Date(entry.created_at).toLocaleString("fr-FR")}
                  </small>
                </li>
              );
            })}
          </ul>
        </CollapsibleSection>
      )}

      {pendingDeleteProject && (
        <div className="confirm-overlay">
          <div className="confirm-modal">
            <h2>Supprimer le projet</h2>
            <p>
              Tu es sur le point de supprimer definitivement le projet{" "}
              <strong>{pendingDeleteProject.title}</strong>.
            </p>
            <p className="confirm-warning">
              Cette action est irreversible: toutes les donnees, assets et droits d&apos;acces
              seront supprimes.
            </p>
            <div className="confirm-actions">
              <button
                className="button-secondary"
                onClick={() => setPendingDeleteProject(null)}
                disabled={cloudBusy}
              >
                Annuler
              </button>
              <button
                className="button-danger"
                onClick={() => {
                  onDeleteProject(pendingDeleteProject.id);
                  setPendingDeleteProject(null);
                }}
                disabled={cloudBusy}
              >
                Supprimer definitivement
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
