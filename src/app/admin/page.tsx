"use client";

import Link from "next/link";
import { useState } from "react";

import { useAuth } from "@/components/useAuth";
import { usePlatformAdmin } from "@/components/usePlatformAdmin";
import { PlatformRole } from "@/lib/backend/types";

export default function AdminPage() {
  const { backend, authLoading, user, isAdmin, busy } = useAuth();
  const [message, setMessage] = useState("");
  const [createEmail, setCreateEmail] = useState("");
  const [createPassword, setCreatePassword] = useState("");
  const [createRole, setCreateRole] = useState<PlatformRole>("reader");

  const {
    profiles,
    adminBusy,
    refreshProfiles,
    setProfileRole,
    createUser,
    deleteUser,
  } = usePlatformAdmin({ backend, enabled: Boolean(user) && isAdmin });

  const handleRefresh = async () => {
    const result = await refreshProfiles();
    if (!result.ok) {
      setMessage(`Erreur chargement utilisateurs: ${result.error.message}`);
    }
  };

  const handleCreateUser = async () => {
    const email = createEmail.trim().toLowerCase();
    if (!email || createPassword.length < 8) {
      setMessage("Email + mot de passe provisoire (min 8) requis.");
      return;
    }

    const result = await createUser({ email, password: createPassword, role: createRole });
    if (!result.ok) {
      setMessage(`Erreur creation utilisateur: ${result.error.message}`);
      return;
    }
    setCreateEmail("");
    setCreatePassword("");
    setCreateRole("reader");
    setMessage("Utilisateur cree.");
  };

  const handleSetRole = async (userId: string, role: PlatformRole) => {
    const result = await setProfileRole(userId, role);
    if (!result.ok) {
      setMessage(`Erreur mise a jour role: ${result.error.message}`);
      return;
    }
    setMessage(`Role mis a jour: ${role}.`);
  };

  const handleDeleteUser = async (userId: string) => {
    const result = await deleteUser(userId);
    if (!result.ok) {
      setMessage(`Erreur suppression utilisateur: ${result.error.message}`);
      return;
    }
    setMessage("Utilisateur supprime.");
  };

  return (
    <main className="portal-root">
      <section className="portal-card portal-card-wide">
        <h1>Administration</h1>
        <p className="portal-subtitle">Gestion des comptes et des roles.</p>

        {authLoading ? (
          <p>Chargement session...</p>
        ) : !user ? (
          <div className="portal-stack">
            <p>Acces refuse: compte non connecte.</p>
            <Link className="button-primary" href="/">
              Aller a la connexion
            </Link>
          </div>
        ) : !isAdmin ? (
          <div className="portal-stack">
            <p>Acces refuse: role admin requis.</p>
            <Link className="button-secondary" href="/studio">
              Retour studio
            </Link>
          </div>
        ) : (
          <div className="portal-stack">
            <div className="row-inline">
              <Link className="button-secondary" href="/studio">
                Retour studio
              </Link>
              <button
                className="button-secondary"
                onClick={() => {
                  void handleRefresh();
                }}
                disabled={busy || adminBusy}
              >
                Refresh
              </button>
            </div>

            <div className="portal-divider" />

            <h2>Creer un compte</h2>
            <label>
              Email
              <input
                type="email"
                value={createEmail}
                onChange={(event) => setCreateEmail(event.target.value)}
                placeholder="utilisateur@studio.com"
              />
            </label>
            <label>
              Mot de passe provisoire
              <input
                type="password"
                value={createPassword}
                onChange={(event) => setCreatePassword(event.target.value)}
                placeholder="Minimum 8 caracteres"
              />
            </label>
            <label>
              Role
              <select
                value={createRole}
                onChange={(event) => setCreateRole(event.target.value as PlatformRole)}
              >
                <option value="reader">reader</option>
                <option value="author">author</option>
                <option value="admin">admin</option>
              </select>
            </label>
            <button className="button-primary button-brand-blue" onClick={() => void handleCreateUser()} disabled={busy || adminBusy}>
              Creer utilisateur
            </button>

            <div className="portal-divider" />

            <h2>Utilisateurs</h2>
            {profiles.length === 0 ? (
              <p className="empty-placeholder">Aucun utilisateur charge.</p>
            ) : (
              <ul className="list-compact">
                {profiles.map((profile) => (
                  <li key={profile.userId} className="cloud-project-row">
                    <div>
                      <strong>{profile.displayName}</strong>
                      <small>{profile.email ?? profile.userId}</small>
                    </div>
                    <div className="row-inline">
                      <span className="chip chip-start">{profile.platformRole}</span>
                      <button
                        className="button-secondary button-small"
                        onClick={() => void handleSetRole(profile.userId, "reader")}
                        disabled={busy || adminBusy || profile.platformRole === "reader"}
                      >
                        reader
                      </button>
                      <button
                        className="button-secondary button-small"
                        onClick={() => void handleSetRole(profile.userId, "author")}
                        disabled={busy || adminBusy || profile.platformRole === "author"}
                      >
                        author
                      </button>
                      <button
                        className="button-secondary button-small"
                        onClick={() => void handleSetRole(profile.userId, "admin")}
                        disabled={busy || adminBusy || profile.platformRole === "admin"}
                      >
                        admin
                      </button>
                      <button
                        className="button-danger button-small"
                        onClick={() => void handleDeleteUser(profile.userId)}
                        disabled={busy || adminBusy}
                      >
                        Supprimer
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <div className="portal-divider" />
            <p className="empty-placeholder">
              La sauvegarde projet en ligne est desactivee sur cette instance. Cette page ne gere
              que les comptes et les roles.
            </p>
          </div>
        )}

        {message && <p className="portal-message">{message}</p>}
      </section>
    </main>
  );
}
