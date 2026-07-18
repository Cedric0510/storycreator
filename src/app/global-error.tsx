"use client";

import { useEffect } from "react";

import { reportClientError } from "@/lib/clientErrorReporter";

/**
 * Filet de securite ultime: erreur React non rattrapee au rendu.
 * Rapporte l'erreur puis propose de reessayer sans perdre la session.
 * (La sauvegarde automatique locale protege le travail en cours.)
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    reportClientError("react-render", error.message, error.stack, error.digest);
  }, [error]);

  return (
    <html lang="fr">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0b1c2b",
          color: "#e5f1ff",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <main style={{ maxWidth: 460, padding: 24, textAlign: "center" }}>
          <h1 style={{ fontSize: 22, marginBottom: 12 }}>Une erreur est survenue</h1>
          <p style={{ opacity: 0.85, marginBottom: 8 }}>
            L&apos;incident a ete enregistre. Ton travail est conserve par la
            sauvegarde automatique locale.
          </p>
          <p style={{ opacity: 0.6, fontSize: 13, marginBottom: 20 }}>
            {error.digest ? `Reference: ${error.digest}` : null}
          </p>
          <button
            onClick={() => reset()}
            style={{
              padding: "10px 18px",
              borderRadius: 10,
              border: "1px solid #2563eb",
              background: "#1d4ed8",
              color: "#f8fafc",
              fontSize: 15,
              cursor: "pointer",
            }}
          >
            Reessayer
          </button>
        </main>
      </body>
    </html>
  );
}
