/**
 * Tests de contrat backend (docs/backend-contract.md).
 *
 * La suite s'execute contre le fake en memoire, qui sert de specification
 * executable. Le futur backend maison devra passer exactement la meme suite
 * (via un adaptateur d'integration branche sur `runBackendContractSuite`).
 */

import { beforeEach, describe, expect, it } from "vitest";

import { Backend } from "./ports";
import { createFakeBackend, FakeBackend } from "./fakeBackend";

interface ContractHarness {
  backend: Backend;
  /** Connecte un admin pret a l'emploi et retourne son id. */
  signInAsAdmin(): Promise<string>;
}

export function runBackendContractSuite(makeHarness: () => Promise<ContractHarness>) {
  describe("auth", () => {
    it("connecte un utilisateur avec les bons identifiants", async () => {
      const { backend, signInAsAdmin } = await makeHarness();
      await signInAsAdmin();
      const user = await backend.auth.getCurrentUser();
      expect(user).not.toBeNull();
    });

    it("refuse des identifiants invalides", async () => {
      const { backend } = await makeHarness();
      const result = await backend.auth.signIn("inconnu@studio.com", "mauvais-mdp");
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.kind).toBe("unauthorized");
    });

    it("refuse une inscription sur un email deja pris (regle 8)", async () => {
      const { backend, signInAsAdmin } = await makeHarness();
      await signInAsAdmin();
      const admin = await backend.auth.getCurrentUser();
      await backend.auth.signOut();

      const result = await backend.auth.signUp(admin!.email!, "nouveaumdp123");
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.kind).toBe("conflict");
    });

    it("refuse un mot de passe trop court au changement (regle 9)", async () => {
      const { backend, signInAsAdmin } = await makeHarness();
      await signInAsAdmin();
      const result = await backend.auth.changePassword("court");
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.kind).toBe("invalid_request");
    });

    it("efface le flag must_change_password apres changement (regle 10)", async () => {
      const { backend, signInAsAdmin } = await makeHarness();
      await signInAsAdmin();

      const created = await backend.admin.createUser({
        email: "provisoire@studio.com",
        password: "motdepasse-temporaire",
        role: "author",
      });
      expect(created.ok).toBe(true);

      await backend.auth.signOut();
      await backend.auth.signIn("provisoire@studio.com", "motdepasse-temporaire");
      let user = await backend.auth.getCurrentUser();
      expect(user?.mustChangePassword).toBe(true);

      const changed = await backend.auth.changePassword("motdepasse-definitif");
      expect(changed.ok).toBe(true);
      user = await backend.auth.getCurrentUser();
      expect(user?.mustChangePassword).toBe(false);
    });
  });

  describe("roles et profils", () => {
    it("attribue le role reader par defaut a l'inscription (regle 3)", async () => {
      const { backend, signInAsAdmin } = await makeHarness();
      await signInAsAdmin();
      await backend.auth.signOut();

      const result = await backend.auth.signUp("nouveau@studio.com", "motdepasse123");
      expect(result.ok).toBe(true);

      const user = await backend.auth.getCurrentUser();
      const outcome = await backend.auth.fetchMyRole(user!.id);
      expect(outcome).toEqual({ status: "ok", role: "reader" });
    });

    it("liste les profils uniquement pour un admin", async () => {
      const { backend, signInAsAdmin } = await makeHarness();
      await signInAsAdmin();
      await backend.auth.signOut();
      await backend.auth.signUp("lecteur@studio.com", "motdepasse123");

      const denied = await backend.admin.listProfiles();
      expect(denied.ok).toBe(false);
      if (!denied.ok) expect(denied.error.kind).toBe("forbidden");

      await backend.auth.signOut();
      await signInAsAdmin();
      const allowed = await backend.admin.listProfiles();
      expect(allowed.ok).toBe(true);
      if (allowed.ok) expect(allowed.value.length).toBeGreaterThanOrEqual(2);
    });

    it("change un role via un admin (regle 5)", async () => {
      const { backend, signInAsAdmin } = await makeHarness();
      await signInAsAdmin();

      const created = await backend.admin.createUser({
        email: "futur-auteur@studio.com",
        password: "motdepasse123",
        role: "reader",
      });
      expect(created.ok).toBe(true);
      if (!created.ok) return;

      const promoted = await backend.admin.setProfileRole(created.value.userId, "author");
      expect(promoted.ok).toBe(true);

      const outcome = await backend.auth.fetchMyRole(created.value.userId);
      expect(outcome).toEqual({ status: "ok", role: "author" });
    });

    it("refuse de retrograder le dernier admin (regle 5)", async () => {
      const { backend, signInAsAdmin } = await makeHarness();
      const adminId = await signInAsAdmin();

      const result = await backend.admin.setProfileRole(adminId, "reader");
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.kind).toBe("conflict");
    });
  });

  describe("administration des comptes", () => {
    it("refuse la creation de compte a un non-admin", async () => {
      const { backend, signInAsAdmin } = await makeHarness();
      await signInAsAdmin();
      await backend.auth.signOut();
      await backend.auth.signUp("simple@studio.com", "motdepasse123");

      const result = await backend.admin.createUser({
        email: "intrus@studio.com",
        password: "motdepasse123",
        role: "admin",
      });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.kind).toBe("forbidden");
    });

    it("refuse la creation sur un email deja pris (regle 8)", async () => {
      const { backend, signInAsAdmin } = await makeHarness();
      await signInAsAdmin();
      const admin = await backend.auth.getCurrentUser();

      const result = await backend.admin.createUser({
        email: admin!.email!,
        password: "motdepasse123",
        role: "reader",
      });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.kind).toBe("conflict");
    });

    it("refuse un mot de passe provisoire trop court (regle 9)", async () => {
      const { backend, signInAsAdmin } = await makeHarness();
      await signInAsAdmin();

      const result = await backend.admin.createUser({
        email: "valide@studio.com",
        password: "court",
        role: "reader",
      });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.kind).toBe("invalid_request");
    });

    it("interdit a un admin de se supprimer via la route admin (regle 7)", async () => {
      const { backend, signInAsAdmin } = await makeHarness();
      const adminId = await signInAsAdmin();

      const result = await backend.admin.deleteUser(adminId);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.kind).toBe("conflict");
    });

    it("supprime un utilisateur non-admin", async () => {
      const { backend, signInAsAdmin } = await makeHarness();
      await signInAsAdmin();

      const created = await backend.admin.createUser({
        email: "ephemere@studio.com",
        password: "motdepasse123",
        role: "reader",
      });
      expect(created.ok).toBe(true);
      if (!created.ok) return;

      const deleted = await backend.admin.deleteUser(created.value.userId);
      expect(deleted.ok).toBe(true);

      const outcome = await backend.auth.fetchMyRole(created.value.userId);
      expect(outcome).toEqual({ status: "missing" });
    });

    it("refuse de supprimer le dernier admin (regle 6)", async () => {
      const { backend, signInAsAdmin } = await makeHarness();
      await signInAsAdmin();

      const suicide = await backend.account.deleteMyAccount();
      expect(suicide.ok).toBe(false);
      if (!suicide.ok) expect(suicide.error.kind).toBe("conflict");
    });

    it("supprime son propre compte non-admin puis deconnecte (compte)", async () => {
      const { backend, signInAsAdmin } = await makeHarness();
      await signInAsAdmin();
      await backend.auth.signOut();
      await backend.auth.signUp("partant@studio.com", "motdepasse123");

      const result = await backend.account.deleteMyAccount();
      expect(result.ok).toBe(true);
      expect(await backend.auth.getCurrentUser()).toBeNull();

      const signInAgain = await backend.auth.signIn("partant@studio.com", "motdepasse123");
      expect(signInAgain.ok).toBe(false);
    });
  });
}

describe("contrat backend (fake en memoire)", () => {
  runBackendContractSuite(async () => {
    const backend = createFakeBackend({
      seedUsers: [{ email: "admin@studio.com", password: "motdepasse-admin", role: "admin" }],
    });
    return {
      backend,
      async signInAsAdmin() {
        const result = await backend.auth.signIn("admin@studio.com", "motdepasse-admin");
        if (!result.ok) throw new Error("seed admin sign-in failed");
        const user = await backend.auth.getCurrentUser();
        return user!.id;
      },
    };
  });
});

describe("regles specifiques au fake", () => {
  let backend: FakeBackend;

  beforeEach(() => {
    backend = createFakeBackend();
  });

  it("bootstrap: le premier compte cree devient admin (regle 1)", async () => {
    const result = await backend.auth.signUp("premier@studio.com", "motdepasse123");
    expect(result.ok).toBe(true);

    const user = await backend.auth.getCurrentUser();
    const outcome = await backend.auth.fetchMyRole(user!.id);
    expect(outcome).toEqual({ status: "ok", role: "admin" });
  });

  it("derive le display_name de l'email (regle 2)", async () => {
    await backend.auth.signUp("marcel.dupont@studio.com", "motdepasse123");
    const [profile] = backend.inspect.users();
    expect(profile.displayName).toBe("marcel.dupont");
  });

  it("bloque l'inscription quand le flag self-signup est desactive", async () => {
    const restricted = createFakeBackend({ allowSelfSignup: false });
    const result = await restricted.auth.signUp("bloque@studio.com", "motdepasse123");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe("forbidden");
  });
});
