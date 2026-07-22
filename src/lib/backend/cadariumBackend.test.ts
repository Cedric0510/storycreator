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
});
