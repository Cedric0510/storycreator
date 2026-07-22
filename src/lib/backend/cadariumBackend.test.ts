import { describe, expect, it, vi } from "vitest";
import { createCadariumBackend } from "./cadariumBackend";

const author = {
  id: "author-1",
  email: "admin@cadarium.test",
  displayName: "Admin",
  platformRole: "admin" as const,
  mustChangePassword: false,
  createdAt: "2026-07-22T00:00:00.000Z",
};

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
  };
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

describe("Cadarium backend adapter", () => {
  it("opens, restores and closes an author session", async () => {
    const storage = memoryStorage();
    const fetcher = vi.fn<typeof fetch>(async (_input, init) => {
      const url = String(_input);
      if (url.endsWith("/v1/auth/sign-in")) return jsonResponse({ status: "authenticated", token: "token-1", expiresAt: "2026-08-22T00:00:00.000Z", author });
      if (url.endsWith("/v1/auth/session")) {
        expect(new Headers(init?.headers).get("authorization")).toBe("Bearer token-1");
        return jsonResponse({ author });
      }
      if (url.endsWith("/v1/auth/sign-out")) return new Response(null, { status: 204 });
      return jsonResponse({ code: "not_found" }, 404);
    });
    const backend = createCadariumBackend({ baseUrl: "http://localhost:3001/", storage, fetcher });
    const events: string[] = [];
    backend.auth.onAuthStateChange((_user, event) => events.push(event));

    expect((await backend.auth.signIn(author.email, "safe-password")).ok).toBe(true);
    expect(await backend.auth.getAccessToken()).toBe("token-1");
    expect(await backend.auth.getCurrentUser()).toMatchObject({ id: author.id, email: author.email });
    expect(await backend.auth.fetchMyRole(author.id)).toEqual({ status: "ok", role: "admin" });
    await backend.auth.signOut();
    expect(await backend.auth.getAccessToken()).toBeNull();
    expect(events).toEqual(["signed_in", "signed_out"]);
  });

  it("creates an account then signs it in", async () => {
    const storage = memoryStorage();
    const fetcher = vi.fn<typeof fetch>(async (input) => {
      const url = String(input);
      if (url.endsWith("/v1/auth/sign-up")) return jsonResponse(author, 201);
      if (url.endsWith("/v1/auth/sign-in")) return jsonResponse({ status: "authenticated", token: "token-1", expiresAt: "2026-08-22T00:00:00.000Z", author });
      return jsonResponse({}, 404);
    });
    const backend = createCadariumBackend({ baseUrl: "http://localhost:3001", storage, fetcher });
    expect(await backend.auth.signUp(author.email, "safe-password")).toEqual({ ok: true, value: { needsEmailConfirmation: false } });
    expect(await backend.auth.getAccessToken()).toBe("token-1");
  });

  it("maps API and network errors to the shared contract", async () => {
    const rejected = createCadariumBackend({
      baseUrl: "http://localhost:3001",
      storage: memoryStorage(),
      fetcher: vi.fn<typeof fetch>(async () => jsonResponse({ code: "invalid_credentials" }, 401)),
    });
    const unauthorized = await rejected.auth.signIn("unknown@test.dev", "bad-password");
    expect(unauthorized).toEqual({ ok: false, error: { kind: "unauthorized", message: "Identifiants invalides." } });

    const offline = createCadariumBackend({
      baseUrl: "http://localhost:3001",
      storage: memoryStorage(),
      fetcher: vi.fn<typeof fetch>(async () => { throw new Error("offline"); }),
    });
    const network = await offline.auth.signIn(author.email, "safe-password");
    expect(network).toEqual({ ok: false, error: { kind: "network", message: "Backend Cadarium inaccessible." } });
  });

  it("persists projects through the optional project port", async () => {
    const storage = memoryStorage();
    storage.setItem("cadarium-author-session", "token-1");
    const project = {
      id: "00000000-0000-4000-8000-000000000001",
      title: "Asteria",
      revision: 1,
      createdAt: "2026-07-22T00:00:00.000Z",
      updatedAt: "2026-07-22T00:00:00.000Z",
      document: { blocks: [{ id: "start" }] },
    };
    const fetcher = vi.fn<typeof fetch>(async (input, init) => {
      expect(new Headers(init?.headers).get("authorization")).toBe("Bearer token-1");
      const url = String(input);
      if (url.endsWith("/v1/author/projects") && init?.method === "POST") return jsonResponse(project, 201);
      if (url.endsWith("/v1/author/projects")) return jsonResponse({ projects: [{ ...project, document: undefined }] });
      if (url.endsWith(`/${project.id}`) && init?.method === "PUT") return jsonResponse({ ...project, revision: 2 });
      if (url.endsWith(`/${project.id}`) && init?.method === "DELETE") return new Response(null, { status: 204 });
      if (url.endsWith(`/${project.id}`)) return jsonResponse(project);
      return jsonResponse({}, 404);
    });
    const backend = createCadariumBackend({ baseUrl: "http://localhost:3001", storage, fetcher });

    expect((await backend.projects!.create(project.title, project.document)).ok).toBe(true);
    expect((await backend.projects!.list()).ok).toBe(true);
    const loaded = await backend.projects!.load<typeof project.document>(project.id);
    expect(loaded.ok && loaded.value.document).toEqual(project.document);
    const saved = await backend.projects!.save(project.id, 1, project.title, project.document);
    expect(saved.ok && saved.value.revision).toBe(2);
    expect((await backend.projects!.archive(project.id)).ok).toBe(true);
  });

  it("manages accounts and passwords through Cadarium", async () => {
    const storage = memoryStorage();
    storage.setItem("cadarium-author-session", "token-1");
    const createdAuthor = { ...author, id: "author-2", email: "writer@cadarium.test", platformRole: "author" as const, mustChangePassword: true };
    const fetcher = vi.fn<typeof fetch>(async (input, init) => {
      expect(new Headers(init?.headers).get("authorization")).toBe("Bearer token-1");
      const url = String(input);
      if (url.endsWith("/v1/auth/password")) return new Response(null, { status: 204 });
      if (url.endsWith("/v1/admin/authors") && init?.method === "POST") return jsonResponse(createdAuthor, 201);
      if (url.endsWith("/v1/admin/authors")) return jsonResponse({ authors: [author, createdAuthor] });
      if (url.endsWith("/role")) return new Response(null, { status: 204 });
      if (url.includes("/v1/admin/authors/") && init?.method === "DELETE") return new Response(null, { status: 204 });
      if (url.endsWith("/v1/account")) return new Response(null, { status: 204 });
      return jsonResponse({ code: "not_found" }, 404);
    });
    const backend = createCadariumBackend({ baseUrl: "http://localhost:3001", storage, fetcher });

    expect((await backend.auth.changePassword("new-safe-password")).ok).toBe(true);
    const profiles = await backend.admin.listProfiles();
    expect(profiles.ok && profiles.value[1]).toMatchObject({ userId: "author-2", platformRole: "author" });
    const created = await backend.admin.createUser({ email: createdAuthor.email, password: "temporary-password", role: "author" });
    expect(created).toEqual({ ok: true, value: { userId: "author-2" } });
    expect((await backend.admin.setProfileRole("author-2", "admin")).ok).toBe(true);
    expect((await backend.admin.deleteUser("author-2")).ok).toBe(true);
    expect((await backend.account.deleteMyAccount()).ok).toBe(true);
    expect(await backend.auth.getAccessToken()).toBeNull();
  });

  it("uploads and downloads verified project media", async () => {
    const storage = memoryStorage();
    storage.setItem("cadarium-author-session", "token-1");
    const asset = {
      id: "asset-row-1",
      projectId: "project-1",
      assetId: "portrait",
      fileName: "portrait.webp",
      contentType: "image/webp",
      sizeBytes: 5,
      sha256: "a".repeat(64),
      status: "ready" as const,
      createdAt: "2026-07-22T00:00:00.000Z",
      updatedAt: "2026-07-22T00:00:00.000Z",
    };
    const fetcher = vi.fn<typeof fetch>(async (input, init) => {
      const url = String(input);
      if (url.endsWith("/assets/uploads")) return jsonResponse({ status: "prepared", uploadUrl: "https://upload.test/object", uploadHeaders: { "content-type": "image/webp" } }, 201);
      if (url === "https://upload.test/object") {
        expect(init?.method).toBe("PUT");
        expect(init?.body).toBeInstanceOf(Blob);
        return new Response(null, { status: 200 });
      }
      if (url.endsWith("/portrait/complete")) return jsonResponse({ asset });
      if (url.endsWith("/portrait/download")) return jsonResponse({ url: "https://download.test/object" });
      if (url === "https://download.test/object") return new Response(new Blob(["image"], { type: "image/webp" }), { status: 200 });
      if (url.endsWith("/assets")) return jsonResponse({ assets: [asset] });
      return jsonResponse({}, 404);
    });
    const backend = createCadariumBackend({ baseUrl: "http://localhost:3001", storage, fetcher });
    const blob = new Blob(["image"], { type: "image/webp" });

    const uploaded = await backend.assets!.upload("project-1", "portrait", "portrait.webp", blob);
    expect(uploaded.ok && uploaded.value.assetId).toBe("portrait");
    const listed = await backend.assets!.list("project-1");
    expect(listed.ok && listed.value).toHaveLength(1);
    const downloaded = await backend.assets!.download("project-1", "portrait");
    expect(downloaded.ok && downloaded.value.size).toBe(5);
  });
});
