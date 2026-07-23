/**
 * Factory du backend cote navigateur.
 *
 * Choisit l'adaptateur selon l'environnement:
 * - `NEXT_PUBLIC_BACKEND_MODE=fake`: backend en memoire (tests e2e uniquement,
 *   ne jamais definir cette variable en production). Compte seede:
 *   e2e-admin@studio.local / motdepasse-e2e (admin).
 * - `NEXT_PUBLIC_BACKEND_MODE=cadarium`: backend Cadarium
 * - sinon: aucun backend distant
 */

import { createFakeBackend } from "./fakeBackend";
import { Backend } from "./ports";
import { createCadariumBackend } from "./cadariumBackend";

export const E2E_FAKE_ADMIN = {
  email: "e2e-admin@studio.local",
  password: "motdepasse-e2e",
} as const;

let cachedBackend: Backend | null | undefined;

export function getBrowserBackend(): Backend | null {
  if (typeof window === "undefined") return null;
  if (cachedBackend !== undefined) return cachedBackend;

  if (process.env.NEXT_PUBLIC_BACKEND_MODE === "fake") {
    cachedBackend = createFakeBackend({
      seedUsers: [
        { email: E2E_FAKE_ADMIN.email, password: E2E_FAKE_ADMIN.password, role: "admin" },
        { email: "e2e-auteur@studio.local", password: "motdepasse-e2e", role: "author" },
      ],
    });
    return cachedBackend;
  }

  if (process.env.NEXT_PUBLIC_BACKEND_MODE === "cadarium") {
    const baseUrl = process.env.NEXT_PUBLIC_CADARIUM_API_URL?.trim();
    cachedBackend = baseUrl ? createCadariumBackend({ baseUrl, storage: window.localStorage }) : null;
    return cachedBackend;
  }

  cachedBackend = null;
  return cachedBackend;
}
