/**
 * Types domaine du backend Author Studio.
 *
 * Ces types sont la seule representation du backend qui circule dans les
 * composants React. Les formats techniques ne sortent jamais des adaptateurs.
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

export interface CloudProjectSummary {
  id: string;
  title: string;
  revision: number;
  createdAt: string;
  updatedAt: string;
}

export interface CloudProject<T = unknown> extends CloudProjectSummary {
  document: T;
}

export interface CloudAsset {
  id: string;
  projectId: string;
  assetId: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  sha256: string;
  status: "pending" | "ready";
  createdAt: string;
  updatedAt: string;
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

export function ok(): { ok: true; value: void };
export function ok<T>(value: T): { ok: true; value: T };
export function ok<T>(value?: T): { ok: true; value: T | undefined } {
  return { ok: true, value };
}

/** La branche d'echec est independante de T: assignable a tout BackendResult. */
export function fail(kind: BackendErrorKind, message: string): { ok: false; error: BackendError } {
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
