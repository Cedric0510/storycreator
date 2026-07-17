"use client";

import { ChangeEvent, useCallback, useEffect, useRef, useState } from "react";
import JSZip from "jszip";

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
  isCachedAssetObjectURL,
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

interface UseStudioAssetsParams {
  blocks: StoryBlock[];
  project: ProjectMeta;
  edges: EditorEdge[];
  variableNameById: Map<string, string>;
  openedValidatedChapterIds: string[];
  canEdit: boolean;
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
  openedValidatedChapterIds,
  canEdit,
  setLastValidation,
  setStatusMessage,
  logAction,
}: UseStudioAssetsParams) {
  const [assetRefs, setAssetRefs] = useState<Record<string, AssetRef>>({});
  const [assetPreviewSrcById, setAssetPreviewSrcById] = useState<Record<string, string>>({});
  const isMountedRef = useRef(true);
  const assetRefsRef = useRef(assetRefs);
  const assetPreviewSrcByIdRef = useRef(assetPreviewSrcById);
  const inFlightPreviewByIdRef = useRef(new Map<string, Promise<string | null>>());

  useEffect(() => {
    assetRefsRef.current = assetRefs;
  }, [assetRefs]);

  useEffect(() => {
    assetPreviewSrcByIdRef.current = assetPreviewSrcById;
  }, [assetPreviewSrcById]);

  // Revoke all Object URLs on unmount to avoid leaks.
  // In React Strict Mode (dev), effects mount/cleanup twice: re-arm mounted flag on mount.
  useEffect(() => {
    isMountedRef.current = true;
    const inFlightMap = inFlightPreviewByIdRef.current;
    return () => {
      isMountedRef.current = false;
      inFlightMap.clear();
      revokeAllObjectURLs();
    };
  }, []);

  const ensureAssetPreviewSrc = useCallback(
    async (assetId: string | null) => {
      if (!assetId) return null;

      const cachedPreviewSrc = assetPreviewSrcByIdRef.current[assetId];
      if (cachedPreviewSrc) {
        const isBlobUrl = cachedPreviewSrc.startsWith("blob:");
        if (!isBlobUrl || isCachedAssetObjectURL(assetId, cachedPreviewSrc)) {
          return cachedPreviewSrc;
        }

        // URL was evicted/revoked by LRU: drop stale entry, then reload a fresh URL below.
        if (isMountedRef.current) {
          setAssetPreviewSrcById((current) => {
            if (current[assetId] !== cachedPreviewSrc) return current;
            const next = { ...current };
            delete next[assetId];
            assetPreviewSrcByIdRef.current = next;
            return next;
          });
        }
      }

      const inFlight = inFlightPreviewByIdRef.current.get(assetId);
      if (inFlight) return inFlight;

      const loadPreviewPromise = (async () => {
        // Try IndexedDB first - returns a lightweight Object URL (no base64 copy).
        try {
          const objectUrl = await getAssetObjectURL(assetId);
          if (objectUrl) {
            if (isMountedRef.current) {
              setAssetPreviewSrcById((current) => {
                if (current[assetId] === objectUrl) return current;
                const next = { ...current, [assetId]: objectUrl };
                assetPreviewSrcByIdRef.current = next;
                return next;
              });
            }
            return objectUrl;
          }
        } catch {
          // IndexedDB unavailable or asset missing.
        }

        return null;
      })().catch(() => null);

      inFlightPreviewByIdRef.current.set(assetId, loadPreviewPromise);
      loadPreviewPromise.finally(() => {
        if (inFlightPreviewByIdRef.current.get(assetId) === loadPreviewPromise) {
          inFlightPreviewByIdRef.current.delete(assetId);
        }
      });
      return loadPreviewPromise;
    },
    [],
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
    };
    setAssetRefs((current) => {
      const next = { ...current, [assetId]: ref };
      assetRefsRef.current = next;
      return next;
    });
    // Store file in IndexedDB (fire-and-forget — non-blocking for the UI)
    void putAssetBlob(assetId, file).catch((error) => {
      console.error("[useStudioAssets] asset cache write failed:", assetId, error);
    });
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
    assetRefsRef.current = {};
    assetPreviewSrcByIdRef.current = {};
    inFlightPreviewByIdRef.current.clear();
    setAssetRefs({});
    setAssetPreviewSrcById({});
    revokeAllObjectURLs();
    void clearAllAssetBlobs();
  }, []);


  const exportZip = useCallback(async () => {
   try {
    const issues = validateStoryBlocks(blocks, project.info.startBlockId, project.items, project.variables);
    setLastValidation(issues);

    const errors = issues.filter((issue) => issue.level === "error");
    if (errors.length > 0) {
      setStatusMessage(
        `Export bloque: ${errors.length} erreur(s). ${errors[0]?.message ?? "Corrige les erreurs bloquantes avant export."}`,
      );
      return false;
    }

    const referencedAssetIds = collectProjectReferencedAssetIds(project, blocks);
    for (const assetId of referencedAssetIds) {
      if (!assetRefs[assetId]) {
        setStatusMessage(`Asset reference introuvable (${assetId}).`);
        return false;
      }
    }

    const openedValidatedChapterIdSet = new Set(
      project.chapters
        .filter((chapter) => chapter.validated)
        .map((chapter) => chapter.id),
    );
    const persistedOpenedValidatedChapterIds = openedValidatedChapterIds.filter((chapterId) =>
      openedValidatedChapterIdSet.has(chapterId),
    );

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
      studio: {
        openedValidatedChapterIds: persistedOpenedValidatedChapterIds,
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

    for (const assetId of referencedAssetIds) {
      const ref = assetRefs[assetId];
      if (!ref) continue;
      const blob = await getAssetBlob(assetId);
      if (blob) {
        zip.file(ref.packagePath, blob);
      } else {
        setStatusMessage(
          `Asset manquant en local (${ref.fileName}). Reimporte-le depuis un ZIP complet avant d'exporter.`,
        );
        return false;
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
    return true;
   } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[exportZip] unhandled export error:", msg, err);
    setStatusMessage(`Erreur export: ${msg}`);
    return false;
   }
  }, [
    assetRefs,
    blocks,
    edges,
    logAction,
    project,
    openedValidatedChapterIds,
    setLastValidation,
    setStatusMessage,
    variableNameById,
  ]);

  /**
   * Import a previously-exported ZIP bundle and decode its payload:
   * project metadata, blocks/nodes/edges, asset refs (files stored in IndexedDB).
   * This function does not mutate studio state directly; caller decides merge/replace strategy.
   * Returns { nodes, edges, project, assetRefs, studioOpenedValidatedChapterIds } on success, or null.
   */
  const importFromZip = useCallback(async (file: File): Promise<{
    nodes: EditorNode[];
    edges: EditorEdge[];
    project: ProjectMeta;
    assetRefs: Record<string, AssetRef>;
    studioOpenedValidatedChapterIds: string[];
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
      const reservedAssetIds = new Set<string>(Object.keys(assetRefsRef.current));

      const assetEntries = Object.entries(zip.files).filter(
        ([name]) => name.startsWith("assets/") && !name.endsWith("/"),
      );

      for (const [zipPath, zipEntry] of assetEntries) {
        const blob = await zipEntry.async("blob");
        const fileName = zipPath.split("/").pop() ?? zipPath;
        // Extract original assetId from the filename pattern: assets/{assetId}-{sanitizedName}
        const assetIdMatch = /^assets\/(\w+_[a-f0-9]+)-/.exec(zipPath);
        let assetId = assetIdMatch ? assetIdMatch[1] : createId("asset");
        while (reservedAssetIds.has(assetId) || importedAssetRefs[assetId]) {
          assetId = createId("asset");
        }
        reservedAssetIds.add(assetId);

        const mimeType = guessMimeType(fileName);
        const packagePath = `assets/${assetId}-${sanitizeFileName(fileName)}`;

        const ref: AssetRef = {
          id: assetId,
          fileName,
          mimeType,
          size: blob.size,
          packagePath,
          uploadedAt: new Date().toISOString(),
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
      const rawStudio = (storyData.studio ?? {}) as Record<string, unknown>;
      const studioOpenedValidatedChapterIds = Array.isArray(rawStudio.openedValidatedChapterIds)
        ? rawStudio.openedValidatedChapterIds
            .filter((chapterId): chapterId is string => typeof chapterId === "string" && chapterId.length > 0)
        : [];

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

      if (!isMountedRef.current) {
        return null;
      }

      setStatusMessage(
        `Import reussi: ${deserializedBlocks.length} bloc(s), ${assetEntries.length} asset(s) depuis ${file.name}.`,
      );

      return {
        nodes: importedNodes,
        edges: importedEdges,
        project: importedProject,
        assetRefs: importedAssetRefs,
        studioOpenedValidatedChapterIds,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[importFromZip] error:", msg);
      setStatusMessage(`Erreur import ZIP: ${msg}`);
      return null;
    }
  }, [setStatusMessage]);

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
    exportZip,
    importFromZip,
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
