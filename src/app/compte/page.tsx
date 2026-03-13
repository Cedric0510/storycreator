"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { usePortalAuth } from "@/components/usePortalAuth";

export default function AccountPage() {
  const router = useRouter();
  const { supabase, authLoading, authUser, platformRole, busy, signOut } = usePortalAuth();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [message, setMessage] = useState("");
  const [actionBusy, setActionBusy] = useState(false);

  const handleChangePassword = async () => {
    if (!supabase || !authUser) {
      setMessage("Connecte-toi pour changer ton mot de passe.");
      return;
    }
    if (newPassword.length < 8) {
      setMessage("Le mot de passe doit contenir au moins 8 caracteres.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setMessage("La confirmation du mot de passe ne correspond pas.");
      return;
    }

    setActionBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
        data: {
          must_change_password: false,
        },
      });
      if (error) {
        setMessage(`Erreur changement mot de passe: ${error.message}`);
        return;
      }
      setNewPassword("");
      setConfirmPassword("");
      setMessage("Mot de passe mis a jour.");
    } finally {
      setActionBusy(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!supabase || !authUser) {
      setMessage("Connecte-toi pour supprimer ton compte.");
      return;
    }
    if (deleteConfirmation.trim().toUpperCase() !== "SUPPRIMER") {
      setMessage('Saisis exactement "SUPPRIMER" pour confirmer.');
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

      const response = await fetch("/api/account/delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-supabase-access-token": session.access_token,
        },
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setMessage(`Erreur suppression compte: ${payload.error ?? "unknown"}`);
        return;
      }

      await signOut();
      router.push("/");
    } finally {
      setActionBusy(false);
    }
  };

  const handleLogout = async () => {
    setActionBusy(true);
    try {
      await signOut();
      router.push("/");
    } finally {
      setActionBusy(false);
    }
  };

  return (
    <main className="portal-root">
      <section className="portal-card">
        <h1>Mon compte</h1>
        <p className="portal-subtitle">Gestion du compte utilisateur.</p>

        {authLoading ? (
          <p>Chargement session...</p>
        ) : !authUser ? (
          <div className="portal-stack">
            <p>Aucun compte connecte.</p>
            <Link className="button-primary" href="/">
              Aller a la connexion
            </Link>
          </div>
        ) : (
          <div className="portal-stack">
            <p>
              Connecte: <strong>{authUser.email ?? authUser.id}</strong>{" "}
              <span className="chip chip-start">{platformRole}</span>
            </p>

            <div className="portal-divider" />

            <h2>Changer le mot de passe</h2>
            <label>
              Nouveau mot de passe
              <input
                type="password"
                placeholder="Minimum 8 caracteres"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
              />
            </label>
            <label>
              Confirmation mot de passe
              <input
                type="password"
                placeholder="Retape le mot de passe"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
              />
            </label>
            <button
              className="button-secondary"
              onClick={() => void handleChangePassword()}
              disabled={busy || actionBusy}
            >
              Changer mon mot de passe
            </button>

            <div className="portal-divider" />
            <button
              className="button-secondary"
              onClick={() => void handleLogout()}
              disabled={busy || actionBusy}
            >
              Se deconnecter
            </button>

            <h2>Supprimer le compte</h2>
            <p className="portal-warning">
              Action irreversible. Saisis <strong>SUPPRIMER</strong> pour confirmer.
            </p>
            <label>
              Confirmation
              <input
                value={deleteConfirmation}
                onChange={(event) => setDeleteConfirmation(event.target.value)}
                placeholder="SUPPRIMER"
              />
            </label>
            <button
              className="button-danger"
              onClick={() => void handleDeleteAccount()}
              disabled={busy || actionBusy}
            >
              Supprimer mon compte
            </button>

            <div className="row-inline">
              <Link className="button-secondary" href="/studio">
                Retour studio
              </Link>
            </div>
          </div>
        )}

        {message && <p className="portal-message">{message}</p>}
      </section>
    </main>
  );
}
