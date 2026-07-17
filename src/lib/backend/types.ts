/**
 * Types domaine du backend Author Studio.
 *
 * Ces types sont la seule representation du backend qui circule dans les
 * composants React. Les types des SDK (Supabase `User`, rows snake_case...)
 * ne doivent jamais sortir des adaptateurs (`supabaseBackend.ts`).
 *
 * Contrat complet: docs/backend-contract.md
 */

export type PlatformRole = "admin" | "author" | "reader";

export interface AuthorUser {
  id: string;
  email: string | null;
  /** Compte cree par un admin avec mot de passe provisoire non encore change. */
  mustChangePassword: boolean;
}

export interface PlatformProfile {
  userId: string;
  email: string | null;
  displayName: string;
  platformRole: PlatformRole;
  createdAt: string;
}

export type BackendErrorKind =
  | "invalid_request"
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "conflict"
  | "network"
  | "server";

export interface BackendError {
  kind: BackendErrorKind;
  message: string;
}

export type BackendResult<T = void> =
  | { ok: true; value: T }
  | { ok: false; error: BackendError };

export function ok(): BackendResult<void>;
export function ok<T>(value: T): BackendResult<T>;
export function ok<T>(value?: T): BackendResult<T | void> {
  return { ok: true, value: value as T };
}

export function fail<T = void>(kind: BackendErrorKind, message: string): BackendResult<T> {
  return { ok: false, error: { kind, message } };
}

export function normalizePlatformRole(value: unknown): PlatformRole {
  if (value === "admin") return "admin";
  if (value === "author") return "author";
  return "reader";
}

export function errorKindFromHttpStatus(status: number): BackendErrorKind {
  if (status === 400) return "invalid_request";
  if (status === 401) return "unauthorized";
  if (status === 403) return "forbidden";
  if (status === 404) return "not_found";
  if (status === 409) return "conflict";
  return "server";
}
