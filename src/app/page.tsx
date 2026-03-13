"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { usePortalAuth } from "@/components/usePortalAuth";
import { allowSelfSignup } from "@/lib/runtimeFlags";

const INTRO_VIDEO_SRC = "/ui-assets/video/ok.mp4";

export default function Home() {
  const router = useRouter();
  const { authLoading, authUser, platformRole, busy, signInWithPassword } = usePortalAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [introDone, setIntroDone] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const playPromise = video.play();
    if (playPromise && typeof playPromise.catch === "function") {
      playPromise.catch(() => {
        setIntroDone(true);
      });
    }
  }, []);

  const handleLogin = async () => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !password) {
      setMessage("Email et mot de passe requis.");
      return;
    }
    const result = await signInWithPassword(cleanEmail, password);
    if (!result.ok) {
      setMessage(`Erreur connexion: ${result.error}`);
      return;
    }
    setMessage("Connexion reussie.");
    router.push("/studio");
  };

  return (
    <main className="portal-root portal-root-video">
      <video
        ref={videoRef}
        className="portal-intro-video"
        src={INTRO_VIDEO_SRC}
        autoPlay
        muted
        playsInline
        preload="auto"
        onEnded={() => setIntroDone(true)}
        onError={() => setIntroDone(true)}
      />
      <div className={`portal-video-overlay${introDone ? " portal-video-overlay-visible" : ""}`} />
      <section className={`portal-card portal-card-intro portal-crystal-card portal-login-card${introDone ? " portal-card-visible" : ""}`}>
        {authLoading ? (
          <p>Chargement session...</p>
        ) : authUser ? (
          <div className="portal-stack">
            <p>
              Connecte: <strong>{authUser.email ?? authUser.id}</strong>{" "}
              <span className="chip chip-start">{platformRole}</span>
            </p>
            <div className="row-inline">
              <button
                className="button-primary"
                onClick={() => router.push("/studio")}
                disabled={busy}
              >
                Ouvrir le studio
              </button>
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
                placeholder="********"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void handleLogin();
                  }
                }}
              />
            </label>
            <div className="row-inline">
              <button className="button-primary" onClick={() => void handleLogin()} disabled={busy}>
                Se connecter
              </button>
              <Link className="button-secondary" href="/inscription">
                Creer un compte
              </Link>
            </div>
            {!allowSelfSignup && (
              <small>
                L&apos;inscription automatique est desactivee sur cette instance.
              </small>
            )}
          </div>
        )}

        {message && <p className="portal-message">{message}</p>}
      </section>
    </main>
  );
}
