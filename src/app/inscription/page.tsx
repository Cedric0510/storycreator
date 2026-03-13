"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { usePortalAuth } from "@/components/usePortalAuth";
import { allowSelfSignup } from "@/lib/runtimeFlags";

export default function SignupPage() {
  const router = useRouter();
  const { authLoading, authUser, busy, signUpWithPassword } = usePortalAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");

  const handleSignup = async () => {
    if (!allowSelfSignup) {
      setMessage("L'inscription automatique est desactivee sur cette instance.");
      return;
    }

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !password) {
      setMessage("Email et mot de passe requis.");
      return;
    }
    if (password.length < 8) {
      setMessage("Le mot de passe doit contenir au moins 8 caracteres.");
      return;
    }
    if (password !== confirmPassword) {
      setMessage("La confirmation du mot de passe ne correspond pas.");
      return;
    }

    const result = await signUpWithPassword(cleanEmail, password);
    if (!result.ok) {
      setMessage(`Erreur inscription: ${result.error}`);
      return;
    }

    setMessage(
      result.needsEmailConfirmation
        ? "Compte cree. Verifie ton email de confirmation puis connecte-toi."
        : "Compte cree et connecte.",
    );
    if (!result.needsEmailConfirmation) {
      router.push("/studio");
    }
  };

  return (
    <main className="portal-root">
      <section className="portal-card">
        <h1>Creer un compte</h1>
        <p className="portal-subtitle">
          Inscription auteur. Le role par defaut est lecteur tant qu&apos;un admin ne l&apos;ajuste pas.
        </p>

        {authLoading ? (
          <p>Chargement session...</p>
        ) : authUser ? (
          <div className="portal-stack">
            <p>
              Deja connecte: <strong>{authUser.email ?? authUser.id}</strong>
            </p>
            <div className="row-inline">
              <button className="button-primary" onClick={() => router.push("/studio")}>
                Ouvrir le studio
              </button>
              <Link className="button-secondary" href="/compte">
                Mon compte
              </Link>
            </div>
          </div>
        ) : (
          <div className="portal-stack">
            <label>
              Email
              <input
                type="email"
                placeholder="auteur@studio.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </label>
            <label>
              Mot de passe
              <input
                type="password"
                placeholder="Minimum 8 caracteres"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
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
            <div className="row-inline">
              <button
                className="button-primary"
                onClick={() => void handleSignup()}
                disabled={busy || !allowSelfSignup}
              >
                Creer le compte
              </button>
              <Link className="button-secondary" href="/">
                Retour connexion
              </Link>
            </div>
          </div>
        )}

        {message && <p className="portal-message">{message}</p>}
      </section>
    </main>
  );
}

