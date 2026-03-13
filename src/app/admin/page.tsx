"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { PlatformProfileRow, PlatformRole } from "@/components/author-studio-types";
import { usePortalAuth } from "@/components/usePortalAuth";

interface AdminProjectRow {
  id: string;
  title: string;
  updated_at: string;
  owner_id: string;
}

function normalizePlatformRole(value: unknown): PlatformRole {
  if (value === "admin") return "admin";
  if (value === "author") return "author";
  return "reader";
}

export default function AdminPage() {
  const { supabase, authLoading, authUser, platformRole, busy } = usePortalAuth();
  const [message, setMessage] = useState("");
  const [actionBusy, setActionBusy] = useState(false);
  const [profiles, setProfiles] = useState<PlatformProfileRow[]>([]);
  const [projects, setProjects] = useState<AdminProjectRow[]>([]);
  const [createEmail, setCreateEmail] = useState("");
  const [createPassword, setCreatePassword] = useState("");
  const [createRole, setCreateRole] = useState<PlatformRole>("reader");

  const isAdmin = Boolean(authUser && platformRole === "admin");

  const refreshProfiles = useCallback(async () => {
    if (!supabase || !isAdmin) return;
    const { data, error } = await supabase.rpc("platform_list_profiles");
    if (error) {
      setMessage(`Erreur chargement utilisateurs: ${error.message}`);
      return;
    }
    const rows = ((data ?? []) as PlatformProfileRow[]).map((row) => ({
      ...row,
      platform_role: normalizePlatformRole(row.platform_role),
    }));
    setProfiles(rows);
  }, [isAdmin, supabase]);

  const refreshProjects = useCallback(async () => {
    if (!supabase || !isAdmin) return;
    const { data, error } = await supabase
      .from("author_projects")
      .select("id,title,updated_at,owner_id")
      .order("updated_at", { ascending: false })
      .limit(100);
    if (error) {
      setMessage(`Erreur chargement projets: ${error.message}`);
      return;
    }
    setProjects((data ?? []) as AdminProjectRow[]);
  }, [isAdmin, supabase]);

  useEffect(() => {
    if (!isAdmin) return;
    void refreshProfiles();
    void refreshProjects();
  }, [isAdmin, refreshProfiles, refreshProjects]);

  const createUser = async () => {
    if (!supabase || !isAdmin) return;
    const email = createEmail.trim().toLowerCase();
    if (!email || createPassword.length < 8) {
      setMessage("Email + mot de passe provisoire (min 8) requis.");
      return;
    }

    setActionBusy(true);
    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.refreshSession();
      if (sessionError || !session?.access_token) {
        setMessage(`Session invalide: ${sessionError?.message ?? "reconnecte-toi"}`);
        return;
      }

      const response = await fetch("/api/admin/create-user", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-supabase-access-token": session.access_token,
        },
        body: JSON.stringify({
          email,
          password: createPassword,
          role: createRole,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setMessage(`Erreur creation utilisateur: ${payload.error ?? "unknown"}`);
        return;
      }

      setCreateEmail("");
      setCreatePassword("");
      setCreateRole("reader");
      await refreshProfiles();
      setMessage("Utilisateur cree.");
    } finally {
      setActionBusy(false);
    }
  };

  const setRole = async (userId: string, role: PlatformRole) => {
    if (!supabase || !isAdmin) return;
    setActionBusy(true);
    try {
      const { data, error } = await supabase.rpc("platform_set_profile_role", {
        target_user: userId,
        next_role: role,
      });
      if (error || !data) {
        setMessage(`Erreur mise a jour role: ${error?.message ?? "operation refusee"}`);
        return;
      }
      await refreshProfiles();
      setMessage(`Role mis a jour: ${role}.`);
    } finally {
      setActionBusy(false);
    }
  };

  const deleteUser = async (userId: string) => {
    if (!supabase || !isAdmin) return;
    setActionBusy(true);
    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.refreshSession();
      if (sessionError || !session?.access_token) {
        setMessage(`Session invalide: ${sessionError?.message ?? "reconnecte-toi"}`);
        return;
      }

      const response = await fetch("/api/admin/delete-user", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-supabase-access-token": session.access_token,
        },
        body: JSON.stringify({ userId }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setMessage(`Erreur suppression utilisateur: ${payload.error ?? "unknown"}`);
        return;
      }

      await refreshProfiles();
      await refreshProjects();
      setMessage("Utilisateur supprime.");
    } finally {
      setActionBusy(false);
    }
  };

  const deleteProject = async (projectId: string) => {
    if (!supabase || !isAdmin) return;
    setActionBusy(true);
    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.refreshSession();
      if (sessionError || !session?.access_token) {
        setMessage(`Session invalide: ${sessionError?.message ?? "reconnecte-toi"}`);
        return;
      }

      const response = await fetch("/api/admin/delete-project", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-supabase-access-token": session.access_token,
        },
        body: JSON.stringify({ projectId }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setMessage(`Erreur suppression projet: ${payload.error ?? "unknown"}`);
        return;
      }

      await refreshProjects();
      setMessage("Projet supprime.");
    } finally {
      setActionBusy(false);
    }
  };

  return (
    <main className="portal-root">
      <section className="portal-card portal-card-wide">
        <h1>Administration</h1>
        <p className="portal-subtitle">Gestion utilisateurs et base de projets.</p>

        {authLoading ? (
          <p>Chargement session...</p>
        ) : !authUser ? (
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
                  void refreshProfiles();
                  void refreshProjects();
                }}
                disabled={busy || actionBusy}
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
            <button className="button-primary button-brand-blue" onClick={() => void createUser()} disabled={busy || actionBusy}>
              Creer utilisateur
            </button>

            <div className="portal-divider" />

            <h2>Utilisateurs</h2>
            {profiles.length === 0 ? (
              <p className="empty-placeholder">Aucun utilisateur charge.</p>
            ) : (
              <ul className="list-compact">
                {profiles.map((profile) => (
                  <li key={profile.user_id} className="cloud-project-row">
                    <div>
                      <strong>{profile.display_name}</strong>
                      <small>{profile.email ?? profile.user_id}</small>
                    </div>
                    <div className="row-inline">
                      <span className="chip chip-start">{profile.platform_role}</span>
                      <button
                        className="button-secondary button-small"
                        onClick={() => void setRole(profile.user_id, "reader")}
                        disabled={busy || actionBusy || profile.platform_role === "reader"}
                      >
                        reader
                      </button>
                      <button
                        className="button-secondary button-small"
                        onClick={() => void setRole(profile.user_id, "author")}
                        disabled={busy || actionBusy || profile.platform_role === "author"}
                      >
                        author
                      </button>
                      <button
                        className="button-secondary button-small"
                        onClick={() => void setRole(profile.user_id, "admin")}
                        disabled={busy || actionBusy || profile.platform_role === "admin"}
                      >
                        admin
                      </button>
                      <button
                        className="button-danger button-small"
                        onClick={() => void deleteUser(profile.user_id)}
                        disabled={busy || actionBusy}
                      >
                        Supprimer
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <div className="portal-divider" />

            <h2>Projets</h2>
            {projects.length === 0 ? (
              <p className="empty-placeholder">Aucun projet charge.</p>
            ) : (
              <ul className="list-compact">
                {projects.map((project) => (
                  <li key={project.id} className="cloud-project-row">
                    <div>
                      <strong>{project.title}</strong>
                      <small>{project.id}</small>
                      <small>{new Date(project.updated_at).toLocaleString("fr-FR")}</small>
                    </div>
                    <div className="row-inline">
                      <button
                        className="button-danger button-small"
                        onClick={() => void deleteProject(project.id)}
                        disabled={busy || actionBusy}
                      >
                        Supprimer
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {message && <p className="portal-message">{message}</p>}
      </section>
    </main>
  );
}
