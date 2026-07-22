import { AccountPort, AdminPort, AuthEvent, AuthPort, Backend } from "./ports";
import { AuthorUser, BackendResult, PlatformRole, fail, ok } from "./types";
import { CadariumApiClient, CadariumApiError } from "./cadariumApiClient";

interface TokenStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

interface CadariumAuthor {
  id: string;
  email: string;
  displayName: string;
  platformRole: PlatformRole;
  mustChangePassword: boolean;
  createdAt: string;
}

interface SignInResponse {
  status: "authenticated";
  token: string;
  expiresAt: string;
  author: CadariumAuthor;
}

export interface CadariumBackendOptions {
  baseUrl: string;
  storage: TokenStorage;
  fetcher?: typeof fetch;
}

const tokenKey = "cadarium-author-session";

export function createCadariumBackend(options: CadariumBackendOptions): Backend {
  const api = new CadariumApiClient(options.baseUrl.replace(/\/$/, ""), options.fetcher);
  const listeners = new Set<(user: AuthorUser | null, event: AuthEvent) => void>();
  let currentAuthor: CadariumAuthor | null = null;

  const emit = (event: AuthEvent) => {
    const user = toAuthorUser(currentAuthor);
    for (const listener of listeners) listener(user, event);
  };

  const authenticate = async (email: string, password: string): Promise<BackendResult> => {
    try {
      const session = await api.request<SignInResponse>("/v1/auth/sign-in", {
        method: "POST",
        body: { email, password },
      });
      options.storage.setItem(tokenKey, session.token);
      currentAuthor = session.author;
      emit("signed_in");
      return ok();
    } catch (error) {
      return fromApiError(error);
    }
  };

  const auth: AuthPort = {
    async getCurrentUser() {
      const token = options.storage.getItem(tokenKey);
      if (!token) return null;
      try {
        const session = await api.request<{ author: CadariumAuthor }>("/v1/auth/session", { token });
        currentAuthor = session.author;
        return toAuthorUser(currentAuthor);
      } catch (error) {
        if (error instanceof CadariumApiError && error.kind === "unauthorized") {
          options.storage.removeItem(tokenKey);
          currentAuthor = null;
          return null;
        }
        return null;
      }
    },

    onAuthStateChange(callback) {
      listeners.add(callback);
      return () => listeners.delete(callback);
    },

    signIn: authenticate,

    async signUp(email, password) {
      try {
        await api.request<CadariumAuthor>("/v1/auth/sign-up", { method: "POST", body: { email, password } });
      } catch (error) {
        return fromApiError(error);
      }
      const signedIn = await authenticate(email, password);
      return signedIn.ok ? ok({ needsEmailConfirmation: false }) : signedIn;
    },

    async signOut() {
      const token = options.storage.getItem(tokenKey);
      try {
        if (token) await api.request<void>("/v1/auth/sign-out", { method: "POST", token });
      } finally {
        options.storage.removeItem(tokenKey);
        currentAuthor = null;
        emit("signed_out");
      }
    },

    async changePassword(newPassword) {
      if (newPassword.length < 8) return fail("invalid_request", "Le mot de passe doit contenir au moins 8 caractères.");
      return unavailable("Le changement de mot de passe Cadarium n'est pas encore disponible.");
    },

    async requestPasswordReset() {
      return unavailable("La réinitialisation par email Cadarium n'est pas encore disponible.");
    },

    async fetchMyRole(userId) {
      if (!currentAuthor) await auth.getCurrentUser();
      if (!currentAuthor) return { status: "error" };
      return currentAuthor.id === userId
        ? { status: "ok", role: currentAuthor.platformRole }
        : { status: "missing" };
    },

    async getAccessToken() {
      return options.storage.getItem(tokenKey);
    },
  };

  const admin: AdminPort = {
    async listProfiles() { return unavailable("L'administration Cadarium n'est pas encore disponible."); },
    async setProfileRole() { return unavailable("L'administration Cadarium n'est pas encore disponible."); },
    async createUser() { return unavailable("L'administration Cadarium n'est pas encore disponible."); },
    async deleteUser() { return unavailable("L'administration Cadarium n'est pas encore disponible."); },
  };

  const account: AccountPort = {
    async deleteMyAccount() { return unavailable("La suppression de compte Cadarium n'est pas encore disponible."); },
  };

  return { auth, admin, account };
}

function toAuthorUser(author: CadariumAuthor | null): AuthorUser | null {
  return author ? { id: author.id, email: author.email, mustChangePassword: author.mustChangePassword } : null;
}

function fromApiError(error: unknown): { ok: false; error: { kind: "invalid_request" | "unauthorized" | "forbidden" | "not_found" | "conflict" | "network" | "server"; message: string } } {
  return error instanceof CadariumApiError
    ? fail(error.kind, error.message)
    : fail("server", "Erreur Cadarium inattendue.");
}

function unavailable<T = void>(message: string): BackendResult<T> {
  return fail("server", message);
}
