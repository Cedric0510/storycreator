"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { useAuth } from "@/components/useAuth";

/**
 * Page cible du lien de reinitialisation envoye par email.
 * L'ouverture du lien etablit une session de recuperation; il ne reste
 * qu'a saisir le nouveau mot de passe.
 */
export default function ResetPasswordPage() {
  const router = useRouter();
  const { authLoading, user, busy, changePassword } = useAuth();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [done, setDone] = useState(false);

  const handleReset = async () => {
    if (newPassword.length < 8) {
      setMessage("Le mot de passe doit contenir au moins 8 caracteres.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setMessage("La confirmation du mot de passe ne correspond pas.");
      return;
    }

    const result = await changePassword(newPassword);
    if (!result.ok) {
      setMessage(`Erreur reinitialisation: ${result.error.message}`);
      return;
    }

    setDone(true);
    setMessage("Mot de passe mis a jour. Tu es connecte.");
  };

  return (
    <main className="portal-root">
      <section className="portal-card">
        <h1>Nouveau mot de passe</h1>

        {authLoading ? (
          <p>Chargement session...</p>
        ) : !user ? (
          <div className="portal-stack">
            <p className="portal-warning">
              Lien invalide ou expire. Redemande un email de reinitialisation.
            </p>
            <div className="row-inline">
              <Link className="button-primary" href="/mot-de-passe-oublie">
                Redemander un lien
              </Link>
              <Link className="button-secondary" href="/">
                Retour connexion
              </Link>
            </div>
          </div>
        ) : done ? (
          <div className="portal-stack">
            <p>Ton mot de passe a ete mis a jour.</p>
            <div className="row-inline">
              <button className="button-primary" onClick={() => router.push("/studio")}>
                Ouvrir le studio
              </button>
            </div>
          </div>
        ) : (
          <div className="portal-stack">
            <p>
              Compte: <strong>{user.email ?? user.id}</strong>
            </p>
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
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void handleReset();
                  }
                }}
              />
            </label>
            <button
              className="button-primary"
              onClick={() => void handleReset()}
              disabled={busy}
            >
              Valider le nouveau mot de passe
            </button>
          </div>
        )}

        {message && <p className="portal-message">{message}</p>}
      </section>
    </main>
  );
}
