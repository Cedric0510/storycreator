"use client";

import { useCallback } from "react";
import { SupabaseClient, User } from "@supabase/supabase-js";
import JSZip from "jszip";

import {
  CloudPayload,
  EditorEdge,
  EditorNode,
  assetPath,
  buildStudioChangeFingerprint,
  blockFromNode,
  collectProjectReferencedAssetIds,
  downloadBlob,
  formatDbError,
  generateUuid,
  isCloudPayload,
  serializeBlock,
} from "@/components/author-studio-core";
import { CloudAccessLevel, CloudProfileRow } from "@/components/author-studio-types";
import {
  AssetRef,
  ProjectMeta,
  StoryBlock,
  normalizeHeroProfile,
  sanitizeFileName,
} from "@/lib/story";

interface UseCloudProjectActionsParams {
  supabase: SupabaseClient | null;
  authUser: User | null;
  project: ProjectMeta;
  nodes: EditorNode[];
  edges: EditorEdge[];
  blocks: StoryBlock[];
  assetRefs: Record<string, AssetRef>;
  assetFiles: Record<string, File>;
  cloudProjectId: string | null;
  cloudOwnerId: string | null;
  cloudCanWrite: boolean;
  cloudCanManageAccess: boolean;
  cloudEditingLockUserId: string | null;
  cloudProjectUpdatedAt: string | null;
  cloudRevisionDrift: boolean;
  shareEmailInput: string;
  shareAccessLevel: "read" | "write";
  cloudLockHeldByOther: boolean;
  hasUnsavedChanges: boolean;
  isPlatformAdmin: boolean;
  setStatusMessage: (message: string) => void;
  setCloudBusy: (busy: boolean) => void;
  setAssetRefs: (refs: Record<string, AssetRef>) => void;
  setCloudProjectId: (value: string | null) => void;
  setCloudOwnerId: (value: string | null) => void;
  setCloudEditingLockUserId: (value: string | null) => void;
  setCloudProjectUpdatedAt: (value: string | null) => void;
  setCloudLatestUpdatedAt: (value: string | null) => void;
  setCloudAccessLevel: (value: CloudAccessLevel | null) => void;
  setShareEmailInput: (value: string) => void;
  markStudioClean: (fingerprint: string) => void;
  refreshCloudSideData: (projectId: string, ownerId: string | null) => Promise<void>;
  refreshCloudProjects: () => Promise<void>;
  appendCloudLog: (projectId: string, action: string, details: string) => Promise<void>;
  acquireCloudLock: (options?: { forceTakeover?: boolean; silent?: boolean }) => Promise<boolean>;
  hydrateStudioFromPayload: (payload: CloudPayload) => void;
}

const SUPABASE_ASSET_BUCKET = "author-assets";
const SUPABASE_ASSET_PREFIX = "projects";

export function useCloudProjectActions({
  supabase,
  authUser,
  project,
  nodes,
  edges,
  blocks,
  assetRefs,
  assetFiles,
  cloudProjectId,
  cloudOwnerId,
  cloudCanWrite,
  cloudCanManageAccess,
  cloudEditingLockUserId,
  cloudProjectUpdatedAt,
  cloudRevisionDrift,
  shareEmailInput,
  shareAccessLevel,
  cloudLockHeldByOther,
  hasUnsavedChanges,
  isPlatformAdmin,
  setStatusMessage,
  setCloudBusy,
  setAssetRefs,
  setCloudProjectId,
  setCloudOwnerId,
  setCloudEditingLockUserId,
  setCloudProjectUpdatedAt,
  setCloudLatestUpdatedAt,
  setCloudAccessLevel,
  setShareEmailInput,
  markStudioClean,
  refreshCloudSideData,
  refreshCloudProjects,
  appendCloudLog,
  acquireCloudLock,
  hydrateStudioFromPayload,
}: UseCloudProjectActionsParams) {
  const saveCloudProject = useCallback(async () => {
    if (!supabase || !authUser) {
      setStatusMessage("Connecte-toi d'abord a Supabase.");
      return false;
    }
    if (!cloudCanWrite) {
      setStatusMessage(
        "Compte lecteur: un admin doit te passer en auteur pour sauvegarder ou creer un projet.",
      );
      return false;
    }

    setCloudBusy(true);
    setStatusMessage("Sauvegarde cloud en cours...");
    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.refreshSession();
      if (sessionError) {
        console.warn("[saveCloudProject] session refresh failed:", sessionError.message);
        setStatusMessage(`Session expiree: ${sessionError.message}. Reconnecte-toi.`);
        return false;
      }

      const sessionUserId = session?.user?.id;
      if (!sessionUserId) {
        setStatusMessage("Session invalide (token absent). Reconnecte-toi puis reessaie.");
        return false;
      }

      const referencedAssetIds = collectProjectReferencedAssetIds(project, blocks);
      for (const assetId of referencedAssetIds) {
        const ref = assetRefs[assetId];
        if (!ref) {
          setStatusMessage(`Asset reference introuvable (${assetId}).`);
          return false;
        }
      }

      if (cloudProjectId && cloudRevisionDrift) {
        setStatusMessage(
          "Une version cloud plus recente existe. Recharge le projet avant de sauvegarder.",
        );
        return false;
      }

      if (cloudProjectId) {
        const hasLock = cloudEditingLockUserId === sessionUserId;
        if (!hasLock) {
          const locked = await acquireCloudLock({ silent: true });
          if (!locked) {
            setStatusMessage("Impossible de sauvegarder: verrou cloud actif par un autre auteur.");
            return false;
          }
        }
      }

      const targetProjectId = cloudProjectId ?? generateUuid();
      const isCreate = !cloudProjectId;
      const resolvedAssetRefs: Record<string, AssetRef> = { ...assetRefs };
      let expectedUpdatedAt = cloudProjectUpdatedAt;

      if (isCreate) {
        const bootstrapPayload: CloudPayload = {
          project,
          nodes,
          edges,
          assetRefs: resolvedAssetRefs,
        };

        const { data: createdRow, error: createError } = await supabase
          .from("author_projects")
          .insert({
            id: targetProjectId,
            owner_id: sessionUserId,
            title: project.info.title,
            slug: project.info.slug,
            synopsis: project.info.synopsis,
            schema_version: project.info.schemaVersion,
            payload: bootstrapPayload,
            editing_lock_user_id: sessionUserId,
          })
          .select("id,owner_id,updated_at")
          .single();

        if (createError) {
          setStatusMessage(formatDbError("Erreur creation cloud", createError));
          return false;
        }

        expectedUpdatedAt = createdRow.updated_at;
        setCloudProjectId(createdRow.id);
        setCloudOwnerId(createdRow.owner_id);
        setCloudEditingLockUserId(sessionUserId);
        setCloudProjectUpdatedAt(createdRow.updated_at);
        setCloudLatestUpdatedAt(createdRow.updated_at);
        setCloudAccessLevel("owner");
      } else if (!expectedUpdatedAt) {
        const { data: row, error: rowError } = await supabase
          .from("author_projects")
          .select("updated_at")
          .eq("id", targetProjectId)
          .single();
        if (rowError || !row) {
          setStatusMessage(
            `Impossible de verifier la revision cloud avant sauvegarde: ${rowError?.message ?? "unknown"}`,
          );
          return false;
        }
        expectedUpdatedAt = row.updated_at;
        setCloudProjectUpdatedAt(row.updated_at);
        setCloudLatestUpdatedAt(row.updated_at);
      }

      for (const assetId of referencedAssetIds) {
        const ref = resolvedAssetRefs[assetId];
        if (!ref) continue;

        const localFile = assetFiles[assetId];
        const storagePath =
          ref.storagePath ??
          `${SUPABASE_ASSET_PREFIX}/${targetProjectId}/${assetId}-${sanitizeFileName(ref.fileName)}`;

        if (localFile) {
          const { error: uploadError } = await supabase.storage
            .from(SUPABASE_ASSET_BUCKET)
            .upload(storagePath, localFile, {
              upsert: true,
              contentType: localFile.type || ref.mimeType || undefined,
            });

          if (uploadError) {
            setStatusMessage(`Erreur upload asset (${ref.fileName}): ${uploadError.message}`);
            return false;
          }
        } else if (!ref.storagePath) {
          setStatusMessage(
            `Asset manquant (${ref.fileName}). Reimporte le fichier avant de sauvegarder.`,
          );
          return false;
        }

        resolvedAssetRefs[assetId] = {
          ...ref,
          storageBucket: SUPABASE_ASSET_BUCKET,
          storagePath,
        };
      }

      setAssetRefs(resolvedAssetRefs);

      const payload: CloudPayload = {
        project,
        nodes,
        edges,
        assetRefs: resolvedAssetRefs,
      };

      let updateQuery = supabase
        .from("author_projects")
        .update({
          title: project.info.title,
          slug: project.info.slug,
          synopsis: project.info.synopsis,
          schema_version: project.info.schemaVersion,
          payload,
        })
        .eq("id", targetProjectId)
        .eq("editing_lock_user_id", sessionUserId);

      if (!isCreate && expectedUpdatedAt) {
        updateQuery = updateQuery.eq("updated_at", expectedUpdatedAt);
      }

      const { data: updatedRows, error: updateError } = await updateQuery.select("id,updated_at");

      if (updateError) {
        setStatusMessage(formatDbError("Erreur sauvegarde cloud", updateError));
        return false;
      }

      if (!updatedRows || updatedRows.length === 0) {
        if (!isCreate) {
          const { data: latestRow } = await supabase
            .from("author_projects")
            .select("updated_at,editing_lock_user_id")
            .eq("id", targetProjectId)
            .maybeSingle();

          if (latestRow?.updated_at) {
            setCloudLatestUpdatedAt(latestRow.updated_at);
            setCloudEditingLockUserId(latestRow.editing_lock_user_id ?? null);
            if (
              latestRow.editing_lock_user_id &&
              latestRow.editing_lock_user_id !== sessionUserId
            ) {
              setStatusMessage("Sauvegarde refusee: verrou cloud actif par un autre auteur.");
            } else {
              setStatusMessage(
                `Conflit de sauvegarde: une version plus recente existe (${new Date(latestRow.updated_at).toLocaleString("fr-FR")}). Recharge le projet cloud avant de sauvegarder.`,
              );
            }
          } else {
            setStatusMessage("Aucun projet mis a jour: identifiant introuvable ou droits insuffisants.");
          }
        } else {
          setStatusMessage("Aucun projet mis a jour: identifiant introuvable ou droits insuffisants.");
        }
        return false;
      }

      const savedUpdatedAt = updatedRows[0]?.updated_at ?? expectedUpdatedAt;
      setCloudProjectUpdatedAt(savedUpdatedAt ?? null);
      setCloudLatestUpdatedAt(savedUpdatedAt ?? null);

      const logActionName = isCreate ? "cloud_create" : "cloud_save";
      const logActionDetails = isCreate ? "Projet cree dans Supabase" : "Sauvegarde cloud";
      await appendCloudLog(targetProjectId, logActionName, logActionDetails);
      await refreshCloudSideData(targetProjectId, isCreate ? sessionUserId : cloudOwnerId);
      await refreshCloudProjects();

      if (isCreate) {
        setStatusMessage(`Projet cree et sauvegarde (${targetProjectId}).`);
      } else {
        setStatusMessage("Projet sauvegarde dans Supabase.");
      }

      markStudioClean(
        buildStudioChangeFingerprint(payload.project, payload.nodes, payload.edges, payload.assetRefs),
      );
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[saveCloudProject] unhandled save error:", msg);
      setStatusMessage(`Erreur sauvegarde: ${msg}`);
      return false;
    } finally {
      setCloudBusy(false);
    }
  }, [
    supabase,
    authUser,
    blocks,
    assetRefs,
    cloudProjectId,
    cloudCanWrite,
    cloudRevisionDrift,
    cloudEditingLockUserId,
    acquireCloudLock,
    cloudProjectUpdatedAt,
    project,
    nodes,
    edges,
    setStatusMessage,
    setCloudBusy,
    setCloudProjectId,
    setCloudOwnerId,
    setCloudEditingLockUserId,
    setCloudProjectUpdatedAt,
    setCloudLatestUpdatedAt,
    setCloudAccessLevel,
    setAssetRefs,
    assetFiles,
    appendCloudLog,
    refreshCloudSideData,
    cloudOwnerId,
    refreshCloudProjects,
    markStudioClean,
  ]);

  const loadCloudProject = useCallback(async (targetIdOverride?: string) => {
    if (!supabase || !authUser) {
      setStatusMessage("Connecte-toi d'abord a Supabase.");
      return;
    }

    const targetId = (targetIdOverride ?? cloudProjectId ?? "").trim();
    if (!targetId) {
      setStatusMessage("Aucun project_id disponible pour charger un projet.");
      return;
    }

    setCloudBusy(true);
    try {
      const { data, error } = await supabase
        .from("author_projects")
        .select("id,owner_id,payload,updated_at,editing_lock_user_id")
        .eq("id", targetId)
        .single();

      if (error || !data) {
        setStatusMessage(`Erreur chargement cloud: ${error?.message ?? "unknown"}`);
        return;
      }

      const payload = data.payload as unknown;
      if (!isCloudPayload(payload)) {
        setStatusMessage("Payload cloud invalide (schema inattendu).");
        return;
      }

      hydrateStudioFromPayload(payload);
      setCloudProjectId(data.id);
      setCloudOwnerId(data.owner_id);
      setCloudEditingLockUserId(data.editing_lock_user_id);
      setCloudProjectUpdatedAt(data.updated_at);
      setCloudLatestUpdatedAt(data.updated_at);
      await refreshCloudSideData(data.id, data.owner_id);
      await refreshCloudProjects();
      setStatusMessage("Projet charge depuis Supabase.");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setStatusMessage(`Erreur chargement cloud: ${msg}`);
    } finally {
      setCloudBusy(false);
    }
  }, [
    supabase,
    authUser,
    cloudProjectId,
    setStatusMessage,
    setCloudBusy,
    hydrateStudioFromPayload,
    setCloudProjectId,
    setCloudOwnerId,
    setCloudEditingLockUserId,
    setCloudProjectUpdatedAt,
    setCloudLatestUpdatedAt,
    refreshCloudSideData,
    refreshCloudProjects,
  ]);

  const downloadCloudProjectBundle = useCallback(async (targetProjectId: string) => {
    if (!supabase || !authUser) {
      setStatusMessage("Connecte-toi d'abord a Supabase.");
      return;
    }

    const projectId = targetProjectId.trim();
    if (!projectId) {
      setStatusMessage("Identifiant projet invalide.");
      return;
    }

    setCloudBusy(true);
    try {
      const { data, error } = await supabase
        .from("author_projects")
        .select("id,payload")
        .eq("id", projectId)
        .single();

      if (error || !data) {
        setStatusMessage(`Erreur telechargement projet cloud: ${error?.message ?? "unknown"}`);
        return;
      }

      const payload = data.payload as unknown;
      if (!isCloudPayload(payload)) {
        setStatusMessage("Payload cloud invalide (schema inattendu).");
        return;
      }

      const bundleProject = payload.project;
      const bundleBlocks = payload.nodes.map((node) => blockFromNode(node));
      const bundleAssetRefs = payload.assetRefs ?? {};
      const bundleItems = Array.isArray(
        (bundleProject as ProjectMeta & { items?: unknown }).items,
      )
        ? bundleProject.items
        : [];
      const rawHero = normalizeHeroProfile((bundleProject as ProjectMeta & { hero?: unknown }).hero);
      const bundleVariableIds = new Set(bundleProject.variables.map((variable) => variable.id));
      const bundleItemIds = new Set(bundleItems.map((item) => item.id));
      const bundleHero = {
        ...rawHero,
        baseStats: rawHero.baseStats.filter((stat) => bundleVariableIds.has(stat.variableId)),
        startingInventory: rawHero.startingInventory.filter((entry) => bundleItemIds.has(entry.itemId)),
      };
      const variableNameById = new Map(
        bundleProject.variables.map((variable) => [variable.id, variable.name]),
      );

      const referencedAssetIds = collectProjectReferencedAssetIds(bundleProject, bundleBlocks);
      for (const assetId of referencedAssetIds) {
        if (!bundleAssetRefs[assetId]) {
          setStatusMessage(`Asset reference introuvable (${assetId}).`);
          return;
        }
      }

      const exportPayload = {
        schemaVersion: bundleProject.info.schemaVersion,
        exportedAt: new Date().toISOString(),
        project: {
          id: bundleProject.info.id,
          title: bundleProject.info.title,
          slug: bundleProject.info.slug,
          synopsis: bundleProject.info.synopsis,
          startBlockId: bundleProject.info.startBlockId,
          updatedAt: bundleProject.info.updatedAt,
        },
        variables: bundleProject.variables,
        itemsCatalog: bundleItems.map((item) => ({
          id: item.id,
          name: item.name,
          description: item.description,
          iconAssetId: item.iconAssetId,
          iconPath: assetPath(item.iconAssetId, bundleAssetRefs),
        })),
        hero: {
          name: bundleHero.name,
          lore: bundleHero.lore,
          baseStats: bundleHero.baseStats.map((stat) => ({
            id: stat.id,
            variableId: stat.variableId,
            variableName: variableNameById.get(stat.variableId) ?? "unknown",
            value: stat.value,
          })),
          npcs: bundleHero.npcs.map((npc) => ({
            id: npc.id,
            name: npc.name,
            lore: npc.lore,
            baseFriendship: npc.baseFriendship,
          })),
          startingInventory: bundleHero.startingInventory.map((entry) => {
            const item = bundleItems.find((candidate) => candidate.id === entry.itemId) ?? null;
            return {
              id: entry.id,
              itemId: entry.itemId,
              itemName: item?.name ?? "unknown",
              quantity: entry.quantity,
              iconAssetId: item?.iconAssetId ?? null,
              iconPath: assetPath(item?.iconAssetId ?? null, bundleAssetRefs),
            };
          }),
        },
        blocks: bundleBlocks.map((block) =>
          serializeBlock(block, variableNameById, bundleAssetRefs),
        ),
        graph: {
          edges: payload.edges.map((edge) => ({
            source: edge.source,
            sourceHandle: edge.sourceHandle ?? "next",
            target: edge.target,
          })),
        },
      };

      const zip = new JSZip();
      zip.file("story.json", JSON.stringify(exportPayload, null, 2));

      for (const assetId of referencedAssetIds) {
        const ref = bundleAssetRefs[assetId];
        if (!ref) continue;

        if (!ref.storagePath) {
          setStatusMessage(
            `Asset cloud manquant pour bundle: ${ref.fileName}. Demande au proprietaire de resauvegarder le projet.`,
          );
          return;
        }

        const bucket = ref.storageBucket ?? SUPABASE_ASSET_BUCKET;
        const { data: fileData, error: fileError } = await supabase.storage
          .from(bucket)
          .download(ref.storagePath);
        if (fileError || !fileData) {
          setStatusMessage(
            `Erreur telechargement asset (${ref.fileName}): ${fileError?.message ?? "unknown"}`,
          );
          return;
        }

        zip.file(ref.packagePath, fileData);
      }

      const blob = await zip.generateAsync({
        type: "blob",
        compression: "DEFLATE",
        compressionOptions: { level: 6 },
      });
      downloadBlob(blob, `${bundleProject.info.slug || "story"}-bundle.zip`);
      setStatusMessage(`Bundle telecharge: ${referencedAssetIds.size} asset(s).`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setStatusMessage(`Erreur telechargement bundle: ${msg}`);
    } finally {
      setCloudBusy(false);
    }
  }, [authUser, setCloudBusy, setStatusMessage, supabase]);

  const grantCloudAccess = useCallback(async () => {
    if (!supabase || !authUser || !cloudProjectId || !cloudCanManageAccess) return;
    const email = shareEmailInput.trim().toLowerCase();
    if (!email) {
      setStatusMessage("Saisis l'email du collaborateur.");
      return;
    }

    setCloudBusy(true);
    try {
      const { data: profileRows, error: profileError } = await supabase.rpc(
        "project_resolve_user_by_email",
        {
          project_uuid: cloudProjectId,
          target_email: email,
        },
      );

      if (profileError) {
        setStatusMessage(`Erreur recherche collaborateur: ${profileError.message}`);
        return;
      }

      const profileRow = ((profileRows ?? []) as CloudProfileRow[])[0] ?? null;
      if (!profileRow?.user_id) {
        setStatusMessage(
          "Aucun compte trouve pour cet email. Le collaborateur doit d'abord creer son compte.",
        );
        return;
      }

      if (profileRow.user_id === cloudOwnerId) {
        setStatusMessage("Cet utilisateur est deja owner du projet.");
        return;
      }

      const { error } = await supabase.from("author_project_access").upsert(
        {
          project_id: cloudProjectId,
          user_id: profileRow.user_id,
          access_level: shareAccessLevel,
          granted_by: authUser.id,
        },
        { onConflict: "project_id,user_id" },
      );

      if (error) {
        setStatusMessage(`Erreur partage droits: ${error.message}`);
        return;
      }

      await appendCloudLog(
        cloudProjectId,
        "grant_access",
        `${profileRow.user_id} => ${shareAccessLevel}`,
      );
      await refreshCloudSideData(cloudProjectId, cloudOwnerId);
      setShareEmailInput("");
      setStatusMessage("Droit utilisateur mis a jour.");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setStatusMessage(`Erreur partage: ${msg}`);
    } finally {
      setCloudBusy(false);
    }
  }, [
    supabase,
    authUser,
    cloudProjectId,
    cloudCanManageAccess,
    shareEmailInput,
    setStatusMessage,
    setCloudBusy,
    cloudOwnerId,
    shareAccessLevel,
    appendCloudLog,
    refreshCloudSideData,
    setShareEmailInput,
  ]);

  const revokeCloudAccess = useCallback(async (userId: string) => {
    if (!supabase || !cloudProjectId || !cloudCanManageAccess || !authUser) return;
    if (userId === authUser.id) {
      setStatusMessage("Le owner ne peut pas se retirer lui-meme.");
      return;
    }

    setCloudBusy(true);
    try {
      const { error } = await supabase
        .from("author_project_access")
        .delete()
        .eq("project_id", cloudProjectId)
        .eq("user_id", userId);

      if (error) {
        setStatusMessage(`Erreur suppression droit: ${error.message}`);
        return;
      }

      await appendCloudLog(cloudProjectId, "revoke_access", userId);
      await refreshCloudSideData(cloudProjectId, cloudOwnerId);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setStatusMessage(`Erreur revocation: ${msg}`);
    } finally {
      setCloudBusy(false);
    }
  }, [
    supabase,
    cloudProjectId,
    cloudCanManageAccess,
    authUser,
    setStatusMessage,
    setCloudBusy,
    appendCloudLog,
    refreshCloudSideData,
    cloudOwnerId,
  ]);

  const cleanupCloudOrphanAssets = useCallback(async () => {
    if (!supabase || !authUser || !cloudProjectId) {
      setStatusMessage("Connecte-toi et ouvre un projet cloud pour nettoyer les assets.");
      return;
    }
    if (!cloudCanWrite) {
      setStatusMessage("Droit cloud insuffisant: acces write ou owner requis.");
      return;
    }
    if (cloudLockHeldByOther) {
      setStatusMessage("Verrou cloud actif par un autre auteur. Operation refusee.");
      return;
    }
    if (hasUnsavedChanges) {
      setStatusMessage("Sauvegarde d'abord le projet cloud avant nettoyage des assets cloud.");
      return;
    }
    if (cloudRevisionDrift) {
      setStatusMessage(
        "Une version cloud plus recente existe. Recharge le projet avant nettoyage des assets cloud.",
      );
      return;
    }

    const referencedAssetIds = collectProjectReferencedAssetIds(project, blocks);
    const referencedStoragePaths = new Set<string>();
    for (const assetId of referencedAssetIds) {
      const storagePath = assetRefs[assetId]?.storagePath;
      if (storagePath) {
        referencedStoragePaths.add(storagePath);
      }
    }

    setCloudBusy(true);
    try {
      const bucket = SUPABASE_ASSET_BUCKET;
      const folderPath = `${SUPABASE_ASSET_PREFIX}/${cloudProjectId}`;
      const allCloudPaths: string[] = [];
      let offset = 0;
      const limit = 100;

      while (true) {
        const { data, error } = await supabase.storage
          .from(bucket)
          .list(folderPath, { limit, offset, sortBy: { column: "name", order: "asc" } });

        if (error) {
          setStatusMessage(`Erreur listage assets cloud: ${error.message}`);
          return;
        }

        if (!data || data.length === 0) {
          break;
        }

        for (const item of data) {
          if (!item.name) continue;
          if (item.name.endsWith("/")) continue;
          allCloudPaths.push(`${folderPath}/${item.name}`);
        }

        if (data.length < limit) {
          break;
        }
        offset += data.length;
      }

      const stalePaths = allCloudPaths.filter((path) => !referencedStoragePaths.has(path));
      if (stalePaths.length === 0) {
        setStatusMessage("Aucun fichier cloud orphelin detecte.");
        return;
      }

      for (let cursor = 0; cursor < stalePaths.length; cursor += 100) {
        const chunk = stalePaths.slice(cursor, cursor + 100);
        const { error } = await supabase.storage.from(bucket).remove(chunk);
        if (error) {
          setStatusMessage(`Erreur suppression assets cloud: ${error.message}`);
          return;
        }
      }

      await appendCloudLog(cloudProjectId, "asset_cleanup_cloud", `${stalePaths.length} fichier(s)`);
      setStatusMessage(`Nettoyage cloud termine: ${stalePaths.length} fichier(s) supprime(s).`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setStatusMessage(`Erreur nettoyage assets: ${msg}`);
    } finally {
      setCloudBusy(false);
    }
  }, [
    supabase,
    authUser,
    cloudProjectId,
    setStatusMessage,
    cloudCanWrite,
    cloudLockHeldByOther,
    hasUnsavedChanges,
    cloudRevisionDrift,
    blocks,
    project,
    assetRefs,
    setCloudBusy,
    appendCloudLog,
  ]);

  const deleteCloudProject = useCallback(
    async (projectId: string) => {
      if (!supabase || !authUser) {
        setStatusMessage("Connecte-toi d'abord a Supabase.");
        return;
      }
      if (!isPlatformAdmin) {
        setStatusMessage("Seul un admin peut supprimer un projet.");
        return;
      }

      setCloudBusy(true);
      try {
        // 0. Refresh session to avoid expired-token failures
        const { error: sessionError } = await supabase.auth.refreshSession();
        if (sessionError) {
          setStatusMessage(`Session expiree: ${sessionError.message}. Reconnecte-toi.`);
          return;
        }

        // 1. Delete storage files for this project
        const bucket = SUPABASE_ASSET_BUCKET;
        const folderPath = `${SUPABASE_ASSET_PREFIX}/${projectId}`;
        let offset = 0;
        const limit = 100;
        const allPaths: string[] = [];

        while (true) {
          const { data, error } = await supabase.storage
            .from(bucket)
            .list(folderPath, { limit, offset, sortBy: { column: "name", order: "asc" } });

          if (error) {
            setStatusMessage(`Erreur listage assets: ${error.message}`);
            return;
          }
          if (!data || data.length === 0) break;

          for (const item of data) {
            if (!item.name || item.name.endsWith("/")) continue;
            allPaths.push(`${folderPath}/${item.name}`);
          }
          if (data.length < limit) break;
          offset += data.length;
        }

        if (allPaths.length > 0) {
          for (let cursor = 0; cursor < allPaths.length; cursor += 100) {
            const chunk = allPaths.slice(cursor, cursor + 100);
            const { error } = await supabase.storage.from(bucket).remove(chunk);
            if (error) {
              setStatusMessage(`Erreur suppression assets: ${error.message}`);
              return;
            }
          }
        }

        // 2. Delete access rows
        const { error: accessError } = await supabase
          .from("author_project_access")
          .delete()
          .eq("project_id", projectId);
        if (accessError) {
          setStatusMessage(formatDbError("Erreur suppression acces", accessError));
          return;
        }

        // 3. Delete project row
        const { error: projectError } = await supabase
          .from("author_projects")
          .delete()
          .eq("id", projectId);
        if (projectError) {
          setStatusMessage(formatDbError("Erreur suppression projet", projectError));
          return;
        }

        // 4. If the deleted project was the active one, reset cloud state
        if (cloudProjectId === projectId) {
          setCloudProjectId(null);
          setCloudOwnerId(null);
          setCloudEditingLockUserId(null);
          setCloudProjectUpdatedAt(null);
          setCloudLatestUpdatedAt(null);
          setCloudAccessLevel(null);
        }

        await refreshCloudProjects();
        setStatusMessage(`Projet ${projectId} supprime (donnees, assets et acces).`);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        setStatusMessage(`Erreur suppression projet: ${msg}`);
      } finally {
        setCloudBusy(false);
      }
    },
    [
      supabase,
      authUser,
      isPlatformAdmin,
      cloudProjectId,
      setStatusMessage,
      setCloudBusy,
      setCloudProjectId,
      setCloudOwnerId,
      setCloudEditingLockUserId,
      setCloudProjectUpdatedAt,
      setCloudLatestUpdatedAt,
      setCloudAccessLevel,
      refreshCloudProjects,
    ],
  );

  return {
    saveCloudProject,
    loadCloudProject,
    downloadCloudProjectBundle,
    grantCloudAccess,
    revokeCloudAccess,
    cleanupCloudOrphanAssets,
    deleteCloudProject,
  };
}
