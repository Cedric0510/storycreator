/**
 * Backend en memoire implementant le contrat (docs/backend-contract.md).
 *
 * Sert de specification executable: les tests de contrat s'executent contre ce
 * fake, et le meme comportement devra etre observe sur le backend maison.
 * Utilisable aussi pour tester les composants sans reseau.
 */

import {
  AccountPort,
  AdminPort,
  AuthEvent,
  AuthPort,
  Backend,
  CreateUserInput,
} from "./ports";
import {
  AuthorUser,
  BackendError,
  PlatformProfile,
  PlatformRole,
  fail,
  normalizePlatformRole,
  ok,
} from "./types";

interface FakeUserRecord {
  id: string;
  email: string;
  password: string;
  displayName: string;
  platformRole: PlatformRole;
  createdAt: string;
  mustChangePassword: boolean;
  emailConfirmed: boolean;
}

export interface FakeBackendSeedUser {
  email: string;
  password: string;
  role?: PlatformRole;
  displayName?: string;
}

export interface FakeBackend extends Backend {
  /** Etat interne expose pour les assertions de test. */
  inspect: {
    users(): ReadonlyArray<Omit<FakeUserRecord, "password">>;
    currentUserId(): string | null;
  };
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

export interface FakeBackendOptions {
  seedUsers?: FakeBackendSeedUser[];
  allowSelfSignup?: boolean;
}

export function createFakeBackend(options: FakeBackendOptions = {}): FakeBackend {
  const { seedUsers = [], allowSelfSignup = true } = options;

  const users = new Map<string, FakeUserRecord>();
  let currentUserId: string | null = null;
  let nextId = 1;
  const listeners = new Set<(user: AuthorUser | null, event: AuthEvent) => void>();

  function generateId() {
    const id = `fake-user-${nextId}`;
    nextId += 1;
    return id;
  }

  function adminCount() {
    let count = 0;
    for (const user of users.values()) {
      if (user.platformRole === "admin") count += 1;
    }
    return count;
  }

  function displayNameFor(email: string, displayName?: string) {
    const trimmed = (displayName ?? "").trim();
    if (trimmed) return trimmed;
    const [localPart] = email.split("@");
    return localPart || "Auteur";
  }

  /**
   * Regle 1+2 du contrat: provisioning du profil, premier compte = admin.
   */
  function registerUser(input: {
    email: string;
    password: string;
    role?: PlatformRole;
    displayName?: string;
    mustChangePassword?: boolean;
    emailConfirmed?: boolean;
  }): FakeUserRecord {
    const bootstrapAdmin = adminCount() === 0;
    const record: FakeUserRecord = {
      id: generateId(),
      email: input.email.trim().toLowerCase(),
      password: input.password,
      displayName: displayNameFor(input.email, input.displayName),
      platformRole: bootstrapAdmin ? "admin" : input.role ?? "reader",
      createdAt: new Date(Date.now() + nextId).toISOString(),
      mustChangePassword: input.mustChangePassword ?? false,
      emailConfirmed: input.emailConfirmed ?? true,
    };
    users.set(record.id, record);
    return record;
  }

  for (const seed of seedUsers) {
    registerUser({ ...seed, role: seed.role });
  }

  function findByEmail(email: string) {
    const normalized = email.trim().toLowerCase();
    for (const user of users.values()) {
      if (user.email === normalized) return user;
    }
    return null;
  }

  function currentUser(): FakeUserRecord | null {
    if (!currentUserId) return null;
    return users.get(currentUserId) ?? null;
  }

  function toAuthorUser(record: FakeUserRecord | null): AuthorUser | null {
    if (!record) return null;
    return {
      id: record.id,
      email: record.email,
      mustChangePassword: record.mustChangePassword,
    };
  }

  function emit(event: AuthEvent) {
    const user = toAuthorUser(currentUser());
    for (const listener of listeners) {
      listener(user, event);
    }
  }

  const auth: AuthPort = {
    async getCurrentUser() {
      return toAuthorUser(currentUser());
    },

    onAuthStateChange(callback) {
      listeners.add(callback);
      return () => listeners.delete(callback);
    },

    async signIn(email, password) {
      const record = findByEmail(email);
      if (!record || record.password !== password) {
        return fail("unauthorized", "Identifiants invalides.");
      }
      if (!record.emailConfirmed) {
        return fail("unauthorized", "Email non confirme.");
      }
      currentUserId = record.id;
      emit("signed_in");
      return ok();
    },

    async signUp(email, password) {
      if (!allowSelfSignup) {
        return fail("forbidden", "Inscription desactivee sur cette instance.");
      }
      if (!EMAIL_PATTERN.test(email.trim().toLowerCase())) {
        return fail("invalid_request", "Email invalide.");
      }
      if (password.length < MIN_PASSWORD_LENGTH) {
        return fail("invalid_request", "Le mot de passe doit contenir au moins 8 caracteres.");
      }
      if (findByEmail(email)) {
        return fail("conflict", "Ce compte existe deja ou a deja ete cree. Utilise la connexion.");
      }

      const record = registerUser({ email, password, role: "reader" });
      currentUserId = record.id;
      emit("signed_in");
      return ok({ needsEmailConfirmation: false });
    },

    async signOut() {
      currentUserId = null;
      emit("signed_out");
    },

    async changePassword(newPassword) {
      const record = currentUser();
      if (!record) return fail("unauthorized", "Session invalide.");
      if (newPassword.length < MIN_PASSWORD_LENGTH) {
        return fail("invalid_request", "Le mot de passe doit contenir au moins 8 caracteres.");
      }
      record.password = newPassword;
      record.mustChangePassword = false;
      return ok();
    },

    async fetchMyRole(userId) {
      const record = users.get(userId);
      if (!record) return { status: "missing" };
      return { status: "ok", role: record.platformRole };
    },

    async getAccessToken() {
      return currentUserId ? `fake-token-${currentUserId}` : null;
    },
  };

  function requireAdmin():
    | { error: { ok: false; error: BackendError } }
    | { requester: FakeUserRecord } {
    const record = currentUser();
    if (!record) {
      return { error: fail("unauthorized", "Session invalide. Reconnecte-toi puis reessaie.") };
    }
    if (record.platformRole !== "admin") {
      return { error: fail("forbidden", "Acces refuse: reserve aux admins.") };
    }
    return { requester: record };
  }

  const admin: AdminPort = {
    async listProfiles() {
      const guard = requireAdmin();
      if ("error" in guard) return guard.error;

      const profiles: PlatformProfile[] = [...users.values()]
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
        .map((user) => ({
          userId: user.id,
          email: user.email,
          displayName: user.displayName,
          platformRole: user.platformRole,
          createdAt: user.createdAt,
        }));
      return ok(profiles);
    },

    async setProfileRole(targetUserId, nextRole) {
      const guard = requireAdmin();
      if ("error" in guard) return guard.error;

      const normalizedRole = normalizePlatformRole(nextRole);
      const target = users.get(targetUserId);
      if (!target) return fail("not_found", "Utilisateur cible introuvable.");

      // Regle 5: retrograder le dernier admin est refuse.
      if (target.platformRole === "admin" && normalizedRole !== "admin" && adminCount() <= 1) {
        return fail("conflict", "Impossible de retrograder le dernier compte admin.");
      }

      target.platformRole = normalizedRole;
      return ok();
    },

    async createUser(input: CreateUserInput) {
      const guard = requireAdmin();
      if ("error" in guard) return guard.error;

      const email = input.email.trim().toLowerCase();
      if (!EMAIL_PATTERN.test(email)) return fail("invalid_request", "Email invalide.");
      if (input.password.length < MIN_PASSWORD_LENGTH) {
        return fail(
          "invalid_request",
          "Le mot de passe provisoire doit contenir au moins 8 caracteres.",
        );
      }
      if (findByEmail(email)) {
        return fail("conflict", "Un compte existe deja pour cet email.");
      }

      // Regle 10: compte pre-confirme avec mot de passe provisoire a changer.
      const record = registerUser({
        email,
        password: input.password,
        role: input.role,
        displayName: input.displayName,
        mustChangePassword: true,
        emailConfirmed: true,
      });
      return ok({ userId: record.id });
    },

    async deleteUser(targetUserId) {
      const guard = requireAdmin();
      if ("error" in guard) return guard.error;

      // Regle 7: un admin ne se supprime pas via la route admin.
      if (targetUserId === guard.requester.id) {
        return fail("conflict", "Utilise la page Compte pour supprimer ton propre compte.");
      }

      const target = users.get(targetUserId);
      if (!target) return fail("not_found", "Utilisateur cible introuvable.");

      // Regle 6: jamais supprimer le dernier admin.
      if (target.platformRole === "admin" && adminCount() <= 1) {
        return fail("conflict", "Impossible de supprimer le dernier compte admin.");
      }

      users.delete(targetUserId);
      return ok();
    },
  };

  const account: AccountPort = {
    async deleteMyAccount() {
      const record = currentUser();
      if (!record) return fail("unauthorized", "Session invalide. Reconnecte-toi puis reessaie.");

      // Regle 6: jamais supprimer le dernier admin.
      if (record.platformRole === "admin" && adminCount() <= 1) {
        return fail("conflict", "Impossible de supprimer le dernier compte admin.");
      }

      users.delete(record.id);
      currentUserId = null;
      emit("signed_out");
      return ok();
    },
  };

  return {
    auth,
    admin,
    account,
    inspect: {
      users() {
        return [...users.values()].map((user) => ({
          id: user.id,
          email: user.email,
          displayName: user.displayName,
          platformRole: user.platformRole,
          createdAt: user.createdAt,
          mustChangePassword: user.mustChangePassword,
          emailConfirmed: user.emailConfirmed,
        }));
      },
      currentUserId() {
        return currentUserId;
      },
    },
  };
}
