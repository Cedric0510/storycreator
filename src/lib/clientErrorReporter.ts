/**
 * Rapporteur d'erreurs navigateur.
 *
 * Capture les erreurs JS non gerees et les rejets de promesses, et les envoie
 * a /api/client-log pour qu'elles apparaissent dans les logs serveur (Vercel).
 * Actif uniquement en production reelle: en dev la console suffit, et le mode
 * backend fake (tests) ne doit rien envoyer.
 *
 * Garde-fous: deduplication par message, plafond d'envois par session, envoi
 * best-effort (sendBeacon, sinon fetch keepalive) — ne doit jamais degrader
 * l'application elle-meme.
 */

const MAX_REPORTS_PER_SESSION = 10;

let installed = false;
let reportCount = 0;
const reportedKeys = new Set<string>();

function reportingEnabled(): boolean {
  if (typeof window === "undefined") return false;
  if (process.env.NODE_ENV !== "production") return false;
  if (process.env.NEXT_PUBLIC_BACKEND_MODE === "fake") return false;
  return true;
}

function post(body: string): void {
  try {
    const blob = new Blob([body], { type: "application/json" });
    if (navigator.sendBeacon?.("/api/client-log", blob)) return;
    void fetch("/api/client-log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {});
  } catch {
    // Le rapporteur ne doit jamais casser l'app.
  }
}

export function reportClientError(
  kind: string,
  message: string,
  stack?: string,
  digest?: string,
): void {
  if (!reportingEnabled()) return;
  if (reportCount >= MAX_REPORTS_PER_SESSION) return;

  const key = `${kind}:${message}`;
  if (reportedKeys.has(key)) return;
  reportedKeys.add(key);
  reportCount += 1;

  post(
    JSON.stringify({
      kind,
      message,
      stack,
      digest,
      url: window.location.href,
      userAgent: navigator.userAgent,
    }),
  );
}

export function installClientErrorReporter(): void {
  if (installed || !reportingEnabled()) return;
  installed = true;

  window.addEventListener("error", (event) => {
    reportClientError("window-error", event.message || "Erreur script", event.error?.stack);
  });

  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason as { message?: string; stack?: string } | undefined;
    reportClientError(
      "unhandled-rejection",
      reason?.message ?? String(event.reason ?? "Rejet non gere"),
      reason?.stack,
    );
  });
}
