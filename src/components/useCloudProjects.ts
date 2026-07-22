"use client";

import { useCallback, useEffect, useState } from "react";
import { Backend } from "@/lib/backend/ports";
import { BackendResult, CloudProjectSummary, fail, ok } from "@/lib/backend/types";
import { isStudioSnapshot, StudioSnapshot } from "@/lib/studioAutosave";
import { getAssetBlob, putAssetBlob } from "@/lib/assetStore";

interface ActiveCloudProject {
  id: string;
  revision: number;
}

export interface LoadedCloudProject extends ActiveCloudProject {
  snapshot: StudioSnapshot;
}

export function useCloudProjects(backend: Backend | null, enabled: boolean, ownerId: string | null) {
  const [projects, setProjects] = useState<CloudProjectSummary[]>([]);
  const [activeProject, setActiveProject] = useState<ActiveCloudProject | null>(null);
  const [busy, setBusy] = useState(false);
  const activeStorageKey = ownerId ? `cadarium-active-project:${ownerId}` : null;

  const storeActiveProject = useCallback((value: ActiveCloudProject | null) => {
    setActiveProject(value);
    if (!activeStorageKey) return;
    if (value) window.localStorage.setItem(activeStorageKey, JSON.stringify(value));
    else window.localStorage.removeItem(activeStorageKey);
  }, [activeStorageKey]);

  const refresh = useCallback(async () => {
    if (!enabled || !backend?.projects) {
      setProjects([]);
      return fail("server", "Sauvegarde cloud Cadarium indisponible.");
    }
    const result = await backend.projects.list();
    if (result.ok) setProjects(result.value);
    return result;
  }, [backend, enabled]);

  useEffect(() => {
    if (!enabled || !backend?.projects) {
      setProjects([]);
      setActiveProject(null);
      return;
    }
    const timer = window.setTimeout(() => { void refresh(); }, 0);
    return () => window.clearTimeout(timer);
  }, [backend, enabled, refresh]);

  useEffect(() => {
    if (!enabled || !activeStorageKey) {
      setActiveProject(null);
      return;
    }
    try {
      const stored = JSON.parse(window.localStorage.getItem(activeStorageKey) ?? "null") as Partial<ActiveCloudProject> | null;
      setActiveProject(stored && typeof stored.id === "string" && typeof stored.revision === "number"
        ? { id: stored.id, revision: stored.revision }
        : null);
    } catch {
      setActiveProject(null);
    }
  }, [activeStorageKey, enabled]);

  const save = useCallback(async (snapshot: StudioSnapshot): Promise<BackendResult> => {
    if (!backend?.projects) return fail("server", "Sauvegarde cloud Cadarium indisponible.");
    setBusy(true);
    try {
      const title = snapshot.project.info.title.trim() || "Projet sans titre";
      if (Object.keys(snapshot.assetRefs).length > 0 && !backend.assets) {
        return fail("server", "Le stockage cloud des médias est indisponible.");
      }
      const result = activeProject
        ? await backend.projects.save(activeProject.id, activeProject.revision, title, snapshot)
        : await backend.projects.create(title, snapshot);
      if (!result.ok) return result;
      storeActiveProject({ id: result.value.id, revision: result.value.revision });
      for (const assetRef of Object.values(snapshot.assetRefs)) {
        const storedBlob = await getAssetBlob(assetRef.id);
        if (!storedBlob) return fail("not_found", `Média local introuvable: ${assetRef.fileName}.`);
        const blob = storedBlob.type ? storedBlob : new Blob([storedBlob], { type: assetRef.mimeType });
        const uploaded = await backend.assets!.upload(result.value.id, assetRef.id, assetRef.fileName, blob);
        if (!uploaded.ok) return uploaded;
      }
      await refresh();
      return ok();
    } finally {
      setBusy(false);
    }
  }, [activeProject, backend, refresh, storeActiveProject]);

  const load = useCallback(async (projectId: string): Promise<BackendResult<LoadedCloudProject>> => {
    if (!backend?.projects) return fail("server", "Sauvegarde cloud Cadarium indisponible.");
    setBusy(true);
    try {
      const result = await backend.projects.load<unknown>(projectId);
      if (!result.ok) return result;
      if (!isStudioSnapshot(result.value.document)) return fail("server", "Le projet cloud contient un document invalide.");
      if (Object.keys(result.value.document.assetRefs).length > 0 && !backend.assets) {
        return fail("server", "Le stockage cloud des médias est indisponible.");
      }
      for (const assetRef of Object.values(result.value.document.assetRefs)) {
        const downloaded = await backend.assets!.download(result.value.id, assetRef.id);
        if (!downloaded.ok) return downloaded;
        await putAssetBlob(assetRef.id, downloaded.value);
      }
      return ok({ id: result.value.id, revision: result.value.revision, snapshot: result.value.document });
    } finally {
      setBusy(false);
    }
  }, [backend]);

  const archive = useCallback(async (projectId: string): Promise<BackendResult> => {
    if (!backend?.projects) return fail("server", "Sauvegarde cloud Cadarium indisponible.");
    setBusy(true);
    try {
      const result = await backend.projects.archive(projectId);
      if (!result.ok) return result;
      if (activeProject?.id === projectId) storeActiveProject(null);
      await refresh();
      return ok();
    } finally {
      setBusy(false);
    }
  }, [activeProject?.id, backend, refresh, storeActiveProject]);

  const detach = useCallback(() => storeActiveProject(null), [storeActiveProject]);
  const activate = useCallback((projectId: string, revision: number) => storeActiveProject({ id: projectId, revision }), [storeActiveProject]);

  return { projects, activeProject, busy, refresh, save, load, archive, detach, activate };
}
