"use client";

import Link from "next/link";
import { useState } from "react";

import { useAuth } from "@/components/useAuth";

export default function ForgotPasswordPage() {
  const { busy, requestPasswordReset } = useAuth();
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);

  const handleRequest = async () => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      setMessage("Saisis l'email de ton compte.");
      return;
    }

    const result = await requestPasswordReset(cleanEmail);
    if (!result.ok) {
      setMessage(`Erreur envoi email: ${result.error.message}`);
      return;
    }

    // Reponse volontairement neutre: ne revele pas si le compte existe.
    setSent(true);
    setMessage(
      "Si un compte existe pour cet email, un lien de reinitialisation vient d'etre envoye. Pense a verifier tes spams.",
    );
  };

  return (
    <main className="portal-root">
      <section className="portal-card">
        <h1>Mot de passe oublie</h1>
        <p className="portal-subtitle">
          Saisis l&apos;email de ton compte pour recevoir un lien de reinitialisation.
        </p>

        <div className="portal-stack">
          <label>
            Email
            <input
              type="email"
              placeholder="auteur@studio.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void handleRequest();
                }
              }}
            />
          </label>
          <div className="row-inline">
            <button
              className="button-primary"
              onClick={() => void handleRequest()}
              disabled={busy || sent}
            >
              {sent ? "Email envoye" : "Envoyer le lien"}
            </button>
            <Link className="button-secondary" href="/">
              Retour connexion
            </Link>
          </div>
        </div>

        {message && <p className="portal-message">{message}</p>}
      </section>
    </main>
  );
}
