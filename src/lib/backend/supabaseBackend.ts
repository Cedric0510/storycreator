/**
 * Adaptateur Supabase des ports backend.
 *
 * Seul fichier (avec les routes BFF cote serveur) autorise a manipuler le SDK
 * Supabase pour l'auth et les profils. Les composants consomment uniquement
 * les ports (`Backend`) et les types domaine.
 */

import { SupabaseClient, User } from "@supabase/supabase-js";

import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

import {
  AccountPort,
  AdminPort,
  AuthEvent,
  AuthPort,
  Backend,
  CreateUserInput,
  RoleFetchOutcome,
} from "./ports";
import {
  AuthorUser,
  BackendResult,
  PlatformProfile,
  PlatformRole,
  errorKindFromHttpStatus,
  fail,
  normalizePlatformRole,
  ok,
} from "./types";

function toAuthorUser(user: User | null): AuthorUser | null {
  if (!user) return null;
  const metadata = (user.user_metadata ?? {}) as Record<string, unknown>;
  return {
    id: user.id,
    email: user.email ?? null,
    mustChangePassword: Boolean(metadata.must_change_password),
  };
}

function toAuthEvent(event: string): AuthEvent {
  if (event === "INITIAL_SESSION") return "initial";
  if (event === "SIGNED_IN") return "signed_in";
  if (event === "SIGNED_OUT") return "signed_out";
  if (event === "TOKEN_REFRESHED") return "token_refreshed";
  if (event === "PASSWORD_RECOVERY") return "password_recovery";
  return "other";
}

function createAuthPort(client: SupabaseClient): AuthPort {
  return {
    async getCurrentUser() {
      const { data } = await client.auth.getSession();
      return toAuthorUser(data.session?.user ?? null);
    },

    onAuthStateChange(callback) {
      const {
        data: { subscription },
      } = client.auth.onAuthStateChange((event, session) => {
        callback(toAuthorUser(session?.user ?? null), toAuthEvent(event));
      });
      return () => subscription.unsubscribe();
    },

    async signIn(email, password) {
      try {
        const { error } = await client.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) return fail("unauthorized", error.message);
        return ok();
      } catch (err: unknown) {
        return fail("network", err instanceof Error ? err.message : String(err));
      }
    },

    async signUp(email, password) {
      try {
        const { data, error } = await client.auth.signUp({
          email: email.trim(),
          password,
        });
        if (error) return fail("server", error.message);

        // Supabase renvoie un user sans identite quand l'email existe deja.
        const identitiesCount = data.user?.identities?.length ?? 0;
        if (data.user && identitiesCount === 0) {
          return fail(
            "conflict",
            "Ce compte existe deja ou a deja ete cree. Utilise la connexion.",
          );
        }

        return ok({ needsEmailConfirmation: !data.session });
      } catch (err: unknown) {
        return fail("network", err instanceof Error ? err.message : String(err));
      }
    },

    async signOut() {
      try {
        await client.auth.signOut();
      } catch {
        // Best-effort: l'etat local est reinitialise par l'appelant.
      }
    },

    async changePassword(newPassword) {
      try {
        const { error } = await client.auth.updateUser({
          password: newPassword,
          data: { must_change_password: false },
        });
        if (error) return fail("server", error.message);
        return ok();
      } catch (err: unknown) {
        return fail("network", err instanceof Error ? err.message : String(err));
      }
    },

    async requestPasswordReset(email) {
      try {
        const redirectTo =
          typeof window !== "undefined"
            ? `${window.location.origin}/reinitialisation`
            : undefined;
        const { error } = await client.auth.resetPasswordForEmail(
          email.trim(),
          redirectTo ? { redirectTo } : undefined,
        );
        if (error) return fail("server", error.message);
        return ok();
      } catch (err: unknown) {
        return fail("network", err instanceof Error ? err.message : String(err));
      }
    },

    async fetchMyRole(userId): Promise<RoleFetchOutcome> {
      try {
        const { data, error } = await client
          .from("author_profiles")
          .select("platform_role")
          .eq("user_id", userId)
          .maybeSingle();

        if (error) return { status: "error" };
        if (!data) return { status: "missing" };
        return { status: "ok", role: normalizePlatformRole(data.platform_role) };
      } catch {
        return { status: "error" };
      }
    },

    async getAccessToken() {
      try {
        const {
          data: { session },
          error,
        } = await client.auth.refreshSession();
        if (error || !session?.access_token) return null;
        return session.access_token;
      } catch {
        return null;
      }
    },
  };
}

interface BffProfileRow {
  userId: string;
  email: string | null;
  displayName: string;
  platformRole: string;
  createdAt: string;
}

async function callBff<T>(
  auth: AuthPort,
  path: string,
  body?: unknown,
): Promise<BackendResult<T>> {
  const token = await auth.getAccessToken();
  if (!token) {
    return fail("unauthorized", "Session invalide. Reconnecte-toi puis reessaie.");
  }

  try {
    const response = await fetch(path, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-supabase-access-token": token,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    const payload = (await response.json().catch(() => ({}))) as T & { error?: string };
    if (!response.ok) {
      return fail(
        errorKindFromHttpStatus(response.status),
        payload.error ?? `Erreur serveur (HTTP ${response.status}).`,
      );
    }
    return ok(payload);
  } catch (err: unknown) {
    return fail("network", err instanceof Error ? err.message : String(err));
  }
}

function createAdminPort(auth: AuthPort): AdminPort {
  return {
    async listProfiles() {
      const result = await callBff<{ profiles: BffProfileRow[] }>(auth, "/api/admin/list-users");
      if (!result.ok) return result;

      const profiles: PlatformProfile[] = (result.value.profiles ?? []).map((row) => ({
        userId: row.userId,
        email: row.email,
        displayName: row.displayName,
        platformRole: normalizePlatformRole(row.platformRole),
        createdAt: row.createdAt,
      }));
      return ok(profiles);
    },

    async setProfileRole(targetUserId, nextRole) {
      const result = await callBff(auth, "/api/admin/set-role", {
        userId: targetUserId,
        role: nextRole,
      });
      return result.ok ? ok() : result;
    },

    async createUser(input: CreateUserInput) {
      const result = await callBff<{ userId: string }>(auth, "/api/admin/create-user", {
        email: input.email,
        password: input.password,
        role: input.role,
        displayName: input.displayName,
      });
      if (!result.ok) return result;
      return ok({ userId: result.value.userId });
    },

    async deleteUser(targetUserId) {
      const result = await callBff(auth, "/api/admin/delete-user", { userId: targetUserId });
      return result.ok ? ok() : result;
    },
  };
}

function createAccountPort(auth: AuthPort): AccountPort {
  return {
    async deleteMyAccount() {
      const result = await callBff(auth, "/api/account/delete");
      return result.ok ? ok() : result;
    },
  };
}

export function createSupabaseBackend(client: SupabaseClient): Backend {
  const auth = createAuthPort(client);

  // Met en pause le rafraichissement auto des tokens quand l'onglet est cache.
  // startAutoRefresh/stopAutoRefresh (non bloquants) evitent de tenir le verrou
  // interne d'auth Supabase, qui bloquerait les operations utilisateur.
  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        client.auth.startAutoRefresh();
      } else {
        client.auth.stopAutoRefresh();
      }
    });
  }

  return {
    auth,
    admin: createAdminPort(auth),
    account: createAccountPort(auth),
  };
}

let cachedBackend: Backend | null | undefined;

/**
 * Backend unique cote navigateur. Retourne null quand Supabase n'est pas
 * configure (l'app doit rester utilisable en mode degrade).
 */
export function getBrowserBackend(): Backend | null {
  if (cachedBackend !== undefined) return cachedBackend;
  const client = getSupabaseBrowserClient();
  cachedBackend = client ? createSupabaseBackend(client) : null;
  return cachedBackend;
}

export type { PlatformRole };
