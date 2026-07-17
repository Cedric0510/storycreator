/**
 * Ports du backend: les interfaces que le front consomme, exprimees en
 * vocabulaire domaine. Chaque backend (Supabase aujourd'hui, backend maison
 * demain, fake en test) fournit un adaptateur qui les implemente.
 *
 * Contrat complet (operations, regles metier, erreurs): docs/backend-contract.md
 */

import {
  AuthorUser,
  BackendResult,
  PlatformProfile,
  PlatformRole,
} from "./types";

export type AuthEvent =
  | "initial"
  | "signed_in"
  | "signed_out"
  | "token_refreshed"
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

export interface Backend {
  auth: AuthPort;
  admin: AdminPort;
  account: AccountPort;
}
