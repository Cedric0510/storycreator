"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Background,
  BackgroundVariant,
  Connection,
  Controls,
  EdgeChange,
  EdgeTypes,
  MiniMap,
  NodeChange,
  NodeTypes,
  ReactFlow,
  applyEdgeChanges,
  applyNodeChanges,
} from "@xyflow/react";

import { AuthorStudioCloudPanel } from "@/components/AuthorStudioCloudPanel";
import { AuthorStudioBlockEditorPanel } from "@/components/AuthorStudioBlockEditorPanel";
import { AuthorStudioProjectPanel } from "@/components/AuthorStudioProjectPanel";
import { HelpHint } from "@/components/HelpHint";
import { PreviewOverlay } from "@/components/PreviewOverlay";
import { StoryNode, StoryNodeData, DeletableEdge, ChapterFolderNode } from "@/components/StoryNode";
import { useBlockEffectOperations } from "@/components/useBlockEffectOperations";
import { useChoiceOperations } from "@/components/useChoiceOperations";
import { useCloudProjectActions } from "@/components/useCloudProjectActions";
import { useCloudProjectState } from "@/components/useCloudProjectState";
import { useCloudProjectSession } from "@/components/useCloudProjectSession";
import { useDialogueOperations } from "@/components/useDialogueOperations";
import { useGameplayOperations } from "@/components/useGameplayOperations";
import { usePreviewRuntime } from "@/components/usePreviewRuntime";
import { useStudioAssets } from "@/components/useStudioAssets";
import {
  CloudPayload,
  EditorEdge,
  EditorNode,
  InitialStudio,
  blockFromNode,
  blockToNode,
  buildStudioChangeFingerprint,
  buildEdge,
  buildInitialStudio,
  choiceLabelFromHandle,
  lineIdFromHandle,
  rebuildEdgesFromNodes,
  removeItemReferences,
  removeNodeReferences,
  removeVariableReferences,
  responseIdFromHandle,
} from "@/components/author-studio-core";
import {
  PlatformRole,
} from "@/components/author-studio-types";
import {
  BLOCK_LABELS,
  BlockType,
  Chapter,
  ProjectMeta,
  StoryBlock,
  ValidationIssue,
  blockTypeColor,
  createBlock,
  createId,
  normalizeHeroProfile,
  normalizeStoryBlock,
  validateStoryBlocks,
} from "@/lib/story";
import { allowSelfSignup } from "@/lib/runtimeFlags";

const nodeTypes: NodeTypes = { storyBlock: StoryNode, chapterFolder: ChapterFolderNode };
const edgeTypes: EdgeTypes = { deletable: DeletableEdge };

function normalizeProjectItems(
  items: unknown,
): ProjectMeta["items"] {
  if (!Array.isArray(items)) return [];

  return items.map((entry, index) => {
    const candidate = entry as Partial<ProjectMeta["items"][number]>;
    const hasName = typeof candidate.name === "string" && candidate.name.trim().length > 0;
    return {
      id: typeof candidate.id === "string" && candidate.id ? candidate.id : createId("item"),
      name: hasName ? candidate.name!.trim() : `Objet ${index + 1}`,
      description: typeof candidate.description === "string" ? candidate.description : "",
      iconAssetId: typeof candidate.iconAssetId === "string" ? candidate.iconAssetId : null,
    };
  });
}

function normalizeProjectHero(
  hero: unknown,
  variables: ProjectMeta["variables"],
  items: ProjectMeta["items"],
): ProjectMeta["hero"] {
  const normalizedHero = normalizeHeroProfile(hero);
  const variableIds = new Set(variables.map((variable) => variable.id));
  const itemIds = new Set(items.map((item) => item.id));

  return {
    ...normalizedHero,
    baseStats: normalizedHero.baseStats.filter((stat) => variableIds.has(stat.variableId)),
    startingInventory: normalizedHero.startingInventory.filter((entry) =>
      itemIds.has(entry.itemId),
    ),
  };
}

export function AuthorStudioApp() {
  const [seed] = useState<InitialStudio>(() => buildInitialStudio());
  const [nodes, setNodes] = useState<EditorNode[]>(seed.nodes);
  const [edges, setEdges] = useState<EditorEdge[]>(seed.edges);
  const [project, setProject] = useState<ProjectMeta>(seed.project);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(
    project.info.startBlockId,
  );
  const [lastValidation, setLastValidation] = useState<ValidationIssue[]>([]);
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [toasts, setToasts] = useState<Array<{ id: number; text: string; level: "info" | "warn" | "error"; exiting: boolean }>>([]);
  const toastIdRef = useRef(0);
  const importZipInputRef = useRef<HTMLInputElement | null>(null);
  const [newVariableName, setNewVariableName] = useState("");
  const [ownPasswordInput, setOwnPasswordInput] = useState("");
  const [ownPasswordConfirmInput, setOwnPasswordConfirmInput] = useState("");
  const [adminCreateUserEmailInput, setAdminCreateUserEmailInput] = useState("");
  const [adminCreateUserPasswordInput, setAdminCreateUserPasswordInput] = useState("");
  const [adminCreateUserRole, setAdminCreateUserRole] = useState<PlatformRole>("reader");
  const {
    supabase,
    supabaseProjectRef,
    authLoading,
    authUser,
    authEmailInput,
    authPasswordInput,
    cloudBusy,
    cloudProjectId,
    cloudOwnerId,
    cloudEditingLockUserId,
    cloudProjectUpdatedAt,
    cloudLatestUpdatedAt,
    cloudAccessLevel,
    cloudAccessRows,
    cloudProfiles,
    cloudLogs,
    cloudProjects,
    platformRole,
    platformProfiles,
    shareEmailInput,
    shareAccessLevel,
    setAuthEmailInput,
    setAuthPasswordInput,
    setCloudBusy,
    setCloudProjectId,
    setCloudOwnerId,
    setCloudEditingLockUserId,
    setCloudProjectUpdatedAt,
    setCloudLatestUpdatedAt,
    setCloudAccessLevel,
    setCloudAccessRows,
    setCloudProfiles,
    setCloudLogs,
    setCloudProjects,
    setPlatformRole,
    setPlatformProfiles,
    setShareEmailInput,
    setShareAccessLevel,
  } = useCloudProjectState(setStatusMessage);
  const [newProjectWarningOpen, setNewProjectWarningOpen] = useState(false);
  const [lastSavedFingerprint, setLastSavedFingerprint] = useState(() =>
    buildStudioChangeFingerprint(seed.project, seed.nodes, seed.edges, {}),
  );
  const rfInstanceRef = useRef<{ screenToFlowPosition: (pos: { x: number; y: number }) => { x: number; y: number } } | null>(null);

  const blocks = useMemo(() => nodes.filter((n) => n.type !== "chapterFolder").map((node) => blockFromNode(node)), [nodes]);
  const blockById = useMemo(
    () => new Map(blocks.map((block) => [block.id, block])),
    [blocks],
  );
  const {
    previewOpen,
    setPreviewOpen,
    previewState,
    previewBlock,
    previewInteractedSet,
    previewGameplayCompleted,
    previewGameplayProgressLabel,
    startPreview,
    continuePreview,
    pickPreviewChoice,
    pickPreviewObject,
    dropKeyOnLock,
    resetPreview,
  } = usePreviewRuntime({
    project,
    blockById,
    setStatusMessage,
  });
  const variableNameById = useMemo(
    () => new Map(project.variables.map((variable) => [variable.id, variable.name])),
    [project.variables],
  );
  const previewInventoryItems = useMemo(() => {
    if (!previewState) return [];
    return project.items.filter((item) => (previewState.inventory[item.id] ?? 0) > 0);
  }, [previewState, project.items]);

  const activeMember = useMemo(
    () => project.members.find((member) => member.id === project.activeMemberId) ?? null,
    [project.activeMemberId, project.members],
  );
  const lockHolder = useMemo(
    () =>
      project.members.find((member) => member.id === project.editingLockMemberId) ?? null,
    [project.editingLockMemberId, project.members],
  );
  const accountMustChangePassword = Boolean(
    (authUser?.user_metadata as Record<string, unknown> | undefined)?.must_change_password,
  );

  const isPlatformAdmin = platformRole === "admin";
  const canUseAuthorTools = isPlatformAdmin || platformRole === "author";
  const localCanEdit = true;
  const cloudCanWrite =
    canUseAuthorTools &&
    (isPlatformAdmin ||
      !cloudProjectId ||
      cloudAccessLevel === "owner" ||
      cloudAccessLevel === "write");
  const cloudCanManageAccess = Boolean(
    canUseAuthorTools && cloudProjectId && (isPlatformAdmin || cloudAccessLevel === "owner"),
  );
  const cloudLockHeldByOther =
    Boolean(cloudProjectId) &&
    Boolean(cloudEditingLockUserId) &&
    cloudEditingLockUserId !== authUser?.id;
  const cloudLockHolderName =
    cloudEditingLockUserId
      ? cloudProfiles[cloudEditingLockUserId]?.display_name ?? cloudEditingLockUserId
      : "libre";
  const cloudRevisionDrift =
    Boolean(cloudProjectId) &&
    Boolean(cloudProjectUpdatedAt) &&
    Boolean(cloudLatestUpdatedAt) &&
    cloudProjectUpdatedAt !== cloudLatestUpdatedAt;
  const canEdit = canUseAuthorTools && localCanEdit && cloudCanWrite && !cloudLockHeldByOther;

  // ── Safety net: auto-reset cloudBusy if stuck for more than 120 s ──
  useEffect(() => {
    if (!cloudBusy) return;
    const safety = window.setTimeout(() => {
      console.error("[AuthorStudio] cloudBusy stuck — force-resetting after 120 s");
      setCloudBusy(false);
      setStatusMessage("Operation cloud expiree (delai depasse). Reessaie ou recharge la page.");
    }, 120_000);
    return () => window.clearTimeout(safety);
  }, [cloudBusy, setCloudBusy, setStatusMessage]);

  const {
    refreshCloudSideData,
    appendCloudLog,
    acquireCloudLock,
    releaseCloudLock,
    refreshCloudProjects,
    refreshPlatformProfiles,
    setPlatformProfileRole,
    signInWithPassword,
    signUpWithPassword,
    signOutSupabase,
  } = useCloudProjectSession({
    supabase,
    allowSelfSignup,
    authUser,
    authEmailInput,
    authPasswordInput,
    platformRole,
    cloudProjectId,
    cloudOwnerId,
    cloudCanWrite,
    cloudEditingLockUserId,
    cloudProjects,
    setStatusMessage,
    setCloudBusy,
    setCloudAccessLevel,
    setCloudProjectId,
    setCloudOwnerId,
    setCloudEditingLockUserId,
    setCloudProjectUpdatedAt,
    setCloudLatestUpdatedAt,
    setCloudAccessRows,
    setCloudLogs,
    setCloudProjects,
    setCloudProfiles,
    setPlatformRole,
    setPlatformProfiles,
    setShareEmailInput,
  });
  const editBlockReason = !authUser
    ? "Acces restreint: connecte-toi pour utiliser la plateforme."
    : !canUseAuthorTools
      ? "Compte lecteur: un admin doit te passer en auteur pour activer les outils de creation."
      : !localCanEdit
        ? `Edition verrouillee. Seul ${lockHolder?.name ?? "un editeur"} peut modifier le graphe.`
        : cloudLockHeldByOther
          ? `Verrou cloud actif par ${cloudLockHolderName}.`
          : cloudProjectId && !cloudCanWrite
            ? "Droit cloud insuffisant: il faut un acces write ou owner pour modifier ce projet."
            : null;

  const deleteBlockRef = useRef<(blockId: string) => void>(() => {});
  const stableDeleteBlock = useCallback((blockId: string) => {
    deleteBlockRef.current(blockId);
  }, []);

  const collapsedChapterIds = useMemo(
    () => new Set(project.chapters.filter((ch) => ch.collapsed).map((ch) => ch.id)),
    [project.chapters],
  );

  /** Map chapterId → chapter_start node (used to position folder nodes) */
  const chapterStartNodeMap = useMemo(() => {
    const map = new Map<string, EditorNode>();
    for (const node of nodes) {
      if (node.data.block.type === "chapter_start" && node.data.block.chapterId) {
        map.set(node.data.block.chapterId, node);
      }
    }
    return map;
  }, [nodes]);

  /**
   * For each chapter, BFS from its chapter_start through the graph to discover
   * all blocks that belong to the chapter (stopping at chapter_end blocks which
   * are included but whose outgoing edges are NOT followed).
   * Returns Map<chapterId, Set<blockId>>.
   */
  const chapterBlockSets = useMemo(() => {
    const result = new Map<string, Set<string>>();
    for (const chapter of project.chapters) {
      const startNode = chapterStartNodeMap.get(chapter.id);
      if (!startNode) continue;

      const memberIds = new Set<string>();
      const queue = [startNode.id];

      while (queue.length > 0) {
        const blockId = queue.shift()!;
        if (memberIds.has(blockId)) continue;
        memberIds.add(blockId);

        const block = blockById.get(blockId);
        if (!block) continue;

        // chapter_end is included but don't follow past it
        if (block.type === "chapter_end") continue;

        // Follow all outgoing edges
        for (const edge of edges) {
          if (edge.source !== blockId) continue;
          if (memberIds.has(edge.target)) continue;
          const targetBlock = blockById.get(edge.target);
          // Don't cross into another chapter's start
          if (
            targetBlock?.type === "chapter_start" &&
            targetBlock.chapterId !== chapter.id
          ) continue;
          queue.push(edge.target);
        }
      }

      result.set(chapter.id, memberIds);
    }
    return result;
  }, [blockById, chapterStartNodeMap, edges, project.chapters]);

  /** Compute BFS-based block→chapter and build hidden set — both used below */
  const computeChapterContext = useCallback((chapId: string) => {
    const memberIds = chapterBlockSets.get(chapId);
    return memberIds ?? new Set<string>();
  }, [chapterBlockSets]);

  const toggleChapterCollapsed = useCallback((chapterId: string) => {
    const chapter = project.chapters.find((ch) => ch.id === chapterId);
    if (!chapter) return;

    const willCollapse = !chapter.collapsed;

    setProject((current) => ({
      ...current,
      chapters: current.chapters.map((ch) =>
        ch.id === chapterId ? { ...ch, collapsed: willCollapse } : ch,
      ),
    }));

    if (willCollapse) {
      // Insert a real folder node into the nodes array
      const startNode = chapterStartNodeMap.get(chapterId);
      const memberIds = computeChapterContext(chapterId);
      const folderNode: EditorNode = {
        id: `folder-${chapterId}`,
        type: "chapterFolder",
        position: startNode?.position ?? { x: 200, y: 200 },
        data: {
          block: { id: `folder-${chapterId}`, type: "chapter_start", name: chapter.name } as unknown as StoryBlock,
          isStart: false,
          hasError: false,
          hasWarning: false,
        },
      };
      setNodes((current) => [...current, folderNode]);
      // Deselect if selection is inside this chapter
      setSelectedBlockId((cur) => (cur && memberIds.has(cur) ? null : cur));
    } else {
      // Remove the folder node
      setNodes((current) => current.filter((n) => n.id !== `folder-${chapterId}`));
    }
  }, [chapterStartNodeMap, computeChapterContext, project.chapters]);

  /** Set of block IDs that belong to a currently collapsed chapter */
  const hiddenBlockIds = useMemo(() => {
    const set = new Set<string>();
    if (collapsedChapterIds.size === 0) return set;
    for (const [chapterId, memberIds] of chapterBlockSets) {
      if (!collapsedChapterIds.has(chapterId)) continue;
      for (const id of memberIds) {
        set.add(id);
      }
    }
    return set;
  }, [chapterBlockSets, collapsedChapterIds]);

  /** Validation skips blocks hidden inside collapsed chapters for perf */
  const liveIssues = useMemo(
    () => {
      if (hiddenBlockIds.size === 0) return validateStoryBlocks(blocks, project.info.startBlockId, project.items);
      const visible = blocks.filter((b) => !hiddenBlockIds.has(b.id));
      return validateStoryBlocks(visible, project.info.startBlockId, project.items);
    },
    [blocks, hiddenBlockIds, project.info.startBlockId, project.items],
  );

  const issuesByBlock = useMemo(() => {
    const map = new Map<string, { hasError: boolean; hasWarning: boolean }>();
    for (const issue of liveIssues) {
      if (!issue.blockId) continue;
      const current = map.get(issue.blockId) ?? { hasError: false, hasWarning: false };
      if (issue.level === "error") current.hasError = true;
      if (issue.level === "warning") current.hasWarning = true;
      map.set(issue.blockId, current);
    }
    return map;
  }, [liveIssues]);

  const displayNodes = useMemo(
    () => {
      const visible: Array<EditorNode & { data: StoryNodeData }> = [];

      for (const node of nodes) {
        // Skip hidden chapter blocks
        if (hiddenBlockIds.has(node.id)) continue;

        // Folder nodes get special data
        if (node.type === "chapterFolder") {
          const cid = node.id.replace("folder-", "");
          const chapter = project.chapters.find((ch) => ch.id === cid);
          const memberIds = chapterBlockSets.get(cid);
          if (!chapter?.collapsed) continue;

          visible.push({
            ...node,
            data: {
              block: node.data.block,
              isStart: false,
              hasError: false,
              hasWarning: false,
              chapterId: cid,
              chapterName: chapter.name,
              blockCount: memberIds?.size ?? 0,
              onExpand: toggleChapterCollapsed,
            } as unknown as StoryNodeData,
          });
          continue;
        }

        const flags = issuesByBlock.get(node.id) ?? {
          hasError: false,
          hasWarning: false,
        };
        visible.push({
          ...node,
          data: {
            ...node.data,
            isStart: project.info.startBlockId === node.id,
            hasError: flags.hasError,
            hasWarning: flags.hasWarning,
            canEdit,
            onDeleteBlock: stableDeleteBlock,
            onToggleChapterCollapse: toggleChapterCollapsed,
          },
        });
      }

      return visible;
    },
    [canEdit, chapterBlockSets, hiddenBlockIds, issuesByBlock, nodes, project.chapters, project.info.startBlockId, stableDeleteBlock, toggleChapterCollapsed],
  );

  const selectedNode = useMemo(
    () => nodes.find((node) => node.id === selectedBlockId) ?? null,
    [nodes, selectedBlockId],
  );
  const selectedBlock = selectedNode?.data.block ?? null;

  const visibleIssues = lastValidation.length > 0 ? lastValidation : liveIssues;
  const totalErrors = visibleIssues.filter((issue) => issue.level === "error").length;

  const logAction = useCallback((action: string, details: string) => {
    setProject((current) => {
      const entry = {
        id: createId("log"),
        memberId: current.activeMemberId,
        timestamp: new Date().toISOString(),
        action,
        details,
      };
      return {
        ...current,
        info: {
          ...current.info,
          updatedAt: entry.timestamp,
        },
        logs: [entry, ...current.logs].slice(0, 250),
      };
    });
  }, []);

  const {
    assetRefs,
    assetPreviewSrcById,
    setAssetRefs,
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
  } = useStudioAssets({
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
  });
  const currentFingerprint = useMemo(
    () => buildStudioChangeFingerprint(project, nodes, edges, assetRefs),
    [assetRefs, edges, nodes, project],
  );
  const hasUnsavedChanges = currentFingerprint !== lastSavedFingerprint;

  // ── Toast system: push statusMessage changes as auto-fading toasts ──
  const prevStatusRef = useRef("");
  useEffect(() => {
    if (!statusMessage || statusMessage === prevStatusRef.current) return;
    prevStatusRef.current = statusMessage;

    const level: "info" | "warn" | "error" = /erreur|error|echoue|timeout|refusee|expiree/i.test(
      statusMessage,
    )
      ? "error"
      : /attention|conflit|verrou|recharge/i.test(statusMessage)
        ? "warn"
        : "info";

    const id = ++toastIdRef.current;
    setToasts((prev) => [...prev, { id, text: statusMessage, level, exiting: false }]);

    // Each toast manages its own independent timers — not tied to useEffect cleanup
    // so that a new statusMessage never cancels a previous toast's removal.
    window.setTimeout(() => {
      setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, exiting: true } : t)));
    }, 4200);

    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4600);
  }, [statusMessage]);

  const markStudioClean = useCallback(
    (fingerprint?: string) => {
      setLastSavedFingerprint(fingerprint ?? currentFingerprint);
    },
    [currentFingerprint],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (!selectedBlock) return;

      if (selectedBlock.type === "npc_profile") {
        for (const assetId of selectedBlock.imageAssetIds) {
          void ensureAssetPreviewSrc(assetId);
        }
      }

      if (selectedBlock.type === "dialogue") {
        if (selectedBlock.backgroundAssetId) void ensureAssetPreviewSrc(selectedBlock.backgroundAssetId);
        if (selectedBlock.characterAssetId) void ensureAssetPreviewSrc(selectedBlock.characterAssetId);
        if (selectedBlock.npcImageAssetId) void ensureAssetPreviewSrc(selectedBlock.npcImageAssetId);
        for (const layer of selectedBlock.characterLayers ?? []) {
          if (layer.assetId) void ensureAssetPreviewSrc(layer.assetId);
        }
        if (selectedBlock.npcProfileBlockId) {
          const npcBlock = blockById.get(selectedBlock.npcProfileBlockId);
          if (npcBlock?.type === "npc_profile") {
            for (const imgId of npcBlock.imageAssetIds) {
              void ensureAssetPreviewSrc(imgId);
            }
          }
        }
      }

      if (selectedBlock.type === "cinematic") {
        if (selectedBlock.backgroundAssetId) void ensureAssetPreviewSrc(selectedBlock.backgroundAssetId);
        if (selectedBlock.characterAssetId) void ensureAssetPreviewSrc(selectedBlock.characterAssetId);
      }

      if (selectedBlock.type === "gameplay") {
        const wantedAssetIds = new Set<string>();
        if (selectedBlock.backgroundAssetId) wantedAssetIds.add(selectedBlock.backgroundAssetId);
        for (const obj of selectedBlock.objects) {
          if (obj.assetId) wantedAssetIds.add(obj.assetId);
        }
        for (const assetId of wantedAssetIds) {
          void ensureAssetPreviewSrc(assetId);
        }
      }
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [blockById, ensureAssetPreviewSrc, selectedBlock]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (!previewOpen || !previewState?.currentBlockId) return;

      const block = blockById.get(previewState.currentBlockId);
      if (!block) return;

      const wantedAssetIds = new Set<string>();
      if (block.type === "title") {
        if (block.backgroundAssetId) wantedAssetIds.add(block.backgroundAssetId);
      } else if (block.type === "cinematic") {
        if (block.backgroundAssetId) wantedAssetIds.add(block.backgroundAssetId);
        if (block.characterAssetId) wantedAssetIds.add(block.characterAssetId);
        if (block.videoAssetId) wantedAssetIds.add(block.videoAssetId);
        if (block.voiceAssetId) wantedAssetIds.add(block.voiceAssetId);
      } else if (block.type === "dialogue") {
        if (block.backgroundAssetId) wantedAssetIds.add(block.backgroundAssetId);
        if (block.characterAssetId) wantedAssetIds.add(block.characterAssetId);
        if (block.npcImageAssetId) wantedAssetIds.add(block.npcImageAssetId);
        for (const layer of block.characterLayers ?? []) {
          if (layer.assetId) wantedAssetIds.add(layer.assetId);
        }
        for (const line of block.lines) {
          if (line.voiceAssetId) wantedAssetIds.add(line.voiceAssetId);
        }
        if (block.npcProfileBlockId) {
          const npcBlock = blockById.get(block.npcProfileBlockId);
          if (npcBlock && npcBlock.type === "npc_profile") {
            for (const imageAssetId of npcBlock.imageAssetIds) {
              wantedAssetIds.add(imageAssetId);
            }
          }
        }
      } else if (block.type === "choice") {
        if (block.backgroundAssetId) wantedAssetIds.add(block.backgroundAssetId);
        if (block.voiceAssetId) wantedAssetIds.add(block.voiceAssetId);
        for (const choice of block.choices) {
          if (choice.imageAssetId) wantedAssetIds.add(choice.imageAssetId);
        }
      } else if (block.type === "npc_profile") {
        for (const imageAssetId of block.imageAssetIds) {
          wantedAssetIds.add(imageAssetId);
        }
        if (block.defaultImageAssetId) wantedAssetIds.add(block.defaultImageAssetId);
      } else if (block.type === "gameplay") {
        if (block.backgroundAssetId) wantedAssetIds.add(block.backgroundAssetId);
        if (block.voiceAssetId) wantedAssetIds.add(block.voiceAssetId);
        for (const obj of block.objects) {
          if (obj.assetId) wantedAssetIds.add(obj.assetId);
        }
      }

      for (const assetId of wantedAssetIds) {
        void ensureAssetPreviewSrc(assetId);
      }
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [blockById, ensureAssetPreviewSrc, previewOpen, previewState?.currentBlockId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      for (const item of project.items) {
        if (item.iconAssetId) {
          void ensureAssetPreviewSrc(item.iconAssetId);
        }
      }
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [ensureAssetPreviewSrc, project.items]);

  const touchProject = useCallback(() => {
    setProject((current) => ({
      ...current,
      info: {
        ...current.info,
        updatedAt: new Date().toISOString(),
      },
    }));
  }, []);

  const onNodesChange = useCallback((changes: NodeChange<EditorNode>[]) => {
    setNodes((current) => applyNodeChanges(changes, current));
  }, []);

  const onEdgesChange = useCallback((changes: EdgeChange<EditorEdge>[]) => {
    setEdges((current) => applyEdgeChanges(changes, current));
  }, []);

  const updateBlock = useCallback(
    (blockId: string, updater: (block: StoryBlock) => StoryBlock) => {
      setNodes((current) =>
        current.map((node) =>
          node.id === blockId
            ? {
                ...node,
                data: {
                  ...node.data,
                  block: updater(node.data.block),
                },
              }
            : node,
        ),
      );
      touchProject();
    },
    [touchProject],
  );

  const setConnection = useCallback(
    (sourceId: string, sourceHandle: string, targetId: string | null, targetHandle?: string | null) => {
      const targetLineId = lineIdFromHandle(targetHandle);

      setNodes((current) =>
        current.map((node) => {
          if (node.id !== sourceId) return node;

          if (node.data.block.type === "dialogue") {
            const respId = responseIdFromHandle(sourceHandle);
            if (!respId) return node;

            return {
              ...node,
              data: {
                ...node.data,
                block: {
                  ...node.data.block,
                  lines: node.data.block.lines.map((line) => ({
                    ...line,
                    responses: line.responses.map((resp) =>
                      resp.id === respId
                        ? { ...resp, targetBlockId: targetId, targetLineId: targetLineId }
                        : resp,
                    ),
                  })),
                },
              },
            };
          }

          if (node.data.block.type === "choice") {
            const label = choiceLabelFromHandle(sourceHandle);
            if (!label) return node;

            return {
              ...node,
              data: {
                ...node.data,
                block: {
                  ...node.data.block,
                  choices: node.data.block.choices.map((option) =>
                    option.label === label
                      ? { ...option, targetBlockId: targetId }
                      : option,
                  ),
                },
              },
            };
          }

          if (
            node.data.block.type === "hero_profile" ||
            node.data.block.type === "npc_profile"
          ) {
            return node;
          }

          return {
            ...node,
            data: {
              ...node.data,
              block: {
                ...node.data.block,
                nextBlockId: targetId,
              } as StoryBlock,
            },
          };
        }),
      );

      setEdges((current) => {
        const withoutCurrent = current.filter(
          (edge) =>
            !(
              edge.source === sourceId &&
              (edge.sourceHandle ?? "next") === sourceHandle
            ),
        );

        if (!targetId) return withoutCurrent;
        return [...withoutCurrent, buildEdge(sourceId, targetId, sourceHandle, undefined, targetHandle ?? undefined)];
      });

      touchProject();
    },
    [touchProject],
  );

  const linkNpcProfileToDialogue = useCallback(
    (npcBlockId: string, dialogueBlockId: string) => {
      setNodes((current) => {
        const npcBlock = current.find((node) => node.id === npcBlockId)?.data.block;
        if (!npcBlock || npcBlock.type !== "npc_profile") return current;

        return current.map((node) => {
          if (node.id !== dialogueBlockId || node.data.block.type !== "dialogue") return node;
          const selectedNpcImage =
            node.data.block.npcImageAssetId &&
            npcBlock.imageAssetIds.includes(node.data.block.npcImageAssetId)
              ? node.data.block.npcImageAssetId
              : null;

          return {
            ...node,
            data: {
              ...node.data,
              block: {
                ...node.data.block,
                npcProfileBlockId: npcBlockId,
                npcImageAssetId: selectedNpcImage,
              },
            },
          };
        });
      });

      setEdges((current) => {
        const withoutTargetNpcEdge = current.filter(
          (edge) => !((edge.sourceHandle ?? "") === "npc-link" && edge.target === dialogueBlockId),
        );
        const alreadyLinked = withoutTargetNpcEdge.some(
          (edge) =>
            edge.source === npcBlockId &&
            edge.target === dialogueBlockId &&
            (edge.sourceHandle ?? "") === "npc-link",
        );
        if (alreadyLinked) return withoutTargetNpcEdge;
        return [...withoutTargetNpcEdge, buildEdge(npcBlockId, dialogueBlockId, "npc-link")];
      });

      touchProject();
    },
    [touchProject],
  );

  const unlinkNpcProfileFromDialogue = useCallback(
    (dialogueBlockId: string) => {
      updateBlock(dialogueBlockId, (block) => {
        if (block.type !== "dialogue") return block;
        return {
          ...block,
          npcProfileBlockId: null,
          npcImageAssetId: null,
        };
      });
      setEdges((current) =>
        current.filter(
          (edge) => !((edge.sourceHandle ?? "") === "npc-link" && edge.target === dialogueBlockId),
        ),
      );
      touchProject();
    },
    [touchProject, updateBlock],
  );

  const addBlock = useCallback(
    (type: BlockType) => {
      if (!canEdit) return;

      let position = {
        x: 120 + (nodes.length % 5) * 90,
        y: 120 + Math.floor(nodes.length / 3) * 70,
      };

      // Place the new block at the center of the current viewport
      const rf = rfInstanceRef.current;
      if (rf) {
        const canvasEl = document.querySelector('.panel-canvas');
        if (canvasEl) {
          const rect = canvasEl.getBoundingClientRect();
          const center = rf.screenToFlowPosition({
            x: rect.x + rect.width / 2,
            y: rect.y + rect.height / 2,
          });
          // Small random offset so multiple consecutive blocks don't stack exactly
          position = {
            x: Math.round(center.x - 80 + (Math.random() * 60 - 30)),
            y: Math.round(center.y - 40 + (Math.random() * 60 - 30)),
          };
        }
      }

      const block = createBlock(type, position);

      // When adding a chapter_start block, also create a Chapter entry
      if (type === "chapter_start") {
        const chapterId = createId("chapter");
        (block as import("@/lib/story").ChapterStartBlock).chapterId = chapterId;
        (block as import("@/lib/story").ChapterStartBlock).chapterTitle = "Nouveau chapitre";
        setProject((current) => ({
          ...current,
          chapters: [
            ...current.chapters,
            { id: chapterId, name: "Nouveau chapitre", collapsed: false } satisfies Chapter,
          ],
          info: {
            ...current.info,
            startBlockId: current.info.startBlockId || block.id,
            updatedAt: new Date().toISOString(),
          },
        }));
      } else if (!project.info.startBlockId) {
        setProject((current) => ({
          ...current,
          info: {
            ...current.info,
            startBlockId: block.id,
            updatedAt: new Date().toISOString(),
          },
        }));
      }

      setNodes((current) => [...current, blockToNode(block)]);
      setSelectedBlockId(block.id);

      logAction("add_block", `${BLOCK_LABELS[type]} (${block.id})`);
      setStatusMessage(`${BLOCK_LABELS[type]} ajoute.`);
    },
    [canEdit, logAction, nodes.length, project.info.startBlockId],
  );

  const deleteBlock = useCallback((blockId: string) => {
    if (!canEdit) return;

    const deleted = blockById.get(blockId);
    if (!deleted) return;

    // If deleting a chapter_start, remove the chapter and unassign all blocks
    const deletedChapterId = deleted.type === "chapter_start" ? deleted.chapterId : null;

    setNodes((current) =>
      current
        .filter((node) => node.id !== blockId)
        .map((node) => {
          let block = removeNodeReferences(node.data.block, blockId);
          // Unassign blocks that belonged to the deleted chapter
          if (deletedChapterId && block.chapterId === deletedChapterId) {
            block = { ...block, chapterId: null };
          }
          return {
            ...node,
            data: { ...node.data, block },
          };
        }),
    );
    setEdges((current) =>
      current.filter(
        (edge) => edge.source !== blockId && edge.target !== blockId,
      ),
    );

    setProject((current) => ({
      ...current,
      chapters: deletedChapterId
        ? current.chapters.filter((ch) => ch.id !== deletedChapterId)
        : current.chapters,
      info: {
        ...current.info,
        startBlockId:
          current.info.startBlockId === blockId
            ? null
            : current.info.startBlockId,
        updatedAt: new Date().toISOString(),
      },
    }));

    if (selectedBlockId === blockId) setSelectedBlockId(null);
    logAction("delete_block", `${deleted.name} (${deleted.id})`);
    setStatusMessage(`Bloc ${deleted.name} supprime.`);
  }, [blockById, canEdit, logAction, selectedBlockId]);
  deleteBlockRef.current = deleteBlock;

  const deleteSelectedBlock = useCallback(() => {
    if (selectedBlockId) deleteBlock(selectedBlockId);
  }, [deleteBlock, selectedBlockId]);

  const duplicateSelectedBlock = useCallback(() => {
    if (!canEdit || !selectedBlock) return;

    // Deep-clone the block and assign fresh IDs
    const clone = structuredClone(selectedBlock) as unknown as Record<string, unknown>;
    const newId = createId(selectedBlock.type);
    clone.id = newId;
    clone.name = `${selectedBlock.name || BLOCK_LABELS[selectedBlock.type]} (copie)`;

    // Offset position so the duplicate doesn't overlap
    const pos = selectedBlock.position;
    clone.position = { x: pos.x + 60, y: pos.y + 60 };

    // Regenerate internal IDs for dialogue lines/responses
    if (selectedBlock.type === "dialogue") {
      const lines = clone.lines as Array<Record<string, unknown>>;
      const lineIdMap = new Map<string, string>();
      for (const line of lines) {
        const oldLineId = line.id as string;
        const newLineId = createId("line");
        lineIdMap.set(oldLineId, newLineId);
        line.id = newLineId;
        const responses = line.responses as Array<Record<string, unknown>>;
        for (const resp of responses) {
          resp.id = createId("resp");
          // Clear outgoing block connections — the user will re-wire them
          resp.targetBlockId = null;
        }
      }
      // Remap internal line-to-line navigation
      for (const line of lines) {
        const responses = line.responses as Array<Record<string, unknown>>;
        for (const resp of responses) {
          if (resp.targetLineId && lineIdMap.has(resp.targetLineId as string)) {
            resp.targetLineId = lineIdMap.get(resp.targetLineId as string)!;
          } else {
            resp.targetLineId = null;
          }
        }
      }
      // Update startLineId to match the new first line
      const oldStart = clone.startLineId as string;
      clone.startLineId = lineIdMap.get(oldStart) ?? (lines[0]?.id ?? "");
    }

    // Regenerate IDs for choice options
    if (selectedBlock.type === "choice") {
      const choices = clone.choices as Array<Record<string, unknown>>;
      for (const opt of choices) {
        opt.id = createId("opt");
        opt.targetBlockId = null;
      }
    }

    // Regenerate IDs for gameplay objects
    if (selectedBlock.type === "gameplay") {
      const objects = clone.objects as Array<Record<string, unknown>>;
      const idMap = new Map<string, string>();
      for (const obj of objects) {
        const oldId = obj.id as string;
        const freshId = createId("gobj");
        idMap.set(oldId, freshId);
        obj.id = freshId;
      }
      // Remap linkedKeyId references
      for (const obj of objects) {
        if (obj.linkedKeyId && idMap.has(obj.linkedKeyId as string)) {
          obj.linkedKeyId = idMap.get(obj.linkedKeyId as string)!;
        }
      }
      clone.nextBlockId = null;
    }

    // Clear nextBlockId for block types that have one
    if ("nextBlockId" in clone) {
      clone.nextBlockId = null;
    }

    const newBlock = normalizeStoryBlock(clone as unknown as StoryBlock);
    setNodes((current) => [...current, blockToNode(newBlock)]);
    setSelectedBlockId(newBlock.id);
    logAction("duplicate_block", `${BLOCK_LABELS[newBlock.type]} (${newBlock.id})`);
    setStatusMessage(`Bloc duplique: ${newBlock.name}`);
  }, [canEdit, selectedBlock, logAction]);

  const deleteEdge = useCallback(
    (sourceId: string, sourceHandle: string) => {
      if (!canEdit) return;
      const sourceBlock = blockById.get(sourceId);
      if (!sourceBlock) return;

      if (sourceHandle === "npc-link") {
        // Find the dialogue block linked to this NPC
        const linkedEdge = edges.find(
          (e) => e.source === sourceId && (e.sourceHandle ?? "") === "npc-link",
        );
        if (linkedEdge) {
          unlinkNpcProfileFromDialogue(linkedEdge.target);
          logAction("unlink_edge", `PNJ ${sourceBlock.name} -> dialogue`);
        }
        return;
      }

      setConnection(sourceId, sourceHandle, null);
      logAction("unlink_edge", `${sourceBlock.name} [${sourceHandle}]`);
    },
    [blockById, canEdit, edges, logAction, setConnection, unlinkNpcProfileFromDialogue],
  );

  /** Map blockId → chapterId — uses BFS-discovered sets, not just stored chapterId */
  const blockChapterMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const [chapterId, memberIds] of chapterBlockSets) {
      for (const blockId of memberIds) {
        map.set(blockId, chapterId);
      }
    }
    return map;
  }, [chapterBlockSets]);

  const displayEdges = useMemo(
    () => {
      if (collapsedChapterIds.size === 0) {
        return edges.map((edge) => ({
          ...edge,
          data: { ...edge.data, onDeleteEdge: canEdit ? deleteEdge : undefined },
        }));
      }

      const result: Array<EditorEdge & { data?: { onDeleteEdge?: typeof deleteEdge } }> = [];
      const seenFolderEdges = new Set<string>();

      for (const edge of edges) {
        const srcHidden = hiddenBlockIds.has(edge.source);
        const tgtHidden = hiddenBlockIds.has(edge.target);

        // Both hidden: skip entirely
        if (srcHidden && tgtHidden) continue;

        // Source hidden, target visible → redirect source to folder node
        if (srcHidden) {
          const srcChapterId = blockChapterMap.get(edge.source);
          if (!srcChapterId) continue;
          const key = `folder-${srcChapterId}->>${edge.target}`;
          if (seenFolderEdges.has(key)) continue;
          seenFolderEdges.add(key);
          result.push({
            ...edge,
            id: `folder-edge-${srcChapterId}-${edge.target}`,
            source: `folder-${srcChapterId}`,
            sourceHandle: "next",
            data: { ...edge.data, onDeleteEdge: undefined },
          });
          continue;
        }

        // Target hidden, source visible → redirect target to folder node
        if (tgtHidden) {
          const tgtChapterId = blockChapterMap.get(edge.target);
          if (!tgtChapterId) continue;
          const key = `${edge.source}->>folder-${tgtChapterId}`;
          if (seenFolderEdges.has(key)) continue;
          seenFolderEdges.add(key);
          result.push({
            ...edge,
            id: `folder-edge-${edge.source}-${tgtChapterId}`,
            target: `folder-${tgtChapterId}`,
            data: { ...edge.data, onDeleteEdge: undefined },
          });
          continue;
        }

        // Both visible: keep as-is
        result.push({
          ...edge,
          data: { ...edge.data, onDeleteEdge: canEdit ? deleteEdge : undefined },
        });
      }

      return result;
    },
    [blockChapterMap, canEdit, collapsedChapterIds.size, deleteEdge, edges, hiddenBlockIds],
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      if (!canEdit) return;
      if (!connection.source || !connection.target) return;

      const sourceNode = blockById.get(connection.source);
      if (!sourceNode) return;
      const targetNode = blockById.get(connection.target);
      if (!targetNode) return;

      if (sourceNode.type === "npc_profile") {
        if (targetNode.type !== "dialogue") {
          setStatusMessage("Le bloc PNJ peut uniquement se lier a un bloc Dialogue.");
          return;
        }
        linkNpcProfileToDialogue(sourceNode.id, targetNode.id);
        logAction("link_npc_dialogue", `${sourceNode.name} -> ${targetNode.name}`);
        return;
      }

      if (sourceNode.type === "hero_profile") {
        setStatusMessage("Le bloc Fiche Hero est visuel uniquement pour le moment.");
        return;
      }

      if (sourceNode.type === "dialogue") {
        const respId = responseIdFromHandle(connection.sourceHandle);
        if (!respId) return;
        const handle = `resp-${respId}`;
        setConnection(connection.source, handle, connection.target, connection.targetHandle);
        logAction("link", `${sourceNode.name} resp ${respId} -> ${connection.target}`);
        return;
      }

      if (sourceNode.type === "choice") {
        const label = choiceLabelFromHandle(connection.sourceHandle);
        if (!label) return;
        const handle = `choice-${label}`;
        setConnection(connection.source, handle, connection.target, connection.targetHandle);
        logAction("link", `${sourceNode.name} choix ${label} -> ${connection.target}`);
        return;
      }

      setConnection(connection.source, "next", connection.target, connection.targetHandle);
      logAction("link", `${sourceNode.name} -> ${connection.target}`);
    },
    [blockById, canEdit, linkNpcProfileToDialogue, logAction, setConnection, setStatusMessage],
  );

  const updateSelectedBlock = useCallback((updater: (block: StoryBlock) => StoryBlock) => {
    if (!canEdit || !selectedBlockId) return;
    updateBlock(selectedBlockId, updater);
  }, [canEdit, selectedBlockId, updateBlock]);

  const setSelectedDynamicField = useCallback((key: string, value: unknown) => {
    updateSelectedBlock((block) => {
      const updated = { ...block, [key]: value } as StoryBlock;
      // Sync chapter name when chapterTitle changes on chapter_start
      if (key === "chapterTitle" && block.type === "chapter_start" && block.chapterId && typeof value === "string") {
        setProject((current) => ({
          ...current,
          chapters: current.chapters.map((ch) =>
            ch.id === block.chapterId ? { ...ch, name: value } : ch,
          ),
        }));
      }
      return updated;
    });
  }, [updateSelectedBlock]);

  const onAssetInput = useCallback(
    (fieldName: string) =>
      createAssetInputHandler(fieldName, (targetField, assetId) => {
        setSelectedDynamicField(targetField, assetId);
      }),
    [createAssetInputHandler, setSelectedDynamicField],
  );

  const clearAsset = useCallback((fieldName: string) => {
    if (!canEdit) return;
    setSelectedDynamicField(fieldName, null);
  }, [canEdit, setSelectedDynamicField]);

  const renderAssetAttachment = useCallback(
    (fieldName: string, assetId: string | null) => (
      <div className="asset-line">
        <small>{getAssetFileName(assetId)}</small>
        <button
          className="button-secondary"
          onClick={() => clearAsset(fieldName)}
          disabled={!canEdit || !assetId}
        >
          Retirer
        </button>
      </div>
    ),
    [canEdit, clearAsset, getAssetFileName],
  );

  const renderAssetAttachmentWithRemove = useCallback(
    (assetId: string | null, onRemove: () => void) => (
      <div className="asset-line">
        <small>{getAssetFileName(assetId)}</small>
        <button
          className="button-secondary"
          onClick={onRemove}
          disabled={!canEdit || !assetId}
        >
          Retirer
        </button>
      </div>
    ),
    [canEdit, getAssetFileName],
  );

  const setStartBlock = (blockId: string) => {
    setProject((current) => ({
      ...current,
      info: {
        ...current.info,
        startBlockId: blockId,
        updatedAt: new Date().toISOString(),
      },
    }));
    logAction("set_start_block", blockId);
  };

  /* ---------- Domain operation hooks ---------- */

  const {
    addDialogueLine,
    removeDialogueLine,
    updateDialogueLineField,
    addDialogueLineResponse,
    removeDialogueLineResponse,
    updateDialogueResponseField,
    addResponseEffect,
    updateResponseEffect,
    removeResponseEffect,
  } = useDialogueOperations({
    canEdit,
    selectedBlock,
    updateSelectedBlock,
    setEdges,
    setConnection,
    touchProject,
    logAction,
    setStatusMessage,
    projectVariables: project.variables,
  });

  const {
    addChoiceOption,
    removeChoiceOption,
    updateChoiceOptionDescription,
    setChoiceOptionImage,
    clearChoiceOptionImage,
    updateChoiceField,
    addChoiceEffect,
    updateChoiceEffect,
    removeChoiceEffect,
  } = useChoiceOperations({
    canEdit,
    selectedBlock,
    updateSelectedBlock,
    setConnection,
    logAction,
    setStatusMessage,
    projectVariables: project.variables,
    registerAsset,
    ensureAssetPreviewSrc,
  });

  const {
    gameplayPlacementTarget,
    setGameplayPlacementTarget,
    resetGameplayState,
    addGameplayObject,
    removeGameplayObject,
    updateGameplayObject,
    updateGameplayObjectField,
    updateGameplayObjectRect,
    clearGameplayObjectAsset,
    clearGameplayObjectSound,
    addGameplayObjectEffect,
    updateGameplayObjectEffect,
    removeGameplayObjectEffect,
    addGameplayCompletionEffect,
    updateGameplayCompletionEffect,
    removeGameplayCompletionEffect,
    startGameplayObjectDrag,
    startGameplayObjectResize,
    onGameplayScenePointerMove,
    onGameplayScenePointerEnd,
    onGameplaySceneClick,
  } = useGameplayOperations({
    canEdit,
    selectedBlock,
    updateSelectedBlock,
    setStatusMessage,
  });

  const {
    addBlockEntryEffect,
    updateBlockEntryEffect,
    removeBlockEntryEffect,
  } = useBlockEffectOperations({
    selectedBlock,
    updateSelectedBlock,
    setStatusMessage,
    projectVariables: project.variables,
  });

  const hydrateStudioFromPayload = useCallback((payload: CloudPayload) => {
    const normalizedNodes = payload.nodes.map((node) => {
      const block = node.data.block as StoryBlock;
      const normalizedBlock = normalizeStoryBlock(block);
      return {
        ...node,
        data: {
          ...node.data,
          block: normalizedBlock,
        },
      } as EditorNode;
    });

    const normalizedProject: ProjectMeta = {
      ...payload.project,
      items: normalizeProjectItems((payload.project as ProjectMeta & { items?: unknown }).items),
      chapters: Array.isArray(payload.project.chapters) ? payload.project.chapters : [],
    };
    normalizedProject.hero = normalizeProjectHero(
      (payload.project as ProjectMeta & { hero?: unknown }).hero,
      normalizedProject.variables,
      normalizedProject.items,
    );

    setProject(normalizedProject);
    setNodes(normalizedNodes);
    setEdges(rebuildEdgesFromNodes(normalizedNodes));
    hydrateAssetRefs(payload.assetRefs ?? {});
    resetGameplayState();
    setCloudEditingLockUserId(null);
    setCloudProjectUpdatedAt(null);
    setCloudLatestUpdatedAt(null);
    setCloudProfiles({});
    setSelectedBlockId(normalizedProject.info.startBlockId ?? null);
    setLastValidation([]);
    markStudioClean(
      buildStudioChangeFingerprint(
        normalizedProject,
        normalizedNodes,
        rebuildEdgesFromNodes(normalizedNodes),
        payload.assetRefs ?? {},
      ),
    );
  }, [
    hydrateAssetRefs,
    markStudioClean,
    resetGameplayState,
    setCloudEditingLockUserId,
    setCloudLatestUpdatedAt,
    setCloudProfiles,
    setCloudProjectUpdatedAt,
  ]);

  const onDialogueLineVoiceInput = useCallback(
    (lineId: string) =>
      createAssetInputHandler("voiceAssetId", (_, assetId) => {
        updateBlock(selectedBlockId!, (block) => {
          if (block.type !== "dialogue") return block;
          return {
            ...block,
            lines: block.lines.map((l) =>
              l.id === lineId ? { ...l, voiceAssetId: assetId } : l,
            ),
          };
        });
      }),
    [createAssetInputHandler, selectedBlockId, updateBlock],
  );

  const renderLineVoiceAttachment = useCallback(
    (lineId: string, assetId: string | null) => (
      <div className="asset-line">
        <small>{getAssetFileName(assetId)}</small>
        <button
          className="button-secondary"
          onClick={() => {
            if (!canEdit || !selectedBlockId) return;
            updateBlock(selectedBlockId, (block) => {
              if (block.type !== "dialogue") return block;
              return {
                ...block,
                lines: block.lines.map((l) =>
                  l.id === lineId ? { ...l, voiceAssetId: null } : l,
                ),
              };
            });
          }}
          disabled={!canEdit || !assetId}
        >
          x
        </button>
      </div>
    ),
    [canEdit, getAssetFileName, selectedBlockId, updateBlock],
  );

  const addVariable = () => {
    if (!canEdit) return;
    const cleanName = newVariableName.trim();
    if (!cleanName) return;

    const exists = project.variables.some(
      (variable) => variable.name.toLowerCase() === cleanName.toLowerCase(),
    );
    if (exists) {
      setStatusMessage("Cette variable existe deja.");
      return;
    }

    setProject((current) => ({
      ...current,
      info: {
        ...current.info,
        updatedAt: new Date().toISOString(),
      },
      variables: [
        ...current.variables,
        { id: createId("var"), name: cleanName, initialValue: 0 },
      ],
    }));
    setNewVariableName("");
    logAction("add_variable", cleanName);
  };

  const deleteVariable = (variableId: string) => {
    if (!canEdit) return;

    const deleted = project.variables.find((variable) => variable.id === variableId);
    if (!deleted) return;

    setProject((current) => ({
      ...current,
      info: {
        ...current.info,
        updatedAt: new Date().toISOString(),
      },
      variables: current.variables.filter((variable) => variable.id !== variableId),
      hero: {
        ...current.hero,
        baseStats: current.hero.baseStats.filter((stat) => stat.variableId !== variableId),
      },
    }));

    setNodes((current) =>
      current.map((node) => ({
        ...node,
        data: {
          ...node.data,
          block: removeVariableReferences(node.data.block, variableId),
        },
      })),
    );
    setStatusMessage(`Variable ${deleted.name} supprimee.`);
    logAction("delete_variable", deleted.name);
  };

  const createItem = useCallback((name: string, iconFile: File | null) => {
    if (!canEdit) return false;
    const cleanName = name.trim();
    if (!cleanName) {
      setStatusMessage("Saisis un nom pour creer un objet.");
      return false;
    }
    if (!iconFile) {
      setStatusMessage("Ajoute une image pour cet objet.");
      return false;
    }

    const nameAlreadyUsed = project.items.some(
      (item) => item.name.toLowerCase() === cleanName.toLowerCase(),
    );
    if (nameAlreadyUsed) {
      setStatusMessage("Un objet avec ce nom existe deja.");
      return false;
    }

    const iconAssetId = registerAsset(iconFile);
    void ensureAssetPreviewSrc(iconAssetId);

    setProject((current) => ({
      ...current,
      info: {
        ...current.info,
        updatedAt: new Date().toISOString(),
      },
      items: [
        ...current.items,
        {
          id: createId("item"),
          name: cleanName,
          description: "",
          iconAssetId,
        },
      ],
    }));

    logAction("add_item", cleanName);
    setStatusMessage(`Objet ${cleanName} ajoute.`);
    return true;
  }, [canEdit, ensureAssetPreviewSrc, logAction, project.items, registerAsset, setStatusMessage]);

  const renameItem = useCallback((itemId: string, name: string) => {
    if (!canEdit) return;
    setProject((current) => ({
      ...current,
      info: {
        ...current.info,
        updatedAt: new Date().toISOString(),
      },
      items: current.items.map((item) =>
        item.id === itemId
          ? { ...item, name }
          : item,
      ),
    }));
  }, [canEdit]);

  const deleteItem = useCallback((itemId: string) => {
    if (!canEdit) return;

    const item = project.items.find((candidate) => candidate.id === itemId);
    if (!item) return;

    setProject((current) => ({
      ...current,
      info: {
        ...current.info,
        updatedAt: new Date().toISOString(),
      },
      items: current.items.filter((candidate) => candidate.id !== itemId),
      hero: {
        ...current.hero,
        startingInventory: current.hero.startingInventory.filter((entry) => entry.itemId !== itemId),
      },
    }));
    setNodes((current) =>
      current.map((node) => ({
        ...node,
        data: {
          ...node.data,
          block: removeItemReferences(node.data.block, itemId),
        },
      })),
    );
    logAction("delete_item", item.name);
    setStatusMessage(`Objet ${item.name} supprime. Les recompenses liees ont ete nettoyees.`);
  }, [canEdit, logAction, project.items, setStatusMessage]);

  const replaceItemIcon = useCallback((itemId: string, file: File) => {
    if (!canEdit) return;
    const assetId = registerAsset(file);
    void ensureAssetPreviewSrc(assetId);

    setProject((current) => ({
      ...current,
      info: {
        ...current.info,
        updatedAt: new Date().toISOString(),
      },
      items: current.items.map((item) =>
        item.id === itemId
          ? { ...item, iconAssetId: assetId }
          : item,
      ),
    }));
    logAction("replace_item_icon", file.name);
    setStatusMessage(`Image objet mise a jour: ${file.name}.`);
  }, [canEdit, ensureAssetPreviewSrc, logAction, registerAsset, setStatusMessage]);

  const runValidation = () => {
    setLastValidation(liveIssues);
    const errorCount = liveIssues.filter((issue) => issue.level === "error").length;
    const warningCount = liveIssues.filter((issue) => issue.level === "warning").length;
    setStatusMessage(
      `Validation terminee: ${errorCount} erreur(s), ${warningCount} warning(s).`,
    );
    logAction("validate", `${errorCount} erreur(s), ${warningCount} warning(s)`);
  };

  const resetStudioToBlank = (options?: { preserveStatusMessage?: boolean }) => {
    const fresh = buildInitialStudio();
    setProject(fresh.project);
    setNodes(fresh.nodes);
    setEdges(fresh.edges);
    clearAllAssetState();
    resetGameplayState();
    setSelectedBlockId(fresh.project.info.startBlockId ?? null);
    setLastValidation([]);
    resetPreview();
    setCloudProjectId(null);
    setCloudOwnerId(null);
    setCloudEditingLockUserId(null);
    setCloudProjectUpdatedAt(null);
    setCloudLatestUpdatedAt(null);
    setCloudAccessLevel(null);
    setCloudAccessRows([]);
    setCloudLogs([]);
    setCloudProfiles({});
    setShareEmailInput("");
    markStudioClean(buildStudioChangeFingerprint(fresh.project, fresh.nodes, fresh.edges, {}));
    if (!options?.preserveStatusMessage) {
      setStatusMessage("Nouveau projet initialise.");
    }
  };

  const {
    saveCloudProject,
    loadCloudProject,
    downloadCloudProjectBundle,
    grantCloudAccess,
    revokeCloudAccess,
    cleanupCloudOrphanAssets,
    deleteCloudProject,
  } = useCloudProjectActions({
    supabase,
    authUser,
    project,
    nodes,
    edges,
    blocks,
    assetRefs,
    getAssetBlob,
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
  });

  const changeOwnPassword = async () => {
    if (!supabase || !authUser) {
      setStatusMessage("Connecte-toi pour changer ton mot de passe.");
      return;
    }
    if (ownPasswordInput.length < 8) {
      setStatusMessage("Le nouveau mot de passe doit contenir au moins 8 caracteres.");
      return;
    }
    if (ownPasswordInput !== ownPasswordConfirmInput) {
      setStatusMessage("La confirmation du mot de passe ne correspond pas.");
      return;
    }

    setCloudBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: ownPasswordInput,
        data: { must_change_password: false },
      });
      if (error) {
        setStatusMessage(`Erreur changement mot de passe: ${error.message}`);
        return;
      }

      setOwnPasswordInput("");
      setOwnPasswordConfirmInput("");
      setStatusMessage("Mot de passe mis a jour.");
    } finally {
      setCloudBusy(false);
    }
  };

  const createUserFromAdminPanel = async () => {
    if (!supabase || !authUser || !isPlatformAdmin) {
      setStatusMessage("Action reservee aux admins connectes.");
      return;
    }

    const email = adminCreateUserEmailInput.trim().toLowerCase();
    if (!email) {
      setStatusMessage("Saisis un email utilisateur.");
      return;
    }
    if (adminCreateUserPasswordInput.length < 8) {
      setStatusMessage("Le mot de passe provisoire doit contenir au moins 8 caracteres.");
      return;
    }

    setCloudBusy(true);
    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.refreshSession();
      if (sessionError || !session?.access_token) {
        setStatusMessage(
          `Session admin expiree: ${sessionError?.message ?? "reconnecte-toi puis reessaie"}`,
        );
        return;
      }

      const response = await fetch("/api/admin/create-user", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-supabase-access-token": session.access_token,
        },
        body: JSON.stringify({
          email,
          password: adminCreateUserPasswordInput,
          role: adminCreateUserRole,
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        email?: string;
        role?: string;
      };
      if (!response.ok) {
        setStatusMessage(`Erreur creation compte: ${payload.error ?? "unknown"}`);
        return;
      }

      setAdminCreateUserEmailInput("");
      setAdminCreateUserPasswordInput("");
      setAdminCreateUserRole("reader");
      await refreshPlatformProfiles();
      setStatusMessage(
        `Compte cree: ${payload.email ?? email} (${payload.role ?? adminCreateUserRole}).`,
      );
    } finally {
      setCloudBusy(false);
    }
  };

  const requestNewProject = () => {
    setNewProjectWarningOpen(true);
  };

  const confirmNewProjectWithoutSave = () => {
    setNewProjectWarningOpen(false);
    resetStudioToBlank();
  };

  const saveCloudAndCreateNewProject = async () => {
    const saved = await saveCloudProject();
    if (!saved) return;
    setNewProjectWarningOpen(false);
    resetStudioToBlank({ preserveStatusMessage: true });
    setStatusMessage("Projet sauvegarde dans le cloud, puis nouveau projet initialise.");
  };

  const handleImportZip = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    event.target.value = "";

    const result = await importFromZip(file);
    if (!result) return;

    setProject(result.project);
    setNodes(result.nodes);
    setEdges(result.edges);
    resetGameplayState();
    setSelectedBlockId(result.project.info.startBlockId ?? null);
    setLastValidation([]);
    resetPreview();
    setCloudProjectId(null);
    setCloudOwnerId(null);
    setCloudEditingLockUserId(null);
    setCloudProjectUpdatedAt(null);
    setCloudLatestUpdatedAt(null);
    setCloudAccessLevel(null);
    setCloudAccessRows([]);
    setCloudLogs([]);
    setCloudProfiles({});
    setShareEmailInput("");
    markStudioClean(
      buildStudioChangeFingerprint(result.project, result.nodes, result.edges, result.assetRefs),
    );
  };

  return (
    <div className="studio-root">
      <header className="studio-header">
        <div className="studio-header-title">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/ui-assets/logo/crlogo.png"
            alt="CadaRium"
            className="studio-brand-icon"
          />
          <h1 className="studio-brand-name">
            CadaRium <em>Studio</em>
          </h1>
          <HelpHint title="Studio auteur">
            Espace de creation de light novel: construis les blocs, relie-les dans le graphe,
            valide puis exporte JSON + assets.
          </HelpHint>
        </div>
        <div className="studio-header-actions">
          {/* ── Navbar status indicators ── */}
          <div className="nav-indicators">
            <span className="nav-indicator" title={hasUnsavedChanges ? "Modifications non sauvegardees" : "Projet a jour"}>
              <span className={`nav-indicator-dot ${hasUnsavedChanges ? "nav-indicator-dot-unsaved" : "nav-indicator-dot-saved"}`} />
              {hasUnsavedChanges ? "Non sauvé" : "À jour"}
            </span>
            <span className="nav-indicator" title={`${totalErrors} erreur(s)`}>
              <span className={`nav-indicator-badge ${totalErrors > 0 ? "nav-badge-errors" : "nav-badge-ok"}`}>
                {totalErrors > 0 ? `⚠ ${totalErrors}` : "✓"}
              </span>
            </span>
            {cloudLockHeldByOther && (
              <span className="nav-indicator nav-indicator-lock" title={`Verrou: ${cloudLockHolderName}`}>
                🔒 {cloudLockHolderName}
              </span>
            )}
          </div>

          <a
            className="button-secondary nav-action-button nav-action-guide"
            href="/guide-premier-projet"
            target="_blank"
            rel="noreferrer"
          >
            Guide 1er projet
          </a>
          <button
            className="button-secondary nav-action-button nav-action-new"
            onClick={requestNewProject}
            disabled={!authUser || !canUseAuthorTools}
          >
            Nouveau projet
          </button>
          <button
            className="button-secondary nav-action-button nav-action-validate"
            onClick={runValidation}
            disabled={!authUser}
          >
            Valider
          </button>
          <button
            className="button-secondary nav-action-button nav-action-preview"
            onClick={startPreview}
            disabled={!authUser}
          >
            Preview
          </button>
          <button
            className="button-primary nav-action-button nav-action-export"
            onClick={exportZip}
            disabled={!authUser}
          >
            Export ZIP
          </button>
          <button
            className="button-secondary nav-action-button nav-action-import"
            onClick={() => importZipInputRef.current?.click()}
            disabled={!authUser || !canUseAuthorTools}
          >
            Import ZIP
          </button>
          <input
            ref={importZipInputRef}
            type="file"
            accept=".zip"
            style={{ display: "none" }}
            onChange={(event) => {
              void handleImportZip(event);
            }}
          />
        </div>
      </header>

      {/* ── Inline warnings (edit block / revision drift) ── */}
      {editBlockReason && <div className="warning-banner">{editBlockReason}</div>}
      {cloudRevisionDrift && (
        <div className="warning-banner">
          Une version cloud plus recente est disponible ({new Date(cloudLatestUpdatedAt ?? "").toLocaleString("fr-FR")}).
          Recharge le projet avant de sauvegarder pour eviter d&apos;ecraser le travail d&apos;un collaborateur.
        </div>
      )}

      {/* ── Toast notifications ── */}
      {toasts.length > 0 && (
        <div className="toast-container">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className={`toast toast-${toast.level}${toast.exiting ? " toast-exiting" : ""}`}
            >
              <span className="toast-icon">
                {toast.level === "error" ? "✕" : toast.level === "warn" ? "⚠" : "ℹ"}
              </span>
              <span className="toast-message">{toast.text}</span>
              <button
                className="toast-close"
                onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
                title="Fermer"
              >×</button>
            </div>
          ))}
        </div>
      )}

      <div className="studio-grid">
        <div className="panel-left-stack">
          <AuthorStudioCloudPanel
            supabaseEnabled={Boolean(supabase)}
            allowSelfSignup={allowSelfSignup}
            authLoading={authLoading}
            authUser={authUser}
            authEmailInput={authEmailInput}
            authPasswordInput={authPasswordInput}
            platformRole={platformRole}
            isPlatformAdmin={isPlatformAdmin}
            onAuthEmailInputChange={setAuthEmailInput}
            onAuthPasswordInputChange={setAuthPasswordInput}
            onSignIn={() => {
              void signInWithPassword();
            }}
            onSignUp={() => {
              void signUpWithPassword();
            }}
            onSignOut={() => {
              void signOutSupabase();
            }}
            ownPasswordInput={ownPasswordInput}
            ownPasswordConfirmInput={ownPasswordConfirmInput}
            accountMustChangePassword={accountMustChangePassword}
            onOwnPasswordInputChange={setOwnPasswordInput}
            onOwnPasswordConfirmInputChange={setOwnPasswordConfirmInput}
            onChangeOwnPassword={() => {
              void changeOwnPassword();
            }}
            onRefreshProjects={() => {
              void refreshCloudProjects();
            }}
            onSaveProject={() => {
              void saveCloudProject();
            }}
            onAcquireLock={() => {
              void acquireCloudLock();
            }}
            onReleaseLock={() => {
              void releaseCloudLock();
            }}
            onForceTakeoverLock={() => {
              void acquireCloudLock({ forceTakeover: true });
            }}
            cloudBusy={cloudBusy}
            cloudCanWrite={cloudCanWrite}
            cloudProjectId={cloudProjectId}
            cloudAccessLevel={cloudAccessLevel}
            cloudProjectUpdatedAt={cloudProjectUpdatedAt}
            cloudEditingLockUserId={cloudEditingLockUserId}
            cloudLockHolderName={cloudLockHolderName}
            cloudLockHeldByOther={cloudLockHeldByOther}
            cloudProjects={cloudProjects}
            onOpenProject={(projectId) => {
              void loadCloudProject(projectId);
            }}
            onDownloadProjectBundle={(projectId) => {
              void downloadCloudProjectBundle(projectId);
            }}
            onDeleteProject={(projectId) => {
              void deleteCloudProject(projectId);
            }}
            canEdit={canEdit}
            onCleanupLocalOrphanAssetRefs={cleanupLocalOrphanAssetRefs}
            onCleanupCloudOrphanAssets={() => {
              void cleanupCloudOrphanAssets();
            }}
            cloudCanManageAccess={cloudCanManageAccess}
            shareEmailInput={shareEmailInput}
            onShareEmailInputChange={setShareEmailInput}
            shareAccessLevel={shareAccessLevel}
            onShareAccessLevelChange={setShareAccessLevel}
            onGrantAccess={() => {
              void grantCloudAccess();
            }}
            cloudAccessRows={cloudAccessRows}
            cloudProfiles={cloudProfiles}
            onRevokeAccess={(userId) => {
              void revokeCloudAccess(userId);
            }}
            cloudLogs={cloudLogs}
            platformProfiles={platformProfiles}
            adminCreateUserEmailInput={adminCreateUserEmailInput}
            adminCreateUserPasswordInput={adminCreateUserPasswordInput}
            adminCreateUserRole={adminCreateUserRole}
            onAdminCreateUserEmailInputChange={setAdminCreateUserEmailInput}
            onAdminCreateUserPasswordInputChange={setAdminCreateUserPasswordInput}
            onAdminCreateUserRoleChange={setAdminCreateUserRole}
            onAdminCreateUser={() => {
              void createUserFromAdminPanel();
            }}
            onRefreshPlatformProfiles={() => {
              void refreshPlatformProfiles();
            }}
            onSetPlatformProfileRole={(userId, role) => {
              void setPlatformProfileRole(userId, role);
            }}
          />

          {authUser ? (
            <AuthorStudioProjectPanel
              project={project}
              setProject={setProject}
              canEdit={canEdit}
              newVariableName={newVariableName}
              onNewVariableNameChange={setNewVariableName}
              onAddVariable={addVariable}
              onDeleteVariable={deleteVariable}
              onAddBlock={addBlock}
              assetPreviewSrcById={assetPreviewSrcById}
              getAssetFileName={getAssetFileName}
              onCreateItem={createItem}
              onRenameItem={renameItem}
              onDeleteItem={deleteItem}
              onReplaceItemIcon={replaceItemIcon}
            />
          ) : (
            <aside className="panel panel-left">
              <section className="panel-section">
                <h2>Acces restreint</h2>
                <p className="empty-placeholder">
                  Connecte-toi avec un compte valide pour acceder au studio.
                </p>
              </section>
            </aside>
          )}
        </div>

        {authUser ? (
          <>
            <main className="panel panel-canvas">
              <ReactFlow
                nodes={displayNodes}
                edges={displayEdges}
                nodeTypes={nodeTypes}
                edgeTypes={edgeTypes}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                onInit={(instance) => { rfInstanceRef.current = instance as typeof rfInstanceRef.current; }}
                onNodeClick={(_, node) => {
                  // Folder nodes are virtual: don't select them as blocks
                  if (node.type === "chapterFolder") return;
                  setSelectedBlockId(node.id);
                }}
                nodesDraggable={canEdit}
                nodesConnectable={canEdit}
                elementsSelectable
                fitView
                deleteKeyCode={null}
              >
                <Background variant={BackgroundVariant.Dots} gap={14} size={1} />
                <MiniMap
                  pannable
                  zoomable
                  nodeStrokeWidth={3}
                  nodeColor={(node) => {
                    const block = (node.data as StoryNodeData).block;
                    return block ? blockTypeColor(block.type) : "#059669";
                  }}
                />
                <Controls />
              </ReactFlow>
            </main>

            <AuthorStudioBlockEditorPanel
              selectedBlock={selectedBlock}
              canEdit={canEdit}
              project={project}
              blocks={blocks}
              visibleIssues={visibleIssues}
              onDeleteSelectedBlock={deleteSelectedBlock}
              onDuplicateSelectedBlock={duplicateSelectedBlock}
              onRunValidation={runValidation}
              onSetStartBlock={setStartBlock}
              onSetSelectedDynamicField={setSelectedDynamicField}
              onUpdateSelectedBlock={updateSelectedBlock}
              onSetConnection={setConnection}
              onAssetInput={onAssetInput}
              renderAssetAttachment={renderAssetAttachment}
              renderAssetAttachmentWithRemove={renderAssetAttachmentWithRemove}
              onAddDialogueLine={addDialogueLine}
              onRemoveDialogueLine={removeDialogueLine}
              onUpdateDialogueLineField={updateDialogueLineField}
              onDialogueLineVoiceInput={onDialogueLineVoiceInput}
              renderLineVoiceAttachment={renderLineVoiceAttachment}
              onAddDialogueLineResponse={addDialogueLineResponse}
              onRemoveDialogueLineResponse={removeDialogueLineResponse}
              onUpdateDialogueResponseField={updateDialogueResponseField}
              onUpdateChoiceField={updateChoiceField}
              onUnlinkDialogueNpcProfile={unlinkNpcProfileFromDialogue}
              onAddChoiceOption={addChoiceOption}
              onRemoveChoiceOption={removeChoiceOption}
              onUpdateChoiceOptionDescription={updateChoiceOptionDescription}
              onSetChoiceOptionImage={setChoiceOptionImage}
              onClearChoiceOptionImage={clearChoiceOptionImage}
              onAddBlockEntryEffect={addBlockEntryEffect}
              onUpdateBlockEntryEffect={updateBlockEntryEffect}
              onRemoveBlockEntryEffect={removeBlockEntryEffect}
              onAddResponseEffect={addResponseEffect}
              onUpdateResponseEffect={updateResponseEffect}
              onRemoveResponseEffect={removeResponseEffect}
              onAddChoiceEffect={addChoiceEffect}
              onUpdateChoiceEffect={updateChoiceEffect}
              onRemoveChoiceEffect={removeChoiceEffect}
              onAddGameplayObject={addGameplayObject}
              onRemoveGameplayObject={removeGameplayObject}
              onUpdateGameplayObjectField={updateGameplayObjectField}
              onUpdateGameplayObjectRect={updateGameplayObjectRect}
              onClearGameplayObjectAsset={clearGameplayObjectAsset}
              onClearGameplayObjectSound={clearGameplayObjectSound}
              onAddGameplayObjectEffect={addGameplayObjectEffect}
              onUpdateGameplayObjectEffect={updateGameplayObjectEffect}
              onRemoveGameplayObjectEffect={removeGameplayObjectEffect}
              onAddGameplayCompletionEffect={addGameplayCompletionEffect}
              onUpdateGameplayCompletionEffect={updateGameplayCompletionEffect}
              onRemoveGameplayCompletionEffect={removeGameplayCompletionEffect}
              gameplayPlacementTarget={gameplayPlacementTarget}
              onSetGameplayPlacementTarget={setGameplayPlacementTarget}
              onStartGameplayObjectDrag={startGameplayObjectDrag}
              onStartGameplayObjectResize={startGameplayObjectResize}
              onGameplaySceneClick={onGameplaySceneClick}
              onGameplayScenePointerMove={onGameplayScenePointerMove}
              onGameplayScenePointerEnd={onGameplayScenePointerEnd}
              assetPreviewSrcById={assetPreviewSrcById}
              onRegisterAsset={registerAsset}
              onEnsureAssetPreviewSrc={ensureAssetPreviewSrc}
              onStatusMessage={setStatusMessage}
            />
          </>
        ) : (
          <main className="panel panel-canvas">
            <section className="panel-section">
              <h2>Inscription requise</h2>
              <p className="empty-placeholder">
                La plateforme est reservee aux comptes enregistres. Cree un compte, confirme ton
                email, puis connecte-toi.
              </p>
            </section>
          </main>
        )}
      </div>

      <footer className="studio-footer">
        <a className="studio-footer-link" href="/confidentialite" target="_blank" rel="noreferrer">
          Confidentialite
        </a>
        <span className="studio-footer-separator">·</span>
        <a className="studio-footer-link" href="/mentions-legales" target="_blank" rel="noreferrer">
          Mentions legales
        </a>
      </footer>

      {newProjectWarningOpen && (
        <div className="confirm-overlay">
          <div className="confirm-modal">
            <h2>Nouveau projet</h2>
            <p>Tu vas fermer le projet en cours et ouvrir une page vierge.</p>
            <p className="confirm-warning">
              {hasUnsavedChanges
                ? "Attention: des modifications ne sont pas encore sauvegardees."
                : "Pense a sauvegarder si besoin avant de quitter ce projet."}
            </p>
            <div className="confirm-actions">
              <button
                className="button-secondary"
                onClick={() => setNewProjectWarningOpen(false)}
                disabled={cloudBusy}
              >
                Annuler
              </button>
              <button
                className="button-danger"
                onClick={confirmNewProjectWithoutSave}
                disabled={cloudBusy}
              >
                Quitter sans sauvegarder
              </button>
            </div>
            <button
              className="button-primary confirm-save-button"
              onClick={() => {
                void saveCloudAndCreateNewProject();
              }}
              disabled={cloudBusy || !authUser || !supabase}
            >
              Sauvegarder cloud
            </button>
          </div>
        </div>
      )}

      {previewOpen && (
        <PreviewOverlay
          previewState={previewState}
          previewBlock={previewBlock}
          previewInteractedSet={previewInteractedSet}
          previewGameplayCompleted={previewGameplayCompleted}
          previewGameplayProgressLabel={previewGameplayProgressLabel}
          previewInventoryItems={previewInventoryItems}
          projectVariables={project.variables}
          assetPreviewSrcById={assetPreviewSrcById}
          blockById={blockById}
          onRestart={startPreview}
          onClose={() => setPreviewOpen(false)}
          onContinue={continuePreview}
          onPickChoice={pickPreviewChoice}
          onPickObject={pickPreviewObject}
          onDropKeyOnLock={dropKeyOnLock}
        />
      )}
    </div>
  );
}

