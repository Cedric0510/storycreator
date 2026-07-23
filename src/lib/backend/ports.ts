/**
 * Ports du backend: les interfaces que le front consomme, exprimees en
 * vocabulaire domaine. Cadarium et le fake de test fournissent les adaptateurs.
 *
 * Contrat complet (operations, regles metier, erreurs): docs/backend-contract.md
 */

import {
  AuthorUser,
  BackendResult,
  PlatformProfile,
  PlatformRole,
  CloudProject,
  CloudProjectSummary,
  CloudAsset,
} from "./types";

export type AuthEvent =
  | "initial"
  | "signed_in"
  | "signed_out"
  | "token_refreshed"
  /** Session ouverte via un lien de reinitialisation de mot de passe. */
  | "password_recovery"
  | "other";

export type RoleFetchOutcome =
  | { status: "ok"; role: PlatformRole }
  /** Le compte existe mais n'a pas de profil plateforme (cas anormal). */
  | { status: "missing" }
  /** Erreur transitoire (reseau, timeout): l'appelant garde le dernier role connu. */
  | { status: "error" };

export interface SignUpOutcome {
  needsEmailConfirmation: boolean;
}

export interface AuthPort {
  getCurrentUser(): Promise<AuthorUser | null>;
  /** Retourne la fonction de desabonnement. */
  onAuthStateChange(
    callback: (user: AuthorUser | null, event: AuthEvent) => void,
  ): () => void;
  signIn(email: string, password: string): Promise<BackendResult>;
  signUp(email: string, password: string): Promise<BackendResult<SignUpOutcome>>;
  signOut(): Promise<void>;
  changePassword(newPassword: string): Promise<BackendResult>;
  /**
   * Envoie l'email de reinitialisation. Reponse volontairement neutre:
   * succes meme si l'email est inconnu (anti-enumeration de comptes).
   */
  requestPasswordReset(email: string): Promise<BackendResult>;
  fetchMyRole(userId: string): Promise<RoleFetchOutcome>;
  /** Jeton d'acces frais pour authentifier les appels BFF. */
  getAccessToken(): Promise<string | null>;
}

export interface CreateUserInput {
  email: string;
  password: string;
  role: PlatformRole;
  displayName?: string;
}

export interface AdminPort {
  listProfiles(): Promise<BackendResult<PlatformProfile[]>>;
  setProfileRole(targetUserId: string, nextRole: PlatformRole): Promise<BackendResult>;
  createUser(input: CreateUserInput): Promise<BackendResult<{ userId: string }>>;
  deleteUser(targetUserId: string): Promise<BackendResult>;
}

export interface AccountPort {
  deleteMyAccount(): Promise<BackendResult>;
}

export interface ProjectPort {
  list(): Promise<BackendResult<CloudProjectSummary[]>>;
  create<T>(title: string, document: T): Promise<BackendResult<CloudProject<T>>>;
  load<T>(projectId: string): Promise<BackendResult<CloudProject<T>>>;
  save<T>(projectId: string, expectedRevision: number, title: string, document: T): Promise<BackendResult<CloudProject<T>>>;
  archive(projectId: string): Promise<BackendResult>;
}

export interface AssetPort {
  list(projectId: string): Promise<BackendResult<CloudAsset[]>>;
  upload(projectId: string, assetId: string, fileName: string, blob: Blob): Promise<BackendResult<CloudAsset>>;
  download(projectId: string, assetId: string): Promise<BackendResult<Blob>>;
}

export interface Backend {
  auth: AuthPort;
  admin: AdminPort;
  account: AccountPort;
  projects?: ProjectPort;
  assets?: AssetPort;
}
