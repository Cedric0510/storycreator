"use client";

import { ChangeEvent, useCallback, useEffect, useState } from "react";
import JSZip from "jszip";
import { SupabaseClient, User } from "@supabase/supabase-js";

import {
  EditorEdge,
  EditorNode,
  assetPath,
  blockToNode,
  collectProjectReferencedAssetIds,
  deserializeBlockFromExport,
  downloadBlob,
  rebuildEdgesFromNodes,
  serializeBlock,
} from "@/components/author-studio-core";
import {
  putAssetBlob,
  getAssetBlob,
  getAssetObjectURL,
  deleteAssetBlobs,
  clearAllAssetBlobs,
  revokeAllObjectURLs,
} from "@/lib/assetStore";
import {
  AssetRef,
  HeroProfile,
  ProjectMeta,
  STORY_SCHEMA_VERSION,
  StoryBlock,
  StoryItemDefinition,
  VariableDefinition,
  ValidationIssue,
  createId,
  sanitizeFileName,
  validateStoryBlocks,
} from "@/lib/story";

const SUPABASE_ASSET_BUCKET = "author-assets";

interface UseStudioAssetsParams {
  blocks: StoryBlock[];
  project: ProjectMeta;
  edges: EditorEdge[];
  variableNameById: Map<string, string>;
  canEdit: boolean;
  supabase: SupabaseClient | null;
  authUser: User | null;
  setLastValidation: (issues: ValidationIssue[]) => void;
  setStatusMessage: (message: string) => void;
  logAction: (action: string, details: string) => void;
}

type AttachAssetField = (fieldName: string, assetId: string) => void;

export function useStudioAssets({
  blocks,
  project,
  edges,
  variableNameById,
  canEdit,
  supabase,
  authUser,
  setLastValidation,
  setStatusMessage,
  logAction,
}: UseStudioAssetsParams) {
  const [assetRefs, setAssetRefs] = useState<Record<string, AssetRef>>({});
  const [assetPreviewSrcById, setAssetPreviewSrcById] = useState<Record<string, string>>({});

  // Revoke all Object URLs on unmount to avoid leaks
  useEffect(() => revokeAllObjectURLs, []);

  const ensureAssetPreviewSrc = useCallback(
    async (assetId: string | null) => {
      if (!assetId) return null;
      if (assetPreviewSrcById[assetId]) return assetPreviewSrcById[assetId];

      // Try IndexedDB first — returns a lightweight Object URL (no base64 copy)
      try {
        const objectUrl = await getAssetObjectURL(assetId);
        if (objectUrl) {
          setAssetPreviewSrcById((current) => ({ ...current, [assetId]: objectUrl }));
          return objectUrl;
        }
      } catch { /* IndexedDB unavailable — fall through to cloud */ }

      // Fallback: fetch from Supabase Storage via signed URL
      const ref = assetRefs[assetId];
      if (!ref?.storagePath || !supabase || !authUser) return null;

      const bucket = ref.storageBucket ?? SUPABASE_ASSET_BUCKET;
      const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUrl(ref.storagePath, 60 * 60);
      if (error || !data?.signedUrl) return null;

      setAssetPreviewSrcById((current) => ({ ...current, [assetId]: data.signedUrl }));
      return data.signedUrl;
    },
    [assetPreviewSrcById, assetRefs, authUser, supabase],
  );

  const registerAsset = useCallback((file: File) => {
    const assetId = createId("asset");
    const ref: AssetRef = {
      id: assetId,
      fileName: file.name,
      mimeType: file.type,
      size: file.size,
      packagePath: `assets/${assetId}-${sanitizeFileName(file.name)}`,
      uploadedAt: new Date().toISOString(),
      storageBucket: null,
      storagePath: null,
    };
    setAssetRefs((current) => ({ ...current, [assetId]: ref }));
    // Store file in IndexedDB (fire-and-forget — non-blocking for the UI)
    void putAssetBlob(assetId, file);
    return assetId;
  }, []);

  const createAssetInputHandler = useCallback(
    (fieldName: string, onAttachField: AttachAssetField) =>
      (event: ChangeEvent<HTMLInputElement>) => {
        if (!canEdit) return;

        const file = event.target.files?.[0];
        if (!file) return;

        const assetId = registerAsset(file);
        onAttachField(fieldName, assetId);
        void ensureAssetPreviewSrc(assetId);
        logAction("attach_asset", `${file.name} -> ${fieldName}`);
        setStatusMessage(`Asset ${file.name} ajoute.`);
        event.target.value = "";
      },
    [canEdit, ensureAssetPreviewSrc, logAction, registerAsset, setStatusMessage],
  );

  const getAssetFileName = useCallback(
    (assetId: string | null) => assetRefs[assetId ?? ""]?.fileName ?? "Aucun asset",
    [assetRefs],
  );

  const clearAllAssetState = useCallback(() => {
    setAssetRefs({});
    setAssetPreviewSrcById({});
    void clearAllAssetBlobs();
  }, []);

  const hydrateAssetRefs = useCallback((nextRefs: Record<string, AssetRef>) => {
    setAssetRefs(nextRefs);
    setAssetPreviewSrcById({});
    // Don't clear IndexedDB — cloud assets will be fetched on demand
    // and locally cached blobs may still be valid.
    revokeAllObjectURLs();
  }, []);

  const exportZip = useCallback(async () => {
   try {
    const issues = validateStoryBlocks(blocks, project.info.startBlockId);
    setLastValidation(issues);

    const errors = issues.filter((issue) => issue.level === "error");
    if (errors.length > 0) {
      setStatusMessage("Corrige les erreurs bloquantes avant export.");
      return;
    }

    const referencedAssetIds = collectProjectReferencedAssetIds(project, blocks);
    for (const assetId of referencedAssetIds) {
      if (!assetRefs[assetId]) {
        setStatusMessage(`Asset reference introuvable (${assetId}).`);
        return;
      }
    }

    const payload = {
      schemaVersion: project.info.schemaVersion,
      exportedAt: new Date().toISOString(),
      project: {
        id: project.info.id,
        title: project.info.title,
        slug: project.info.slug,
        synopsis: project.info.synopsis,
        startBlockId: project.info.startBlockId,
        updatedAt: project.info.updatedAt,
        chapters: project.chapters,
      },
      variables: project.variables,
      itemsCatalog: project.items.map((item) => ({
        id: item.id,
        name: item.name,
        description: item.description,
        iconAssetId: item.iconAssetId,
        iconPath: assetPath(item.iconAssetId, assetRefs),
      })),
      hero: {
        name: project.hero.name,
        lore: project.hero.lore,
        baseStats: project.hero.baseStats.map((stat) => ({
          id: stat.id,
          variableId: stat.variableId,
          variableName: variableNameById.get(stat.variableId) ?? "unknown",
          value: stat.value,
        })),
        npcs: project.hero.npcs.map((npc) => ({
          id: npc.id,
          name: npc.name,
          lore: npc.lore,
          baseFriendship: npc.baseFriendship,
        })),
        startingInventory: project.hero.startingInventory.map((entry) => {
          const item = project.items.find((candidate) => candidate.id === entry.itemId) ?? null;
          return {
            id: entry.id,
            itemId: entry.itemId,
            itemName: item?.name ?? "unknown",
            quantity: entry.quantity,
            iconAssetId: item?.iconAssetId ?? null,
            iconPath: assetPath(item?.iconAssetId ?? null, assetRefs),
          };
        }),
      },
      blocks: blocks.map((block) => serializeBlock(block, variableNameById, assetRefs)),
      graph: {
        edges: edges.map((edge) => ({
          source: edge.source,
          sourceHandle: edge.sourceHandle ?? "next",
          target: edge.target,
        })),
      },
    };

    const zip = new JSZip();
    zip.file("story.json", JSON.stringify(payload, null, 2));

    // Sort assets: local IndexedDB files first (fast), cloud downloads after.
    const localAssets: string[] = [];
    const cloudAssets: string[] = [];
    for (const assetId of referencedAssetIds) {
      const ref = assetRefs[assetId];
      if (!ref) continue;
      // We'll try IndexedDB first; if missing there, fall back to cloud
      if (ref.storagePath) {
        cloudAssets.push(assetId);
      } else {
        localAssets.push(assetId);
      }
    }

    // Pack IndexedDB blobs
    for (const assetId of localAssets) {
      const blob = await getAssetBlob(assetId);
      if (blob) {
        zip.file(assetRefs[assetId].packagePath, blob);
      } else {
        setStatusMessage(`Asset manquant en local (${assetRefs[assetId]?.fileName}). Reimporte-le.`);
        return;
      }
    }

    // For cloud assets: try IndexedDB cache first, then download.
    if (cloudAssets.length > 0) {
      if (!supabase || !authUser) {
        setStatusMessage(
          "Connexion cloud requise pour telecharger les assets depuis Supabase Storage.",
        );
        return;
      }

      const BATCH_SIZE = 5;
      let downloaded = 0;
      for (let i = 0; i < cloudAssets.length; i += BATCH_SIZE) {
        const batch = cloudAssets.slice(i, i + BATCH_SIZE);
        setStatusMessage(
          `Export: telechargement assets ${downloaded + 1}-${Math.min(downloaded + batch.length, cloudAssets.length)}/${cloudAssets.length}...`,
        );

        const results = await Promise.all(
          batch.map(async (assetId) => {
            // Try IndexedDB cache first (asset may already be cached locally)
            const cached = await getAssetBlob(assetId);
            if (cached) return { assetId, data: cached } as const;

            const ref = assetRefs[assetId];
            if (!ref.storagePath) return { assetId, error: "storagePath manquant" } as const;
            const bucket = ref.storageBucket ?? SUPABASE_ASSET_BUCKET;
            const { data, error } = await supabase.storage.from(bucket).download(ref.storagePath);
            if (error || !data) return { assetId, error: error?.message ?? "unknown" } as const;
            // Cache the downloaded blob in IndexedDB for future use
            void putAssetBlob(assetId, data);
            return { assetId, data } as const;
          }),
        );

        for (const result of results) {
          if ("error" in result) {
            const ref = assetRefs[result.assetId];
            setStatusMessage(
              `Erreur telechargement asset (${ref?.fileName ?? result.assetId}): ${result.error}`,
            );
            return;
          }
          zip.file(assetRefs[result.assetId].packagePath, result.data);
        }
        downloaded += batch.length;
      }
    }

    setStatusMessage("Export: generation du ZIP...");
    const blob = await zip.generateAsync({
      type: "blob",
      compression: "DEFLATE",
      compressionOptions: { level: 6 },
    });

    downloadBlob(blob, `${project.info.slug || "story"}-bundle.zip`);
    setStatusMessage(`Export reussi: ${referencedAssetIds.size} asset(s) dans le ZIP.`);
    logAction("export_zip", `${referencedAssetIds.size} assets`);
   } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[exportZip] unhandled export error:", msg, err);
    setStatusMessage(`Erreur export: ${msg}`);
   }
  }, [
    assetRefs,
    authUser,
    blocks,
    edges,
    logAction,
    project,
    setLastValidation,
    setStatusMessage,
    supabase,
    variableNameById,
  ]);

  const removeAssetIdsFromState = useCallback((assetIds: string[]) => {
    if (assetIds.length === 0) return 0;
    const staleIds = new Set(assetIds);

    setAssetRefs((current) => {
      const next = { ...current };
      for (const assetId of staleIds) {
        delete next[assetId];
      }
      return next;
    });

    setAssetPreviewSrcById((current) => {
      const next = { ...current };
      for (const assetId of staleIds) {
        delete next[assetId];
      }
      return next;
    });

    void deleteAssetBlobs(assetIds);

    return staleIds.size;
  }, []);

  const cleanupLocalOrphanAssetRefs = useCallback(() => {
    const referencedAssetIds = collectProjectReferencedAssetIds(project, blocks);
    const staleAssetIds = Object.keys(assetRefs).filter(
      (assetId) => !referencedAssetIds.has(assetId),
    );

    if (staleAssetIds.length === 0) {
      setStatusMessage("Aucune reference asset orpheline en local.");
      return;
    }

    const removedCount = removeAssetIdsFromState(staleAssetIds);
    setStatusMessage(`Nettoyage local termine: ${removedCount} reference(s) asset supprimee(s).`);
    logAction("asset_cleanup_local", `${removedCount} reference(s) supprimee(s)`);
  }, [assetRefs, blocks, logAction, project, removeAssetIdsFromState, setStatusMessage]);

  /**
   * Import a previously-exported ZIP bundle and reconstruct all studio state:
   * project metadata, blocks/nodes/edges, asset refs (files stored in IndexedDB).
   * Returns { nodes, edges, project, assetRefs } on success, or null.
   */
  const importFromZip = useCallback(async (file: File): Promise<{
    nodes: EditorNode[];
    edges: EditorEdge[];
    project: ProjectMeta;
    assetRefs: Record<string, AssetRef>;
  } | null> => {
    try {
      const zip = await JSZip.loadAsync(file);

      // ── 1. Parse story.json ──
      const storyJsonFile = zip.file("story.json");
      if (!storyJsonFile) {
        setStatusMessage("ZIP invalide: fichier story.json introuvable.");
        return null;
      }
      const storyJsonText = await storyJsonFile.async("text");
      const storyData = JSON.parse(storyJsonText) as Record<string, unknown>;

      // ── 2. Extract all asset files from ZIP & build path→assetId index ──
      const pathToAssetId = new Map<string, string>();
      const importedAssetRefs: Record<string, AssetRef> = {};

      const assetEntries = Object.entries(zip.files).filter(
        ([name]) => name.startsWith("assets/") && !name.endsWith("/"),
      );

      // Clear previous IndexedDB blobs before importing
      await clearAllAssetBlobs();

      for (const [zipPath, zipEntry] of assetEntries) {
        const blob = await zipEntry.async("blob");
        const fileName = zipPath.split("/").pop() ?? zipPath;
        // Extract original assetId from the filename pattern: assets/{assetId}-{sanitizedName}
        const assetIdMatch = /^assets\/(\w+_[a-f0-9]+)-/.exec(zipPath);
        const assetId = assetIdMatch ? assetIdMatch[1] : createId("asset");

        const mimeType = guessMimeType(fileName);

        const ref: AssetRef = {
          id: assetId,
          fileName,
          mimeType,
          size: blob.size,
          packagePath: zipPath,
          uploadedAt: new Date().toISOString(),
          storageBucket: null,
          storagePath: null,
        };

        importedAssetRefs[assetId] = ref;
        // Store blob in IndexedDB instead of memory
        await putAssetBlob(assetId, new File([blob], fileName, { type: mimeType }));
        pathToAssetId.set(zipPath, assetId);
      }

      // ── 3. Deserialize blocks ──
      const rawBlocks = Array.isArray(storyData.blocks) ? storyData.blocks : [];
      const deserializedBlocks: StoryBlock[] = [];
      for (const rawBlock of rawBlocks) {
        const block = deserializeBlockFromExport(
          rawBlock as Record<string, unknown>,
          pathToAssetId,
        );
        if (block) {
          deserializedBlocks.push(block);
        }
      }

      if (deserializedBlocks.length === 0) {
        setStatusMessage("ZIP invalide: aucun bloc reconnu dans story.json.");
        return null;
      }

      // ── 4. Build nodes & edges ──
      const importedNodes = deserializedBlocks.map((block) => blockToNode(block));
      const importedEdges = rebuildEdgesFromNodes(importedNodes);

      // ── 5. Reconstruct ProjectMeta ──
      const projectData = (storyData.project ?? {}) as Record<string, unknown>;
      const rawVariables = Array.isArray(storyData.variables) ? storyData.variables : [];
      const rawItemsCatalog = Array.isArray(storyData.itemsCatalog) ? storyData.itemsCatalog : [];
      const rawHero = (storyData.hero ?? {}) as Record<string, unknown>;

      const variables: VariableDefinition[] = rawVariables.map(
        (v: Record<string, unknown>) => ({
          id: (v.id as string) ?? createId("var"),
          name: (v.name as string) ?? "",
          initialValue: typeof v.initialValue === "number" ? v.initialValue : 0,
        }),
      );

      const items: StoryItemDefinition[] = rawItemsCatalog.map(
        (item: Record<string, unknown>) => ({
          id: (item.id as string) ?? createId("item"),
          name: (item.name as string) ?? "",
          description: (item.description as string) ?? "",
          iconAssetId: resolveImportAssetId(item.iconPath, pathToAssetId),
        }),
      );

      const heroBaseStats = Array.isArray(rawHero.baseStats)
        ? rawHero.baseStats.map((stat: Record<string, unknown>) => ({
            id: (stat.id as string) ?? createId("hero_stat"),
            variableId: (stat.variableId as string) ?? "",
            value: typeof stat.value === "number" ? stat.value : 0,
          }))
        : [];

      const heroNpcs = Array.isArray(rawHero.npcs)
        ? rawHero.npcs.map((npc: Record<string, unknown>) => ({
            id: (npc.id as string) ?? createId("npc"),
            name: (npc.name as string) ?? "",
            lore: (npc.lore as string) ?? "",
            baseFriendship: typeof npc.baseFriendship === "number" ? npc.baseFriendship : 0,
          }))
        : [];

      const heroStartingInventory = Array.isArray(rawHero.startingInventory)
        ? rawHero.startingInventory.map((entry: Record<string, unknown>) => ({
            id: (entry.id as string) ?? createId("hero_item"),
            itemId: (entry.itemId as string) ?? "",
            quantity: typeof entry.quantity === "number" ? entry.quantity : 1,
          }))
        : [];

      const hero: HeroProfile = {
        name: typeof rawHero.name === "string" ? rawHero.name : "Hero",
        lore: typeof rawHero.lore === "string" ? rawHero.lore : "",
        baseStats: heroBaseStats,
        npcs: heroNpcs,
        startingInventory: heroStartingInventory,
      };

      const importedProject: ProjectMeta = {
        info: {
          id: (projectData.id as string) ?? createId("project"),
          title: (projectData.title as string) ?? "Projet importe",
          slug: (projectData.slug as string) ?? "projet-importe",
          synopsis: (projectData.synopsis as string) ?? "",
          startBlockId: (projectData.startBlockId as string) ?? (deserializedBlocks[0]?.id ?? null),
          schemaVersion: (storyData.schemaVersion as string) ?? STORY_SCHEMA_VERSION,
          updatedAt: (projectData.updatedAt as string) ?? new Date().toISOString(),
        },
        variables,
        items,
        hero,
        chapters: Array.isArray(projectData.chapters) ? projectData.chapters : [],
        members: [
          { id: createId("member"), name: "Auteur", role: "owner" },
        ],
        activeMemberId: "",
        editingLockMemberId: null,
        logs: [
          {
            id: createId("log"),
            memberId: "",
            timestamp: new Date().toISOString(),
            action: "zip_import",
            details: `Importe depuis ${file.name} (${deserializedBlocks.length} blocs, ${assetEntries.length} assets)`,
          },
        ],
      };
      // Set memberId references
      importedProject.activeMemberId = importedProject.members[0].id;
      importedProject.logs[0].memberId = importedProject.members[0].id;

      // ── 6. Apply to local state ──
      setAssetRefs(importedAssetRefs);
      setAssetPreviewSrcById({});
      revokeAllObjectURLs();

      setStatusMessage(
        `Import reussi: ${deserializedBlocks.length} bloc(s), ${assetEntries.length} asset(s) depuis ${file.name}.`,
      );
      logAction("zip_import", `${deserializedBlocks.length} blocs, ${assetEntries.length} assets`);

      return {
        nodes: importedNodes,
        edges: importedEdges,
        project: importedProject,
        assetRefs: importedAssetRefs,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[importFromZip] error:", msg);
      setStatusMessage(`Erreur import ZIP: ${msg}`);
      return null;
    }
  }, [logAction, setStatusMessage]);

  return {
    assetRefs,
    assetPreviewSrcById,
    setAssetRefs,
    setAssetPreviewSrcById,
    ensureAssetPreviewSrc,
    registerAsset,
    createAssetInputHandler,
    getAssetFileName,
    clearAllAssetState,
    hydrateAssetRefs,
    exportZip,
    cleanupLocalOrphanAssetRefs,
    importFromZip,
    getAssetBlob,
  };
}

function resolveImportAssetId(
  path: unknown,
  pathToAssetId: Map<string, string>,
): string | null {
  if (typeof path !== "string" || !path) return null;
  return pathToAssetId.get(path) ?? null;
}

function guessMimeType(fileName: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  const mimeMap: Record<string, string> = {
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    webp: "image/webp",
    svg: "image/svg+xml",
    mp3: "audio/mpeg",
    ogg: "audio/ogg",
    wav: "audio/wav",
    mp4: "video/mp4",
    webm: "video/webm",
  };
  return mimeMap[ext] ?? "application/octet-stream";
}
