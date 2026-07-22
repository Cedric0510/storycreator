import { AccountPort, AdminPort, AssetPort, AuthEvent, AuthPort, Backend, ProjectPort } from "./ports";
import { AuthorUser, BackendResult, CloudAsset, CloudProject, CloudProjectSummary, PlatformProfile, PlatformRole, fail, ok } from "./types";
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
  const fetcher = options.fetcher ?? fetch;
  const api = new CadariumApiClient(options.baseUrl.replace(/\/$/, ""), fetcher);
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
      const result = await authenticatedRequest((token) => api.request<void>("/v1/auth/password", {
        method: "PUT",
        token,
        body: { password: newPassword },
      }));
      if (result.ok && currentAuthor) {
        currentAuthor = { ...currentAuthor, mustChangePassword: false };
        emit("other");
      }
      return result;
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
    async listProfiles() {
      return mapResult(
        await authenticatedRequest((token) => api.request<{ authors: CadariumAuthor[] }>("/v1/admin/authors", { token })),
        (response) => response.authors.map(toPlatformProfile),
      );
    },
    async setProfileRole(targetUserId, nextRole) {
      return authenticatedRequest((token) => api.request<void>(`/v1/admin/authors/${encodeURIComponent(targetUserId)}/role`, {
        method: "PUT",
        token,
        body: { role: nextRole },
      }));
    },
    async createUser(input) {
      return mapResult(
        await authenticatedRequest((token) => api.request<CadariumAuthor>("/v1/admin/authors", { method: "POST", token, body: input })),
        (author) => ({ userId: author.id }),
      );
    },
    async deleteUser(targetUserId) {
      return authenticatedRequest((token) => api.request<void>(`/v1/admin/authors/${encodeURIComponent(targetUserId)}`, { method: "DELETE", token }));
    },
  };

  const account: AccountPort = {
    async deleteMyAccount() {
      const result = await authenticatedRequest((token) => api.request<void>("/v1/account", { method: "DELETE", token }));
      if (result.ok) {
        options.storage.removeItem(tokenKey);
        currentAuthor = null;
        emit("signed_out");
      }
      return result;
    },
  };

  const projects: ProjectPort = {
    async list() {
      return authenticatedRequest(async (token) => {
        const response = await api.request<{ projects: CloudProjectSummary[] }>("/v1/author/projects", { token });
        return response.projects;
      });
    },

    async create<T>(title: string, document: T) {
      return authenticatedRequest((token) => api.request<CloudProject<T>>("/v1/author/projects", {
        method: "POST",
        token,
        body: { title, document },
      }));
    },

    async load<T>(projectId: string) {
      return authenticatedRequest((token) => api.request<CloudProject<T>>(`/v1/author/projects/${encodeURIComponent(projectId)}`, { token }));
    },

    async save<T>(projectId: string, expectedRevision: number, title: string, document: T) {
      return authenticatedRequest((token) => api.request<CloudProject<T>>(`/v1/author/projects/${encodeURIComponent(projectId)}`, {
        method: "PUT",
        token,
        body: { expectedRevision, title, document },
      }));
    },

    async archive(projectId: string) {
      return authenticatedRequest((token) => api.request<void>(`/v1/author/projects/${encodeURIComponent(projectId)}`, { method: "DELETE", token }));
    },
  };

  const assets: AssetPort = {
    async list(projectId) {
      return mapResult(
        await authenticatedRequest((token) => api.request<{ assets: CloudAsset[] }>(`/v1/author/projects/${encodeURIComponent(projectId)}/assets`, { token })),
        (response) => response.assets,
      );
    },

    async upload(projectId, assetId, fileName, blob) {
      const sha256 = await hashBlob(blob);
      const prepared = await authenticatedRequest((token) => api.request<{
        status: "prepared" | "already_ready";
        uploadUrl?: string;
        uploadHeaders?: Record<string, string>;
      }>(`/v1/author/projects/${encodeURIComponent(projectId)}/assets/uploads`, {
        method: "POST",
        token,
        body: { assetId, fileName, contentType: blob.type, sizeBytes: blob.size, sha256 },
      }));
      if (!prepared.ok) return prepared;
      if (prepared.value.status === "prepared") {
        if (!prepared.value.uploadUrl) return fail("server", "URL d'envoi du média absente.");
        try {
          const response = await fetcher(prepared.value.uploadUrl, {
            method: "PUT",
            headers: prepared.value.uploadHeaders,
            body: blob,
          });
          if (!response.ok) return fail("network", "L'envoi du média vers le stockage a échoué.");
        } catch {
          return fail("network", "Le stockage des médias est inaccessible.");
        }
      }
      const completed = await authenticatedRequest((token) => api.request<{ asset: CloudAsset }>(
        `/v1/author/projects/${encodeURIComponent(projectId)}/assets/${encodeURIComponent(assetId)}/complete`,
        { method: "POST", token },
      ));
      return mapResult(completed, (response) => response.asset);
    },

    async download(projectId, assetId) {
      const signed = await authenticatedRequest((token) => api.request<{ url: string }>(
        `/v1/author/projects/${encodeURIComponent(projectId)}/assets/${encodeURIComponent(assetId)}/download`,
        { token },
      ));
      if (!signed.ok) return signed;
      try {
        const response = await fetcher(signed.value.url);
        return response.ok ? ok(await response.blob()) : fail("network", "Téléchargement du média impossible.");
      } catch {
        return fail("network", "Le stockage des médias est inaccessible.");
      }
    },
  };

  async function authenticatedRequest<T>(operation: (token: string) => Promise<T>): Promise<BackendResult<T>> {
    const token = options.storage.getItem(tokenKey);
    if (!token) return fail("unauthorized", "Connecte-toi pour effectuer cette action.");
    try {
      return ok(await operation(token));
    } catch (error) {
      return fromApiError(error);
    }
  }

  return { auth, admin, account, projects, assets };
}

function toAuthorUser(author: CadariumAuthor | null): AuthorUser | null {
  return author ? { id: author.id, email: author.email, mustChangePassword: author.mustChangePassword } : null;
}

function toPlatformProfile(author: CadariumAuthor): PlatformProfile {
  return {
    userId: author.id,
    email: author.email,
    displayName: author.displayName,
    platformRole: author.platformRole,
    createdAt: author.createdAt,
  };
}

function mapResult<T, U>(result: BackendResult<T>, mapper: (value: T) => U): BackendResult<U> {
  return result.ok ? ok(mapper(result.value)) : result;
}

function fromApiError(error: unknown): { ok: false; error: { kind: "invalid_request" | "unauthorized" | "forbidden" | "not_found" | "conflict" | "network" | "server"; message: string } } {
  return error instanceof CadariumApiError
    ? fail(error.kind, error.message)
    : fail("server", "Erreur Cadarium inattendue.");
}

function unavailable<T = void>(message: string): BackendResult<T> {
  return fail("server", message);
}

async function hashBlob(blob: Blob): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", await blob.arrayBuffer());
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
