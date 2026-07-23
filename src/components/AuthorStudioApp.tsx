"use client";

import {
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
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

import { AuthorStudioAccountPanel } from "@/components/AuthorStudioAccountPanel";
import { AuthorStudioBlockEditorPanel } from "@/components/AuthorStudioBlockEditorPanel";
import { AuthorStudioProjectPanel } from "@/components/AuthorStudioProjectPanel";
import { ValidationModal, ValidationStatusButton } from "@/components/AuthorStudioValidation";
import { PreviewOverlay } from "@/components/PreviewOverlay";
import { StoryNode, StoryNodeData, DeletableEdge, ChapterFolderNode } from "@/components/StoryNode";
import { StudioHeader } from "@/components/StudioHeader";
import {
  StudioLeftNavigation,
  type StudioLeftSection,
} from "@/components/StudioLeftNavigation";
import { useBlockEffectOperations } from "@/components/useBlockEffectOperations";
import { useChoiceOperations } from "@/components/useChoiceOperations";
import { useAuth } from "@/components/useAuth";
import { usePlatformAdmin } from "@/components/usePlatformAdmin";
import { useDialogueOperations } from "@/components/useDialogueOperations";
import { useGameplayOperations } from "@/components/useGameplayOperations";
import { usePreviewRuntime } from "@/components/usePreviewRuntime";
import { useStudioAssets } from "@/components/useStudioAssets";
import { LoadedCloudProject, useCloudProjects } from "@/components/useCloudProjects";
import {
  EditorEdge,
  EditorNode,
  InitialStudio,
  blockFromNode,
  blockToNode,
  computeChapterBlockSets,
  buildStudioChangeFingerprint,
  buildEdge,
  buildInitialStudio,
  choiceLabelFromHandle,
   GAMEPLAY_BUTTON_SEQUENCE_FAILURE_HANDLE,
   GAMEPLAY_BUTTON_SEQUENCE_SUCCESS_HANDLE,
   SWITCH_DEFAULT_HANDLE,
   gameplayLockIdFromHandle,
   isCinematicAutoNextHandle,
   isDialogueAutoNextHandle,
   lineContinueIdFromHandle,
   lineIdFromHandle,
   narrationAutoNextIdFromHandle,
   narrationContinueIdFromHandle,
   narrationIdFromHandle,
   rebuildEdgesFromNodes,
   removeItemReferences,
   removeNodeReferences,
  removeVariableReferences,
  responseIdFromHandle,
  switchCaseIdFromHandle,
} from "@/components/author-studio-core";
import {
  duplicateClipboardBlocks,
  filterClipboardEligibleBlocks,
  sortBlocksForClipboard,
} from "@/components/author-studio-clipboard-utils";
import { PlatformRole } from "@/lib/backend/types";
import {
  BLOCK_LABELS,
  BlockType,
  Chapter,
  ChapterEndBlock,
  ProjectMeta,
  StoryBlock,
  ValidationIssue,
  blockTypeColor,
  createBlock,
  createId,
  validateStoryBlocks,
} from "@/lib/story";
import {
  StudioSnapshot,
  loadLatestSnapshot,
  promoteToSessionBackup,
  saveLatestSnapshot,
} from "@/lib/studioAutosave";
import {
  allocateUniqueId,
  mergeChaptersForZipImport,
  mergeHeroForZipImport,
  mergeItemsForZipImport,
  mergeVariablesForZipImport,
  normalizeProjectChapters,
  normalizeProjectHero,
  normalizeProjectItems,
  placeImportedNodes,
  remapBlockForZipImport,
  withCollapsedChapterFolders,
} from "@/components/author-studio-merge-utils";
import type { ZipImportMergeMaps } from "@/components/author-studio-merge-utils";

const nodeTypes: NodeTypes = { storyBlock: StoryNode, chapterFolder: ChapterFolderNode };
const edgeTypes: EdgeTypes = { deletable: DeletableEdge };
const DUPLICATE_POSITION_STEP = { x: 60, y: 60 };

interface ClipboardBlockSelection {
  blocks: StoryBlock[];
}

function prepareClipboardBlocks(blocks: StoryBlock[]) {
  const eligibleBlocks = sortBlocksForClipboard(filterClipboardEligibleBlocks(blocks));
  return {
    eligibleBlocks,
    ignoredCount: blocks.length - eligibleBlocks.length,
  };
}

function getSelectedBlockIdsFromNodes(candidateNodes: EditorNode[]) {
  return candidateNodes
    .filter((node) => node.type !== "chapterFolder" && node.selected)
    .map((node) => node.id);
}

function resolveFocusedBlockId(
  currentFocusedId: string | null,
  nextSelectedIds: string[],
  preferredFocusedId?: string | null,
) {
  if (preferredFocusedId && nextSelectedIds.includes(preferredFocusedId)) {
    return preferredFocusedId;
  }
  if (currentFocusedId && nextSelectedIds.includes(currentFocusedId)) {
    return currentFocusedId;
  }
  return nextSelectedIds[0] ?? null;
}

export function AuthorStudioApp() {
  const router = useRouter();
  const MAX_TOASTS = 8;
  const [seed] = useState<InitialStudio>(() => buildInitialStudio());
  const initialProject = useMemo<ProjectMeta>(
    () => ({
      ...seed.project,
      chapters: normalizeProjectChapters(seed.project.chapters),
    }),
    [seed.project],
  );
  const [nodes, setNodes] = useState<EditorNode[]>(seed.nodes);
  const [edges, setEdges] = useState<EditorEdge[]>(
    seed.edges.filter(
      (edge) => !isDialogueAutoNextHandle(edge.sourceHandle) && !isCinematicAutoNextHandle(edge.sourceHandle),
    ),
  );
  const [project, setProject] = useState<ProjectMeta>(initialProject);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(
    project.info.startBlockId,
  );
  const [openedValidatedChapterIds, setOpenedValidatedChapterIds] = useState<string[]>([]);
  const [lastValidation, setLastValidation] = useState<ValidationIssue[]>([]);
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [toasts, setToasts] = useState<Array<{ id: number; text: string; level: "info" | "warn" | "error"; exiting: boolean }>>([]);
  const toastIdRef = useRef(0);
  const toastTimersRef = useRef(new Map<number, { exitTimer: number; removeTimer: number }>());
  const toastsRef = useRef<typeof toasts>([]);
  const importZipInputRef = useRef<HTMLInputElement | null>(null);
  const [isImportingZip, setIsImportingZip] = useState(false);
  const [rightPanelHidden, setRightPanelHidden] = useState(false);
  const [activeLeftSection, setActiveLeftSection] = useState<StudioLeftSection>("blocks");
  const [validationModalOpen, setValidationModalOpen] = useState(false);
  const [accountModalOpen, setAccountModalOpen] = useState(false);
  const [accountModalMessage, setAccountModalMessage] = useState("");
  const [accountDeleteConfirmationInput, setAccountDeleteConfirmationInput] = useState("");
  const [adminModalOpen, setAdminModalOpen] = useState(false);
  const [adminModalMessage, setAdminModalMessage] = useState("");
  const [newVariableName, setNewVariableName] = useState("");
  const [ownPasswordInput, setOwnPasswordInput] = useState("");
  const [ownPasswordConfirmInput, setOwnPasswordConfirmInput] = useState("");
  const [adminCreateUserEmailInput, setAdminCreateUserEmailInput] = useState("");
  const [adminCreateUserPasswordInput, setAdminCreateUserPasswordInput] = useState("");
  const [adminCreateUserRole, setAdminCreateUserRole] = useState<PlatformRole>("reader");
  const [hoverSelectionActive, setHoverSelectionActive] = useState(false);
  const {
    backend,
    backendReady,
    authLoading,
    user: authUser,
    role: platformRole,
    isAdmin: isPlatformAdmin,
    canUseAuthorTools,
    busy: authBusy,
    signOut,
    changePassword,
  } = useAuth({ onNotice: setStatusMessage });
  const {
    profiles: platformProfiles,
    adminBusy,
    refreshProfiles: refreshPlatformProfiles,
    setProfileRole,
    createUser: adminCreateUser,
    deleteUser: adminDeleteUser,
  } = usePlatformAdmin({ backend, enabled: Boolean(authUser) && isPlatformAdmin });
  const [accountBusy, setAccountBusy] = useState(false);
  const actionBusy = authBusy || adminBusy || accountBusy;
  const [newProjectWarningOpen, setNewProjectWarningOpen] = useState(false);
  const [restoreCandidate, setRestoreCandidate] = useState<StudioSnapshot | null>(null);
  const [restoreCandidateSource, setRestoreCandidateSource] = useState<"local" | "cloud">("local");
  const [pendingCloudProject, setPendingCloudProject] = useState<LoadedCloudProject | null>(null);
  const lastAutosavedFingerprintRef = useRef<string | null>(null);
  const [lastSavedFingerprint, setLastSavedFingerprint] = useState(() =>
    buildStudioChangeFingerprint(initialProject, seed.nodes, seed.edges, {}),
  );
  const rfInstanceRef = useRef<{ screenToFlowPosition: (pos: { x: number; y: number }) => { x: number; y: number } } | null>(null);
  const clipboardRef = useRef<ClipboardBlockSelection | null>(null);
  const clipboardPasteCountRef = useRef(0);
  const hoverSelectionRef = useRef<{
    active: boolean;
    additive: boolean;
    baseSelectedIds: Set<string>;
    hoveredIds: Set<string>;
  }>({
    active: false,
    additive: false,
    baseSelectedIds: new Set<string>(),
    hoveredIds: new Set<string>(),
  });

  const blocks = useMemo(() => nodes.filter((n) => n.type !== "chapterFolder").map((node) => blockFromNode(node)), [nodes]);
  const blockById = useMemo(
    () => new Map(blocks.map((block) => [block.id, block])),
    [blocks],
  );
  const selectedBlockIds = useMemo(
    () => getSelectedBlockIdsFromNodes(nodes),
    [nodes],
  );
  const selectedBlocks = useMemo(
    () =>
      selectedBlockIds
        .map((blockId) => blockById.get(blockId) ?? null)
        .filter((block): block is StoryBlock => Boolean(block)),
    [blockById, selectedBlockIds],
  );
  const replaceSelectedBlocks = useCallback((blockIds: string[], preferredFocusedId?: string | null) => {
    const nextSelectedIds = Array.from(new Set(blockIds));
    const nextSelectedIdSet = new Set(nextSelectedIds);

    setNodes((current) =>
      current.map((node) => {
        const shouldSelect =
          node.type !== "chapterFolder" && nextSelectedIdSet.has(node.id);
        return node.selected === shouldSelect ? node : { ...node, selected: shouldSelect };
      }),
    );
    setSelectedBlockId((currentFocusedId) =>
      resolveFocusedBlockId(currentFocusedId, nextSelectedIds, preferredFocusedId),
    );
  }, []);

  const removeSelectedBlocks = useCallback((blockIds: Iterable<string>) => {
    const blockedIds = new Set(blockIds);
    setNodes((current) => {
      const next = current.map((node) => {
        if (node.type === "chapterFolder" || !blockedIds.has(node.id) || !node.selected) {
          return node;
        }
        return { ...node, selected: false };
      });
      const nextSelectedIds = getSelectedBlockIdsFromNodes(next);
      setSelectedBlockId((currentFocusedId) =>
        currentFocusedId && blockedIds.has(currentFocusedId)
          ? resolveFocusedBlockId(null, nextSelectedIds)
          : resolveFocusedBlockId(currentFocusedId, nextSelectedIds),
      );
      return next;
    });
  }, []);
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
    dropInventoryItemOnLock,
    equipPreviewInventoryItem,
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
  const previewInventoryCatalog = useMemo(() => {
    const catalog = new Map<string, { id: string; name: string; iconAssetId: string | null }>();
    for (const item of project.items) {
      catalog.set(item.id, {
        id: item.id,
        name: item.name,
        iconAssetId: item.iconAssetId,
      });
    }
    for (const candidateBlock of blocks) {
      if (candidateBlock.type !== "gameplay") continue;
      for (const obj of candidateBlock.objects) {
        if (obj.objectType !== "collectible") continue;
        const inventoryItemId = obj.grantItemId ?? obj.id;
        const existing = catalog.get(inventoryItemId);
        const blockName = candidateBlock.name.trim();
        const fallbackName =
          obj.name.trim() || (blockName ? `Objet (${blockName})` : "Objet collectible");
        if (!existing) {
          catalog.set(inventoryItemId, {
            id: inventoryItemId,
            name: fallbackName,
            iconAssetId: obj.assetId ?? null,
          });
          continue;
        }
        if (!existing.iconAssetId && obj.assetId) {
          catalog.set(inventoryItemId, {
            ...existing,
            iconAssetId: obj.assetId,
          });
        }
      }
    }
    return Array.from(catalog.values());
  }, [blocks, project.items]);
  const previewInventoryItems = useMemo(() => {
    if (!previewState) return [];
    return previewInventoryCatalog
      .map((item) => ({
        id: item.id,
        name: item.name,
        iconAssetId: item.iconAssetId,
        quantity: previewState.inventory[item.id] ?? 0,
      }))
      .filter((item) => item.quantity > 0);
  }, [previewInventoryCatalog, previewState]);

  const canEdit = canUseAuthorTools;
  const authInitial = (authUser?.email?.trim().charAt(0) ?? "?").toUpperCase();
  const adminCount = platformProfiles.filter((profile) => profile.platformRole === "admin").length;

  const stopHoverSelection = useCallback(() => {
    hoverSelectionRef.current = {
      active: false,
      additive: false,
      baseSelectedIds: new Set<string>(),
      hoveredIds: new Set<string>(),
    };
    setHoverSelectionActive(false);
  }, []);

  const handleCanvasPointerDownCapture = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    if (!canEdit || event.button !== 0) return;
    if (!event.shiftKey) return;

    const target = event.target as HTMLElement | null;
    if (!target) return;
    if (target.closest(".react-flow__node, .react-flow__edge, button, input, textarea, select, a")) {
      return;
    }
    if (!target.closest(".react-flow__pane")) {
      return;
    }

    hoverSelectionRef.current = {
      active: true,
      additive: event.ctrlKey || event.metaKey,
      baseSelectedIds: new Set(selectedBlockIds),
      hoveredIds: new Set<string>(),
    };
    setHoverSelectionActive(true);
  }, [canEdit, selectedBlockIds]);

  const handleHoverSelectionEnter = useCallback((_: ReactMouseEvent, node: EditorNode) => {
    if (node.type === "chapterFolder") return;

    const session = hoverSelectionRef.current;
    if (!session.active || session.hoveredIds.has(node.id)) return;

    session.hoveredIds.add(node.id);
    const nextSelectedIds = session.additive
      ? [...session.baseSelectedIds, ...session.hoveredIds]
      : [...session.hoveredIds];
    const nextSelectedIdSet = new Set(nextSelectedIds);
    setNodes((current) =>
      current.map((candidateNode) => {
        const shouldSelect =
          candidateNode.type !== "chapterFolder" && nextSelectedIdSet.has(candidateNode.id);
        return candidateNode.selected === shouldSelect
          ? candidateNode
          : { ...candidateNode, selected: shouldSelect };
      }),
    );
    setSelectedBlockId((currentFocusedId) =>
      resolveFocusedBlockId(currentFocusedId, nextSelectedIds, node.id),
    );
  }, []);

  useEffect(() => {
    if (!authUser) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.altKey) return;
      if (event.key.toLowerCase() !== "b") return;

      const target = event.target as HTMLElement | null;
      const tagName = target?.tagName?.toLowerCase();
      const isTypingTarget =
        Boolean(target?.isContentEditable) ||
        tagName === "input" ||
        tagName === "textarea" ||
        tagName === "select";
      if (isTypingTarget) return;

      event.preventDefault();
      setRightPanelHidden((current) => !current);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [authUser]);

  useEffect(() => {
    const handlePointerUp = () => stopHoverSelection();
    const handleWindowBlur = () => stopHoverSelection();

    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("blur", handleWindowBlur);
    return () => {
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("blur", handleWindowBlur);
    };
  }, [stopHoverSelection]);

  useEffect(() => {
    if (!accountModalOpen && !adminModalOpen && !validationModalOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setValidationModalOpen(false);
        if (!actionBusy) {
          setAccountModalOpen(false);
          setAdminModalOpen(false);
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [accountModalOpen, adminModalOpen, actionBusy, validationModalOpen]);

  useEffect(() => {
    if (!authUser) {
      setValidationModalOpen(false);
      setAccountModalOpen(false);
      setAccountModalMessage("");
      setAccountDeleteConfirmationInput("");
      setAdminModalOpen(false);
      setAdminModalMessage("");
    }
  }, [authUser]);

  useEffect(() => {
    if (!isPlatformAdmin) {
      setAdminModalOpen(false);
      setAdminModalMessage("");
    }
  }, [isPlatformAdmin]);

  const editBlockReason = !authUser
    ? "Acces restreint: connecte-toi pour utiliser la plateforme."
    : !canUseAuthorTools
      ? "Compte lecteur: un admin doit te passer en auteur pour activer les outils de creation."
      : null;

  const deleteBlockRef = useRef<(blockId: string) => void>(() => {});
  const stableDeleteBlock = useCallback((blockId: string) => {
    deleteBlockRef.current(blockId);
  }, []);

  const openedValidatedChapterIdSet = useMemo(
    () => new Set(openedValidatedChapterIds),
    [openedValidatedChapterIds],
  );

  useEffect(() => {
    const validChapterIdSet = new Set(
      project.chapters.filter((chapter) => chapter.validated).map((chapter) => chapter.id),
    );
    setOpenedValidatedChapterIds((current) => {
      const next = current.filter((chapterId) => validChapterIdSet.has(chapterId));
      return next.length === current.length ? current : next;
    });
  }, [project.chapters]);

  const collapsedChapterIds = useMemo(
    () =>
      new Set(
        project.chapters
          .filter((ch) => ch.collapsed && !ch.validated)
          .map((ch) => ch.id),
      ),
    [project.chapters],
  );

  const hiddenValidatedChapterIds = useMemo(
    () =>
      new Set(
        project.chapters
          .filter((chapter) => chapter.validated && !openedValidatedChapterIdSet.has(chapter.id))
          .map((chapter) => chapter.id),
      ),
    [openedValidatedChapterIdSet, project.chapters],
  );

  const hiddenChapterIds = useMemo(() => {
    const ids = new Set<string>();
    for (const chapterId of collapsedChapterIds) ids.add(chapterId);
    for (const chapterId of hiddenValidatedChapterIds) ids.add(chapterId);
    return ids;
  }, [collapsedChapterIds, hiddenValidatedChapterIds]);

  const edgesWithAutoDialogueLinks = useMemo(() => {
    const manualEdges = edges.filter(
      (edge) => !isDialogueAutoNextHandle(edge.sourceHandle) && !isCinematicAutoNextHandle(edge.sourceHandle),
    );
    const autoEdges = rebuildEdgesFromNodes(nodes).filter((edge) =>
      isDialogueAutoNextHandle(edge.sourceHandle) || isCinematicAutoNextHandle(edge.sourceHandle),
    );
    return [...manualEdges, ...autoEdges];
  }, [edges, nodes]);

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
  const chapterBlockSets = useMemo(
    () => computeChapterBlockSets(nodes, edgesWithAutoDialogueLinks, project.chapters),
    [edgesWithAutoDialogueLinks, nodes, project.chapters],
  );

  /** Compute BFS-based block→chapter and build hidden set — both used below */
  const computeChapterContext = useCallback((chapId: string) => {
    const memberIds = chapterBlockSets.get(chapId);
    return memberIds ?? new Set<string>();
  }, [chapterBlockSets]);

  const resolveChapterIdForBlock = useCallback((blockId: string): string | null => {
    const directChapterId = blockById.get(blockId)?.chapterId;
    if (directChapterId) return directChapterId;
    for (const chapter of project.chapters) {
      if (chapterBlockSets.get(chapter.id)?.has(blockId)) {
        return chapter.id;
      }
    }
    return null;
  }, [blockById, chapterBlockSets, project.chapters]);

  const chapterEndOptionsByChapterId = useMemo(() => {
    const result: Record<string, ChapterEndBlock[]> = {};
    for (const chapter of project.chapters) {
      result[chapter.id] = [];
    }
    for (const block of blocks) {
      if (block.type !== "chapter_end") continue;
      const chapterId = resolveChapterIdForBlock(block.id);
      if (!chapterId || !result[chapterId]) continue;
      result[chapterId].push(block);
    }
    return result;
  }, [blocks, project.chapters, resolveChapterIdForBlock]);

  const toggleChapterCollapsed = useCallback((chapterId: string) => {
    const chapter = project.chapters.find((ch) => ch.id === chapterId);
    if (!chapter) return;
    if (chapter.validated) {
      setStatusMessage("Un chapitre valide se gere depuis la liste des chapitres valides.");
      return;
    }

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
      removeSelectedBlocks(memberIds);
    } else {
      // Remove the folder node
      setNodes((current) => current.filter((n) => n.id !== `folder-${chapterId}`));
    }
  }, [chapterStartNodeMap, computeChapterContext, project.chapters, removeSelectedBlocks]);

  /** Set of block IDs hidden because their chapter is collapsed or validated/archived. */
  const hiddenBlockIds = useMemo(() => {
    const set = new Set<string>();
    if (hiddenChapterIds.size === 0) return set;
    for (const [chapterId, memberIds] of chapterBlockSets) {
      if (!hiddenChapterIds.has(chapterId)) continue;
      for (const id of memberIds) {
        set.add(id);
      }
    }
    return set;
  }, [chapterBlockSets, hiddenChapterIds]);

  /** Validation skips blocks hidden inside collapsed chapters for perf */
  const liveIssues = useMemo(
    () => {
      if (hiddenBlockIds.size === 0) {
        return validateStoryBlocks(blocks, project.info.startBlockId, project.items, project.variables);
      }
      const visible = blocks.filter((b) => !hiddenBlockIds.has(b.id));
      return validateStoryBlocks(visible, project.info.startBlockId, project.items, project.variables);
    },
    [blocks, hiddenBlockIds, project.info.startBlockId, project.items, project.variables],
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
          if (!chapter?.collapsed || chapter.validated) continue;

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
  const totalWarnings = visibleIssues.filter((issue) => issue.level === "warning").length;
  const validationLevel =
    totalErrors > 0 ? "error" : totalWarnings > 0 ? "warning" : "ok";
  const validationSummary =
    totalErrors > 0
      ? `${totalErrors} erreur(s)`
      : totalWarnings > 0
        ? `${totalWarnings} warning(s)`
        : "Aucun probleme";

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

  const setChapterValidationFromEnd = useCallback((chapterEndBlockId: string, validated: boolean) => {
    if (!canEdit) return;
    const endBlock = blockById.get(chapterEndBlockId);
    if (!endBlock || endBlock.type !== "chapter_end") return;
    const chapterId = resolveChapterIdForBlock(chapterEndBlockId);
    if (!chapterId) {
      setStatusMessage("Impossible de determiner le chapitre de cette fin de chapitre.");
      return;
    }
    const chapter = project.chapters.find((candidate) => candidate.id === chapterId);
    if (!chapter) {
      setStatusMessage("Chapitre introuvable pour cette fin de chapitre.");
      return;
    }

    setProject((current) => ({
      ...current,
      chapters: current.chapters.map((candidate) =>
        candidate.id === chapterId
          ? { ...candidate, validated, collapsed: validated ? false : candidate.collapsed }
          : candidate,
      ),
      info: {
        ...current.info,
        updatedAt: new Date().toISOString(),
      },
    }));

    if (validated) {
      setOpenedValidatedChapterIds((current) => current.filter((id) => id !== chapterId));
      setNodes((current) => current.filter((node) => node.id !== `folder-${chapterId}`));
      const memberIds = computeChapterContext(chapterId);
      removeSelectedBlocks(memberIds);
      setStatusMessage(`Chapitre "${chapter.name}" valide et archive dans la liste.`);
      return;
    }

    setStatusMessage(`Chapitre "${chapter.name}" remis en edition sur le whiteboard.`);
  }, [blockById, canEdit, computeChapterContext, project.chapters, removeSelectedBlocks, resolveChapterIdForBlock, setStatusMessage]);

  const toggleValidatedChapterVisibility = useCallback((chapterId: string) => {
    const chapter = project.chapters.find((candidate) => candidate.id === chapterId);
    if (!chapter || !chapter.validated) return;

    const isOpen = openedValidatedChapterIdSet.has(chapterId);
    if (isOpen) {
      setOpenedValidatedChapterIds((current) => current.filter((id) => id !== chapterId));
      const memberIds = computeChapterContext(chapterId);
      removeSelectedBlocks(memberIds);
      setStatusMessage(`Chapitre "${chapter.name}" masque du whiteboard.`);
      return;
    }

    setOpenedValidatedChapterIds((current) => [...current, chapterId]);
    const chapterStartNode = chapterStartNodeMap.get(chapterId);
    if (chapterStartNode) {
      replaceSelectedBlocks([chapterStartNode.id], chapterStartNode.id);
    }
    setStatusMessage(`Chapitre "${chapter.name}" reouvert sur le whiteboard.`);
  }, [
    chapterStartNodeMap,
    computeChapterContext,
    openedValidatedChapterIdSet,
    project.chapters,
    removeSelectedBlocks,
    replaceSelectedBlocks,
    setStatusMessage,
  ]);

  const setChapterStartPreviousLink = useCallback((
    chapterStartBlockId: string,
    previousChapterId: string | null,
    previousChapterEndBlockId: string | null,
  ) => {
    if (!canEdit) return;
    const startBlock = blockById.get(chapterStartBlockId);
    if (!startBlock || startBlock.type !== "chapter_start") return;
    const previousLinkedEndBlockId = startBlock.linkedFromChapterEndBlockId ?? null;

    const selectedEndBlock = previousChapterEndBlockId
      ? blockById.get(previousChapterEndBlockId)
      : null;
    let inferredChapterIdFromEnd: string | null = null;
    if (selectedEndBlock && selectedEndBlock.type === "chapter_end") {
      if (
        selectedEndBlock.chapterId &&
        selectedEndBlock.chapterId !== startBlock.chapterId &&
        project.chapters.some((chapter) => chapter.id === selectedEndBlock.chapterId)
      ) {
        inferredChapterIdFromEnd = selectedEndBlock.chapterId;
      } else {
        for (const chapter of project.chapters) {
          if (chapter.id === startBlock.chapterId) continue;
          if (chapterBlockSets.get(chapter.id)?.has(selectedEndBlock.id)) {
            inferredChapterIdFromEnd = chapter.id;
            break;
          }
        }
      }
    }

    const candidateChapterId =
      previousChapterId && previousChapterId !== startBlock.chapterId
        ? previousChapterId
        : inferredChapterIdFromEnd;
    const normalizedChapterId =
      candidateChapterId &&
      project.chapters.some((chapter) => chapter.id === candidateChapterId)
        ? candidateChapterId
        : null;
    let normalizedEndBlockId = previousChapterEndBlockId ?? null;
    if (normalizedEndBlockId) {
      const selectedEnd = blockById.get(normalizedEndBlockId);
      if (
        !selectedEnd ||
        selectedEnd.type !== "chapter_end"
      ) {
        normalizedEndBlockId = null;
      }
    }

    setNodes((current) => {
      const storyNodes = current.filter((node) => node.type !== "chapterFolder");
      const folderNodes = current.filter((node) => node.type === "chapterFolder");

      const updatedStoryNodes = storyNodes.map((node) => {
        const block = node.data.block;
        if (block.type === "chapter_start") {
          if (node.id === chapterStartBlockId) {
            return {
              ...node,
              data: {
                ...node.data,
                block: {
                  ...block,
                  linkedFromChapterId: normalizedChapterId,
                  linkedFromChapterEndBlockId: normalizedEndBlockId,
                },
              },
            };
          }
          if (
            normalizedEndBlockId &&
            block.linkedFromChapterEndBlockId === normalizedEndBlockId
          ) {
            return {
              ...node,
              data: {
                ...node.data,
                block: {
                  ...block,
                  linkedFromChapterId: null,
                  linkedFromChapterEndBlockId: null,
                },
              },
            };
          }
        }

        if (block.type === "chapter_end") {
          if (normalizedEndBlockId && node.id === normalizedEndBlockId) {
            return {
              ...node,
              data: {
                ...node.data,
                block: {
                  ...block,
                  nextBlockId: chapterStartBlockId,
                },
              },
            };
          }
          if (
            !normalizedEndBlockId &&
            previousLinkedEndBlockId &&
            node.id === previousLinkedEndBlockId &&
            block.nextBlockId === chapterStartBlockId
          ) {
            return {
              ...node,
              data: {
                ...node.data,
                block: {
                  ...block,
                  nextBlockId: null,
                },
              },
            };
          }
        }
        return node;
      });

      const rebuiltEdges = rebuildEdgesFromNodes(updatedStoryNodes).filter(
        (edge) => !isDialogueAutoNextHandle(edge.sourceHandle) && !isCinematicAutoNextHandle(edge.sourceHandle),
      );
      setEdges(rebuiltEdges);
      return withCollapsedChapterFolders([...folderNodes, ...updatedStoryNodes], project.chapters);
    });

    setProject((current) => ({
      ...current,
      info: {
        ...current.info,
        updatedAt: new Date().toISOString(),
      },
    }));

    if (!normalizedChapterId && !normalizedEndBlockId) {
      setStatusMessage("Lien avec le chapitre precedent retire.");
      return;
    }
    if (normalizedChapterId && !normalizedEndBlockId) {
      setStatusMessage("Chapitre precedent choisi. Selectionne une sortie de fin pour relier.");
      return;
    }
    if (!normalizedChapterId && normalizedEndBlockId) {
      setStatusMessage("Sortie de fin raccordee. Assigne ce bloc fin a un chapitre pour afficher le precedent.");
      return;
    }
    setStatusMessage("Debut de chapitre raccorde a la sortie de fin selectionnee.");
  }, [blockById, canEdit, chapterBlockSets, project.chapters, setStatusMessage]);

  const {
    assetRefs,
    assetPreviewSrcById,
    setAssetRefs,
    ensureAssetPreviewSrc,
    registerAsset,
    createAssetInputHandler,
    getAssetFileName,
    clearAllAssetState,
    exportZip,
    importFromZip,
  } = useStudioAssets({
    blocks,
    project,
    edges,
    variableNameById,
    openedValidatedChapterIds,
    canEdit,
    setLastValidation,
    setStatusMessage,
    logAction,
  });
  const currentFingerprint = useMemo(
    () => buildStudioChangeFingerprint(project, nodes, edges, assetRefs),
    [assetRefs, edges, nodes, project],
  );
  const hasUnsavedChanges = currentFingerprint !== lastSavedFingerprint;
  const cloudProjects = useCloudProjects(
    backend,
    Boolean(authUser && canUseAuthorTools && backend?.projects && backend.assets),
    authUser?.id ?? null,
  );

  const createCurrentSnapshot = useCallback((): StudioSnapshot => ({
    savedAt: new Date().toISOString(),
    fingerprint: currentFingerprint,
    project,
    blocks,
    assetRefs,
    openedValidatedChapterIds,
  }), [assetRefs, blocks, currentFingerprint, openedValidatedChapterIds, project]);

  useEffect(() => {
    toastsRef.current = toasts;
  }, [toasts]);

  const clearToastTimers = useCallback((toastId: number) => {
    const timers = toastTimersRef.current.get(toastId);
    if (!timers) return;
    window.clearTimeout(timers.exitTimer);
    window.clearTimeout(timers.removeTimer);
    toastTimersRef.current.delete(toastId);
  }, []);

  const dismissToast = useCallback((toastId: number) => {
    clearToastTimers(toastId);
    setToasts((prev) => prev.filter((toast) => toast.id !== toastId));
  }, [clearToastTimers]);

  useEffect(() => () => {
    for (const timers of toastTimersRef.current.values()) {
      window.clearTimeout(timers.exitTimer);
      window.clearTimeout(timers.removeTimer);
    }
    toastTimersRef.current.clear();
  }, []);

  // Toast system: push statusMessage changes as auto-fading toasts.
  const prevStatusRef = useRef<{ text: string; timestamp: number }>({
    text: "",
    timestamp: 0,
  });
  useEffect(() => {
    if (!statusMessage) return;
    const now = Date.now();
    const isRecentDuplicate =
      statusMessage === prevStatusRef.current.text &&
      now - prevStatusRef.current.timestamp < 1200;
    if (isRecentDuplicate) return;
    prevStatusRef.current = { text: statusMessage, timestamp: now };

    const level: "info" | "warn" | "error" = /erreur|error|echoue|timeout|refusee|expiree/i.test(
      statusMessage,
    )
      ? "error"
      : /attention|conflit|verrou|recharge/i.test(statusMessage)
        ? "warn"
        : "info";

    const id = ++toastIdRef.current;
    setToasts((prev) => {
      const next = [...prev, { id, text: statusMessage, level, exiting: false }];
      if (next.length <= MAX_TOASTS) return next;

      const overflow = next.length - MAX_TOASTS;
      const evicted = next.slice(0, overflow);
      for (const toast of evicted) {
        clearToastTimers(toast.id);
      }
      return next.slice(overflow);
    });

    const exitTimer = window.setTimeout(() => {
      if (!toastsRef.current.some((toast) => toast.id === id)) {
        clearToastTimers(id);
        return;
      }
      setToasts((prev) =>
        prev.map((toast) => (toast.id === id ? { ...toast, exiting: true } : toast)),
      );
    }, 4200);

    const removeTimer = window.setTimeout(() => {
      dismissToast(id);
    }, 4600);

    toastTimersRef.current.set(id, { exitTimer, removeTimer });
  }, [MAX_TOASTS, clearToastTimers, dismissToast, statusMessage]);

  const markStudioClean = useCallback(
    (fingerprint?: string) => {
      setLastSavedFingerprint(fingerprint ?? currentFingerprint);
    },
    [currentFingerprint],
  );

  const saveProjectToCloud = useCallback(async () => {
    const result = await cloudProjects.save(createCurrentSnapshot());
    if (!result.ok) {
      setStatusMessage(`Échec sauvegarde cloud: ${result.error.message}`);
      return;
    }
    markStudioClean(currentFingerprint);
    setStatusMessage("Projet et médias sauvegardés dans Cadarium Cloud.");
  }, [cloudProjects, createCurrentSnapshot, currentFingerprint, markStudioClean]);

  const loadProjectFromCloud = useCallback(async (projectId: string) => {
    const result = await cloudProjects.load(projectId);
    if (!result.ok) {
      setStatusMessage(`Échec chargement cloud: ${result.error.message}`);
      return;
    }
    setPendingCloudProject(result.value);
    setRestoreCandidateSource("cloud");
    setRestoreCandidate(result.value.snapshot);
  }, [cloudProjects]);

  const archiveCloudProject = useCallback(async (projectId: string) => {
    if (!window.confirm("Archiver cette sauvegarde cloud ?")) return;
    const result = await cloudProjects.archive(projectId);
    setStatusMessage(result.ok ? "Projet cloud archivé." : `Échec archivage cloud: ${result.error.message}`);
  }, [cloudProjects]);

  const refreshCloudProjects = useCallback(async () => {
    const result = await cloudProjects.refresh();
    if (!result.ok) setStatusMessage(`Échec actualisation cloud: ${result.error.message}`);
  }, [cloudProjects]);

  const exportProjectZip = useCallback(async () => {
    const exported = await exportZip();
    if (exported) {
      markStudioClean();
    }
  }, [exportZip, markStudioClean]);

  // ── Autosave locale ─────────────────────────────────────────────
  // Au demarrage: recupere l'eventuel travail non exporte, le met a l'abri
  // dans le secours de session, puis propose la restauration.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const snapshot = await loadLatestSnapshot();
      if (cancelled || !snapshot) return;
      await promoteToSessionBackup(snapshot);
      if (cancelled) return;
      setRestoreCandidateSource("local");
      setRestoreCandidate(snapshot);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Ecrit le travail en continu (debounce) des la premiere modification.
  // Un "Nouveau projet" volontaire remet hasUnsavedChanges a false et ne
  // reecrit donc pas le snapshot avec un projet vierge.
  useEffect(() => {
    if (restoreCandidate) return;
    if (!authUser) return;
    if (!hasUnsavedChanges) return;
    if (currentFingerprint === lastAutosavedFingerprintRef.current) return;

    const timer = window.setTimeout(() => {
      lastAutosavedFingerprintRef.current = currentFingerprint;
      void saveLatestSnapshot({
        savedAt: new Date().toISOString(),
        fingerprint: currentFingerprint,
        project,
        blocks,
        assetRefs,
        openedValidatedChapterIds,
      });
    }, 2500);
    return () => window.clearTimeout(timer);
  }, [
    assetRefs,
    authUser,
    blocks,
    currentFingerprint,
    hasUnsavedChanges,
    openedValidatedChapterIds,
    project,
    restoreCandidate,
  ]);

  // Garde de fermeture: previent la perte de travail non exporte.
  useEffect(() => {
    if (!hasUnsavedChanges) return;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedChanges]);

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
        for (const layer of selectedBlock.characterLayers ?? []) {
          if (layer.assetId) void ensureAssetPreviewSrc(layer.assetId);
        }
      }

      if (selectedBlock.type === "choice") {
        if (selectedBlock.backgroundAssetId) void ensureAssetPreviewSrc(selectedBlock.backgroundAssetId);
        if (selectedBlock.voiceAssetId) void ensureAssetPreviewSrc(selectedBlock.voiceAssetId);
        for (const layer of selectedBlock.characterLayers ?? []) {
          if (layer.assetId) void ensureAssetPreviewSrc(layer.assetId);
        }
        for (const option of selectedBlock.choices) {
          if (option.imageAssetId) void ensureAssetPreviewSrc(option.imageAssetId);
        }
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
        for (const layer of block.characterLayers ?? []) {
          if (layer.assetId) wantedAssetIds.add(layer.assetId);
        }
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
        for (const layer of block.characterLayers ?? []) {
          if (layer.assetId) wantedAssetIds.add(layer.assetId);
        }
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
      for (const item of previewInventoryCatalog) {
        if (item.iconAssetId) {
          void ensureAssetPreviewSrc(item.iconAssetId);
        }
      }
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [ensureAssetPreviewSrc, previewInventoryCatalog]);

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
    const selectionChanges = changes.filter(
      (change): change is Extract<NodeChange<EditorNode>, { type: "select" }> => change.type === "select",
    );

    setNodes((current) => {
      const next = applyNodeChanges(changes, current);
      if (selectionChanges.length === 0) {
        return next;
      }

      const nextSelectedIds = getSelectedBlockIdsFromNodes(next);
      const preferredFocusedId = [...selectionChanges]
        .reverse()
        .find((change) => change.selected && next.some((node) => node.id === change.id && node.type !== "chapterFolder"))
        ?.id ?? null;
      setSelectedBlockId((currentFocusedId) =>
        resolveFocusedBlockId(currentFocusedId, nextSelectedIds, preferredFocusedId),
      );
      return next;
    });
  }, []);

  const onEdgesChange = useCallback((changes: EdgeChange<EditorEdge>[]) => {
    setEdges((current) => {
      const edgeById = new Map(current.map((edge) => [edge.id, edge] as const));
      const safeChanges = changes.filter((change) => {
        if (change.type !== "remove") return true;
        const edge = edgeById.get(change.id);
        return edge
          ? !isDialogueAutoNextHandle(edge.sourceHandle) && !isCinematicAutoNextHandle(edge.sourceHandle)
          : true;
      });
      return applyEdgeChanges(safeChanges, current);
    });
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
      const targetNarrationId = narrationIdFromHandle(targetHandle);

      setNodes((current) =>
        current.map((node) => {
          if (node.id !== sourceId) return node;

          if (node.data.block.type === "dialogue") {
            const continueLineId = lineContinueIdFromHandle(sourceHandle);
            if (continueLineId) {
              return {
                ...node,
                data: {
                  ...node.data,
                  block: {
                    ...node.data.block,
                    lines: node.data.block.lines.map((line) =>
                      line.id === continueLineId
                        ? { ...line, continueTargetBlockId: targetId }
                        : line,
                    ),
                  },
                },
              };
            }

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

          if (node.data.block.type === "cinematic") {
            const continueNarrationId = narrationContinueIdFromHandle(sourceHandle);
            if (!continueNarrationId) return node;

            return {
              ...node,
              data: {
                ...node.data,
                block: {
                  ...node.data.block,
                  narrations: node.data.block.narrations.map((narration) =>
                    narration.id === continueNarrationId
                      ? {
                          ...narration,
                          continueTargetBlockId: targetId,
                          continueTargetNarrationId: targetNarrationId,
                        }
                      : narration,
                  ),
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

          if (node.data.block.type === "switch") {
            if (sourceHandle === SWITCH_DEFAULT_HANDLE) {
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
            }

            const caseId = switchCaseIdFromHandle(sourceHandle);
            if (!caseId) return node;

            return {
              ...node,
              data: {
                ...node.data,
                block: {
                  ...node.data.block,
                  cases: node.data.block.cases.map((item) =>
                    item.id === caseId
                      ? { ...item, targetBlockId: targetId }
                      : item,
                  ),
                },
              },
            };
          }

          if (node.data.block.type === "gameplay") {
            const lockId = gameplayLockIdFromHandle(sourceHandle);
            if (sourceHandle === GAMEPLAY_BUTTON_SEQUENCE_SUCCESS_HANDLE) {
              return {
                ...node,
                data: {
                  ...node.data,
                  block: {
                    ...node.data.block,
                    buttonSequenceSuccessBlockId: targetId,
                  } as StoryBlock,
                },
              };
            }
            if (sourceHandle === GAMEPLAY_BUTTON_SEQUENCE_FAILURE_HANDLE) {
              return {
                ...node,
                data: {
                  ...node.data,
                  block: {
                    ...node.data.block,
                    buttonSequenceFailureBlockId: targetId,
                  } as StoryBlock,
                },
              };
            }
            if (!lockId) {
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
            }

            return {
              ...node,
              data: {
                ...node.data,
                block: {
                  ...node.data.block,
                  objects: node.data.block.objects.map((obj) =>
                    obj.id === lockId ? { ...obj, targetBlockId: targetId } : obj,
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
        (block as import("@/lib/story").ChapterStartBlock).linkedFromChapterId = null;
        (block as import("@/lib/story").ChapterStartBlock).linkedFromChapterEndBlockId = null;
        setProject((current) => ({
          ...current,
          chapters: [
            ...current.chapters,
            { id: chapterId, name: "Nouveau chapitre", collapsed: false, validated: false } satisfies Chapter,
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
      replaceSelectedBlocks([block.id], block.id);

      logAction("add_block", `${BLOCK_LABELS[type]} (${block.id})`);
      setStatusMessage(`${BLOCK_LABELS[type]} ajoute.`);
    },
    [canEdit, logAction, nodes.length, project.info.startBlockId, replaceSelectedBlocks],
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
          if (block.type === "chapter_start") {
            const shouldClearPreviousChapter =
              Boolean(deletedChapterId) && block.linkedFromChapterId === deletedChapterId;
            const shouldClearPreviousEnd =
              block.linkedFromChapterEndBlockId === blockId;
            if (shouldClearPreviousChapter || shouldClearPreviousEnd) {
              block = {
                ...block,
                linkedFromChapterId: shouldClearPreviousChapter ? null : block.linkedFromChapterId,
                linkedFromChapterEndBlockId: null,
              };
            }
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

    if (deletedChapterId) {
      setOpenedValidatedChapterIds((current) => current.filter((chapterId) => chapterId !== deletedChapterId));
    }

    removeSelectedBlocks([blockId]);
    logAction("delete_block", `${deleted.name} (${deleted.id})`);
    setStatusMessage(`Bloc ${deleted.name} supprime.`);
  }, [blockById, canEdit, logAction, removeSelectedBlocks]);
  deleteBlockRef.current = deleteBlock;

  const deleteSelectedBlock = useCallback(() => {
    if (selectedBlockId) deleteBlock(selectedBlockId);
  }, [deleteBlock, selectedBlockId]);

  const copySelectedBlocks = useCallback(() => {
    const blocksToCopy =
      selectedBlocks.length > 0
        ? selectedBlocks
        : selectedBlock
          ? [selectedBlock]
          : [];

    if (blocksToCopy.length === 0) {
      setStatusMessage("Aucun bloc selectionne a copier.");
      return;
    }

    const { eligibleBlocks, ignoredCount } = prepareClipboardBlocks(blocksToCopy);
    if (eligibleBlocks.length === 0) {
      setStatusMessage("Les blocs de chapitre ne sont pas duplicables.");
      return;
    }

    clipboardRef.current = {
      blocks: eligibleBlocks.map((block) => structuredClone(block)),
    };
    clipboardPasteCountRef.current = 0;
    let statusMessage =
      eligibleBlocks.length === 1
        ? `Bloc copie: ${eligibleBlocks[0].name || BLOCK_LABELS[eligibleBlocks[0].type]}.`
        : `${eligibleBlocks.length} blocs copies.`;
    if (ignoredCount > 0) {
      statusMessage += ` ${ignoredCount} bloc${ignoredCount > 1 ? "s" : ""} de chapitre ignore${ignoredCount > 1 ? "s" : ""}.`;
    }
    setStatusMessage(statusMessage);
  }, [selectedBlock, selectedBlocks]);

  const pasteCopiedBlocks = useCallback(() => {
    if (!canEdit) return;

    const clipboard = clipboardRef.current;
    if (!clipboard || clipboard.blocks.length === 0) {
      setStatusMessage("Aucun bloc en memoire a coller.");
      return;
    }

    clipboardPasteCountRef.current += 1;
    const offsetMultiplier = clipboardPasteCountRef.current;
    const duplicatedBlocks = duplicateClipboardBlocks(clipboard.blocks, {
      x: DUPLICATE_POSITION_STEP.x * offsetMultiplier,
      y: DUPLICATE_POSITION_STEP.y * offsetMultiplier,
    });
    if (duplicatedBlocks.length === 0) {
      setStatusMessage("Les blocs en memoire ne sont pas duplicables.");
      return;
    }
    const duplicatedNodes = duplicatedBlocks.map((block) => blockToNode(block));
    const duplicatedEdges = rebuildEdgesFromNodes(duplicatedNodes).filter(
      (edge) =>
        !isDialogueAutoNextHandle(edge.sourceHandle) &&
        !isCinematicAutoNextHandle(edge.sourceHandle),
    );

    setNodes((current) => [...current, ...duplicatedNodes]);
    setEdges((current) => [...current, ...duplicatedEdges]);
    replaceSelectedBlocks(
      duplicatedBlocks.map((block) => block.id),
      duplicatedBlocks[duplicatedBlocks.length - 1]?.id ?? null,
    );
    logAction(
      duplicatedBlocks.length === 1 ? "duplicate_block" : "duplicate_blocks",
      duplicatedBlocks.map((block) => `${BLOCK_LABELS[block.type]} (${block.id})`).join(", "),
    );
    setStatusMessage(
      duplicatedBlocks.length === 1
        ? `Bloc duplique: ${duplicatedBlocks[0].name}`
        : `${duplicatedBlocks.length} blocs dupliques.`,
    );
  }, [canEdit, logAction, replaceSelectedBlocks]);

  const duplicateSelectedBlock = useCallback(() => {
    const blocksToDuplicate =
      selectedBlocks.length > 0
        ? selectedBlocks
        : selectedBlock
          ? [selectedBlock]
          : [];

    if (!canEdit || blocksToDuplicate.length === 0) return;

    const { eligibleBlocks } = prepareClipboardBlocks(blocksToDuplicate);
    if (eligibleBlocks.length === 0) {
      setStatusMessage("Les blocs de chapitre ne sont pas duplicables.");
      return;
    }

    clipboardRef.current = {
      blocks: eligibleBlocks.map((block) => structuredClone(block)),
    };
    clipboardPasteCountRef.current = 0;
    pasteCopiedBlocks();
  }, [canEdit, pasteCopiedBlocks, selectedBlock, selectedBlocks]);

  useEffect(() => {
    if (!authUser) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.altKey) return;

      const target = event.target as HTMLElement | null;
      const tagName = target?.tagName?.toLowerCase();
      const isTypingTarget =
        Boolean(target?.isContentEditable) ||
        tagName === "input" ||
        tagName === "textarea" ||
        tagName === "select";
      if (isTypingTarget) return;

      const normalizedKey = event.key.toLowerCase();
      if (normalizedKey === "c") {
        event.preventDefault();
        copySelectedBlocks();
      } else if (normalizedKey === "v") {
        event.preventDefault();
        pasteCopiedBlocks();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [authUser, copySelectedBlocks, pasteCopiedBlocks]);

  const deleteEdge = useCallback(
    (sourceId: string, sourceHandle: string) => {
      if (!canEdit) return;
      if (isDialogueAutoNextHandle(sourceHandle) || isCinematicAutoNextHandle(sourceHandle)) return;
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
      const onDeleteForEdge = (edge: EditorEdge) =>
        canEdit &&
        !isDialogueAutoNextHandle(edge.sourceHandle) &&
        !isCinematicAutoNextHandle(edge.sourceHandle)
          ? deleteEdge
          : undefined;

      if (hiddenBlockIds.size === 0) {
        return edgesWithAutoDialogueLinks.map((edge) => ({
          ...edge,
          data: { ...edge.data, onDeleteEdge: onDeleteForEdge(edge) },
        }));
      }

      const result: Array<EditorEdge & { data?: { onDeleteEdge?: typeof deleteEdge } }> = [];
      const seenFolderEdges = new Set<string>();

      for (const edge of edgesWithAutoDialogueLinks) {
        const srcHidden = hiddenBlockIds.has(edge.source);
        const tgtHidden = hiddenBlockIds.has(edge.target);

        // Both hidden: skip entirely
        if (srcHidden && tgtHidden) continue;

        // Source hidden, target visible → redirect source to folder node
        if (srcHidden) {
          const srcChapterId = blockChapterMap.get(edge.source);
          if (!srcChapterId) continue;
          if (!collapsedChapterIds.has(srcChapterId)) continue;
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
          if (!collapsedChapterIds.has(tgtChapterId)) continue;
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
          data: { ...edge.data, onDeleteEdge: onDeleteForEdge(edge) },
        });
      }

      return result;
    },
    [blockChapterMap, canEdit, collapsedChapterIds, deleteEdge, edgesWithAutoDialogueLinks, hiddenBlockIds],
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

      if (
        sourceNode.type === "chapter_end" &&
        targetNode.type === "chapter_start"
      ) {
        const sourceChapterId = resolveChapterIdForBlock(sourceNode.id);
        setChapterStartPreviousLink(
          targetNode.id,
          sourceChapterId,
          sourceNode.id,
        );
        logAction("link", `${sourceNode.name} -> ${targetNode.name}`);
        return;
      }

      if (sourceNode.type === "dialogue") {
        const respId = responseIdFromHandle(connection.sourceHandle);
        if (respId) {
          const handle = `resp-${respId}`;
          setConnection(connection.source, handle, connection.target, connection.targetHandle);
          logAction("link", `${sourceNode.name} resp ${respId} -> ${connection.target}`);
          return;
        }
        const continueLineId = lineContinueIdFromHandle(connection.sourceHandle);
        if (!continueLineId) return;
        const handle = `line-continue-${continueLineId}`;
        setConnection(connection.source, handle, connection.target, null);
        logAction("link", `${sourceNode.name} continuer ${continueLineId} -> ${connection.target}`);
        return;
      }

      if (sourceNode.type === "cinematic") {
        const continueNarrationId =
          narrationContinueIdFromHandle(connection.sourceHandle)
          ?? narrationAutoNextIdFromHandle(connection.sourceHandle);
        if (!continueNarrationId) return;
        const handle = `narration-continue-${continueNarrationId}`;
        setConnection(connection.source, handle, connection.target, connection.targetHandle);
        logAction("link", `${sourceNode.name} narration ${continueNarrationId} -> ${connection.target}`);
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

      if (sourceNode.type === "switch") {
        if (connection.sourceHandle === SWITCH_DEFAULT_HANDLE) {
          setConnection(
            connection.source,
            SWITCH_DEFAULT_HANDLE,
            connection.target,
            connection.targetHandle,
          );
          logAction("link", `${sourceNode.name} sinon -> ${connection.target}`);
          return;
        }
        const caseId = switchCaseIdFromHandle(connection.sourceHandle);
        if (!caseId) return;
        const handle = `switch-case-${caseId}`;
        setConnection(connection.source, handle, connection.target, connection.targetHandle);
        logAction("link", `${sourceNode.name} cas ${caseId} -> ${connection.target}`);
        return;
      }

      if (sourceNode.type === "gameplay") {
        if (connection.sourceHandle === GAMEPLAY_BUTTON_SEQUENCE_SUCCESS_HANDLE) {
          setConnection(
            connection.source,
            GAMEPLAY_BUTTON_SEQUENCE_SUCCESS_HANDLE,
            connection.target,
            connection.targetHandle,
          );
          logAction("link", `${sourceNode.name} code OK -> ${connection.target}`);
          return;
        }
        if (connection.sourceHandle === GAMEPLAY_BUTTON_SEQUENCE_FAILURE_HANDLE) {
          setConnection(
            connection.source,
            GAMEPLAY_BUTTON_SEQUENCE_FAILURE_HANDLE,
            connection.target,
            connection.targetHandle,
          );
          logAction("link", `${sourceNode.name} code KO -> ${connection.target}`);
          return;
        }
        const lockId = gameplayLockIdFromHandle(connection.sourceHandle);
        if (lockId) {
          const handle = `lock-${lockId}`;
          setConnection(connection.source, handle, connection.target, connection.targetHandle);
          logAction("link", `${sourceNode.name} serrure ${lockId} -> ${connection.target}`);
          return;
        }
        setStatusMessage("Relie une serrure (S1, S2...) pour creer une sortie gameplay.");
        return;
      }

      setConnection(connection.source, "next", connection.target, connection.targetHandle);
      logAction("link", `${sourceNode.name} -> ${connection.target}`);
    },
    [
      blockById,
      canEdit,
      linkNpcProfileToDialogue,
      logAction,
      resolveChapterIdForBlock,
      setChapterStartPreviousLink,
      setConnection,
      setStatusMessage,
    ],
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
    updateGameplayObjectField,
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
  });

  const removeGameplayObjectAndEdges = useCallback(
    (objectId: string) => {
      if (!selectedBlock || selectedBlock.type !== "gameplay") return;
      const removedObject = selectedBlock.objects.find((obj) => obj.id === objectId) ?? null;
      const removingLastButton =
        removedObject?.objectType === "button" &&
        selectedBlock.objects.filter((obj) => obj.objectType === "button").length <= 1;
      removeGameplayObject(objectId);
      setEdges((current) =>
        current.filter(
          (edge) =>
            !(
              edge.source === selectedBlock.id &&
              (
                (edge.sourceHandle ?? "") === `lock-${objectId}` ||
                (removingLastButton &&
                  ((edge.sourceHandle ?? "") === GAMEPLAY_BUTTON_SEQUENCE_SUCCESS_HANDLE ||
                    (edge.sourceHandle ?? "") === GAMEPLAY_BUTTON_SEQUENCE_FAILURE_HANDLE))
              )
            ),
        ),
      );
    },
    [removeGameplayObject, selectedBlock, setEdges],
  );

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
    const freshEdges = fresh.edges.filter(
      (edge) => !isDialogueAutoNextHandle(edge.sourceHandle) && !isCinematicAutoNextHandle(edge.sourceHandle),
    );
    const normalizedFreshProject: ProjectMeta = {
      ...fresh.project,
      chapters: normalizeProjectChapters(fresh.project.chapters),
    };
    setProject(normalizedFreshProject);
    setNodes(fresh.nodes);
    setEdges(freshEdges);
    clearAllAssetState();
    resetGameplayState();
    setOpenedValidatedChapterIds([]);
    clipboardRef.current = null;
    clipboardPasteCountRef.current = 0;
    replaceSelectedBlocks(
      normalizedFreshProject.info.startBlockId ? [normalizedFreshProject.info.startBlockId] : [],
      normalizedFreshProject.info.startBlockId ?? null,
    );
    setLastValidation([]);
    resetPreview();
    cloudProjects.detach();
    markStudioClean(buildStudioChangeFingerprint(normalizedFreshProject, fresh.nodes, freshEdges, {}));
    if (!options?.preserveStatusMessage) {
      setStatusMessage("Nouveau projet initialise.");
    }
  };

  const applyRestoreCandidate = () => {
    if (!restoreCandidate) return;

    // Meme chemin que l'import ZIP: on repart des blocs (qui portent leur
    // position) et on reconstruit nodes, dossiers de chapitres et edges.
    const restoredNodes = restoreCandidate.blocks.map((block) => blockToNode(block));
    const rawProject = restoreCandidate.project as ProjectMeta & {
      items?: unknown;
      chapters?: unknown;
      hero?: unknown;
    };
    const normalizedProject: ProjectMeta = {
      ...restoreCandidate.project,
      items: normalizeProjectItems(rawProject.items),
      chapters: normalizeProjectChapters(rawProject.chapters),
    };
    normalizedProject.hero = normalizeProjectHero(
      rawProject.hero,
      normalizedProject.variables,
      normalizedProject.items,
    );

    const hydratedNodes = withCollapsedChapterFolders(restoredNodes, normalizedProject.chapters);
    const hydratedEdges = rebuildEdgesFromNodes(restoredNodes).filter(
      (edge) => !isDialogueAutoNextHandle(edge.sourceHandle) && !isCinematicAutoNextHandle(edge.sourceHandle),
    );

    setProject(normalizedProject);
    setNodes(hydratedNodes);
    setEdges(hydratedEdges);
    setAssetRefs(restoreCandidate.assetRefs ?? {});
    resetGameplayState();
    const validatedChapterIds = new Set(
      normalizedProject.chapters.filter((chapter) => chapter.validated).map((chapter) => chapter.id),
    );
    setOpenedValidatedChapterIds(
      (restoreCandidate.openedValidatedChapterIds ?? []).filter((chapterId) =>
        validatedChapterIds.has(chapterId),
      ),
    );
    clipboardRef.current = null;
    clipboardPasteCountRef.current = 0;
    replaceSelectedBlocks(
      normalizedProject.info.startBlockId ? [normalizedProject.info.startBlockId] : [],
      normalizedProject.info.startBlockId ?? null,
    );
    setLastValidation([]);
    resetPreview();
    if (restoreCandidateSource === "cloud" && pendingCloudProject) {
      cloudProjects.activate(pendingCloudProject.id, pendingCloudProject.revision);
      markStudioClean(restoreCandidate.fingerprint);
    }
    lastAutosavedFingerprintRef.current = null;
    setRestoreCandidate(null);
    setPendingCloudProject(null);
    setStatusMessage(
      restoreCandidateSource === "cloud"
        ? "Projet restauré depuis Cadarium."
        : "Travail restaure depuis la sauvegarde automatique locale.",
    );
  };

  const declineRestoreCandidate = () => {
    setRestoreCandidate(null);
    setPendingCloudProject(null);
    setStatusMessage(restoreCandidateSource === "cloud"
      ? "Chargement cloud annulé. Le projet courant est conservé."
      : "Sauvegarde automatique ignoree. Elle sera remplacee a ta prochaine modification.");
  };

  const openAccountModal = () => {
    setAdminModalOpen(false);
    setAccountModalMessage("");
    setOwnPasswordInput("");
    setOwnPasswordConfirmInput("");
    setAccountDeleteConfirmationInput("");
    setAccountModalOpen(true);
  };

  const closeAccountModal = () => {
    if (actionBusy) return;
    setAccountModalOpen(false);
  };

  const changeOwnPasswordFromModal = async () => {
    if (!backendReady || !authUser) {
      setAccountModalMessage("Connecte-toi pour changer ton mot de passe.");
      return;
    }
    if (ownPasswordInput.length < 8) {
      setAccountModalMessage("Le nouveau mot de passe doit contenir au moins 8 caracteres.");
      return;
    }
    if (ownPasswordInput !== ownPasswordConfirmInput) {
      setAccountModalMessage("La confirmation du mot de passe ne correspond pas.");
      return;
    }

    setAccountBusy(true);
    try {
      const result = await changePassword(ownPasswordInput);
      if (!result.ok) {
        setAccountModalMessage(`Erreur changement mot de passe: ${result.error.message}`);
        return;
      }
      setOwnPasswordInput("");
      setOwnPasswordConfirmInput("");
      setAccountModalMessage("Mot de passe mis a jour.");
      setStatusMessage("Mot de passe mis a jour.");
    } finally {
      setAccountBusy(false);
    }
  };

  const logoutFromAccountModal = async () => {
    if (!authUser) {
      setAccountModalOpen(false);
      return;
    }

    setAccountBusy(true);
    try {
      await signOut();
      setAccountModalOpen(false);
      router.push("/");
    } finally {
      setAccountBusy(false);
    }
  };

  const deleteOwnAccountFromModal = async () => {
    if (!backend || !authUser) {
      setAccountModalMessage("Connecte-toi pour supprimer ton compte.");
      return;
    }
    if (accountDeleteConfirmationInput.trim().toUpperCase() !== "SUPPRIMER") {
      setAccountModalMessage('Saisis exactement "SUPPRIMER" pour confirmer.');
      return;
    }

    setAccountBusy(true);
    try {
      const result = await backend.account.deleteMyAccount();
      if (!result.ok) {
        setAccountModalMessage(`Erreur suppression compte: ${result.error.message}`);
        return;
      }

      await signOut();
      setAccountModalOpen(false);
      router.push("/");
    } finally {
      setAccountBusy(false);
    }
  };

  const openAdminModal = () => {
    if (!isPlatformAdmin) return;
    setAccountModalOpen(false);
    setAdminModalMessage("");
    setAdminModalOpen(true);
    void refreshPlatformProfiles();
  };

  const closeAdminModal = () => {
    if (actionBusy) return;
    setAdminModalOpen(false);
  };

  const createUserFromAdminModal = async () => {
    if (!authUser || !isPlatformAdmin) {
      setAdminModalMessage("Action reservee aux admins connectes.");
      return;
    }

    const email = adminCreateUserEmailInput.trim().toLowerCase();
    if (!email) {
      setAdminModalMessage("Saisis un email utilisateur.");
      return;
    }
    if (adminCreateUserPasswordInput.length < 8) {
      setAdminModalMessage("Le mot de passe provisoire doit contenir au moins 8 caracteres.");
      return;
    }

    const result = await adminCreateUser({
      email,
      password: adminCreateUserPasswordInput,
      role: adminCreateUserRole,
    });
    if (!result.ok) {
      setAdminModalMessage(`Erreur creation compte: ${result.error.message}`);
      return;
    }

    setAdminCreateUserEmailInput("");
    setAdminCreateUserPasswordInput("");
    setAdminCreateUserRole("reader");
    const feedback = `Compte cree: ${email} (${adminCreateUserRole}).`;
    setAdminModalMessage(feedback);
    setStatusMessage(feedback);
  };

  const deleteUserFromAdminModal = async (targetUserId: string) => {
    if (!authUser || !isPlatformAdmin) {
      setAdminModalMessage("Action reservee aux admins connectes.");
      return;
    }

    const result = await adminDeleteUser(targetUserId);
    if (!result.ok) {
      setAdminModalMessage(`Erreur suppression utilisateur: ${result.error.message}`);
      return;
    }

    setAdminModalMessage("Utilisateur supprime.");
    setStatusMessage("Utilisateur supprime.");
  };

  const setRoleFromAdminModal = async (targetUserId: string, role: PlatformRole) => {
    const result = await setProfileRole(targetUserId, role);
    if (result.ok) {
      setAdminModalMessage(`Role mis a jour: ${role}.`);
    } else {
      setAdminModalMessage(`Echec mise a jour role: ${result.error.message}`);
    }
  };

  const requestNewProject = () => {
    setNewProjectWarningOpen(true);
  };

  const confirmNewProjectWithoutSave = () => {
    setNewProjectWarningOpen(false);
    resetStudioToBlank();
  };

  const handleImportZip = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    event.target.value = "";

    if (isImportingZip) {
      setStatusMessage("Import ZIP deja en cours.");
      return;
    }

    setIsImportingZip(true);
    try {
      const result = await importFromZip(file);
      if (!result) return;

      const currentStoryNodes = nodes.filter((node) => node.type !== "chapterFolder");
      const importedStoryNodes = result.nodes.filter((node) => node.type !== "chapterFolder");
      if (importedStoryNodes.length === 0) {
        setStatusMessage("Import annule: aucun bloc importable trouve dans le ZIP.");
        return;
      }

      const importedBlocksRaw = importedStoryNodes.map((node) => blockFromNode(node));
      const { mergedVariables, variableIdMap } = mergeVariablesForZipImport(
        project.variables,
        result.project.variables,
      );
      const { mergedItems, itemIdMap } = mergeItemsForZipImport(
        project.items,
        result.project.items,
      );
      const importedChapters = normalizeProjectChapters(result.project.chapters);
      const { mergedChapters, chapterIdMap } = mergeChaptersForZipImport(
        project.chapters,
        importedChapters,
        importedBlocksRaw,
      );

      const blockIdMap = new Map<string, string>();
      const usedBlockIds = new Set(currentStoryNodes.map((node) => node.id));
      for (const importedBlock of importedBlocksRaw) {
        const mappedBlockId = allocateUniqueId(importedBlock.id, importedBlock.type, usedBlockIds);
        blockIdMap.set(importedBlock.id, mappedBlockId);
      }

      const remapMaps: ZipImportMergeMaps = {
        blockIdMap,
        chapterIdMap,
        variableIdMap,
        itemIdMap,
      };
      const remappedImportedBlocks = importedBlocksRaw.map((block) =>
        remapBlockForZipImport(block, remapMaps),
      );
      const remappedImportedNodes = remappedImportedBlocks.map((block) => blockToNode(block));
      const shiftedImportedNodes = placeImportedNodes(currentStoryNodes, remappedImportedNodes);

      const mergedStoryNodes = [...currentStoryNodes, ...shiftedImportedNodes];
      const mergedEdges = rebuildEdgesFromNodes(mergedStoryNodes).filter(
        (edge) => !isDialogueAutoNextHandle(edge.sourceHandle) && !isCinematicAutoNextHandle(edge.sourceHandle),
      );
      const mergedVariableIds = new Set(mergedVariables.map((variable) => variable.id));
      const mergedItemIds = new Set(mergedItems.map((item) => item.id));
      const mergedHero = mergeHeroForZipImport(
        project.hero,
        result.project.hero,
        variableIdMap,
        itemIdMap,
        mergedVariableIds,
        mergedItemIds,
      );
      const importedStartBlockId = result.project.info.startBlockId
        ? blockIdMap.get(result.project.info.startBlockId) ?? result.project.info.startBlockId
        : null;

      const mergedProject: ProjectMeta = {
        ...project,
        variables: mergedVariables,
        items: mergedItems,
        hero: mergedHero,
        chapters: mergedChapters,
        info: {
          ...project.info,
          startBlockId: project.info.startBlockId ?? importedStartBlockId,
          updatedAt: new Date().toISOString(),
        },
      };

      const mergedNodes = withCollapsedChapterFolders(
        [...nodes.filter((node) => node.type === "chapterFolder"), ...mergedStoryNodes],
        mergedProject.chapters,
      );

      setProject(mergedProject);
      setNodes(mergedNodes);
      setEdges(mergedEdges);
      const mergedValidatedChapterIdSet = new Set(
        mergedProject.chapters
          .filter((chapter) => chapter.validated)
          .map((chapter) => chapter.id),
      );
      const mappedImportedOpenedValidatedChapterIds = result.studioOpenedValidatedChapterIds
        .map((chapterId) => chapterIdMap.get(chapterId) ?? chapterId)
        .filter((chapterId) => mergedValidatedChapterIdSet.has(chapterId));
      setOpenedValidatedChapterIds((current) => {
        const next = new Set(
          current.filter((chapterId) => mergedValidatedChapterIdSet.has(chapterId)),
        );
        for (const chapterId of mappedImportedOpenedValidatedChapterIds) {
          next.add(chapterId);
        }
        return [...next];
      });
      setAssetRefs((current) => ({
        ...current,
        ...result.assetRefs,
      }));
      resetGameplayState();
      setLastValidation([]);
      resetPreview();

      const importedBlockCount = shiftedImportedNodes.length;
      const importedAssetCount = Object.keys(result.assetRefs).length;
      logAction(
        "zip_import_merge",
        `${file.name}: +${importedBlockCount} bloc(s), +${importedAssetCount} asset(s)`,
      );
      setStatusMessage(
        `Import fusionne: ${importedBlockCount} bloc(s) ajoutes et places sans chevauchement.`,
      );
    } finally {
      setIsImportingZip(false);
    }
  };

  return (
    <div className="studio-root">
      <StudioHeader
        hasUnsavedChanges={hasUnsavedChanges}
        validationControl={
          <ValidationStatusButton
            validationLevel={validationLevel}
            totalErrors={totalErrors}
            totalWarnings={totalWarnings}
            validationSummary={validationSummary}
            onOpen={() => setValidationModalOpen(true)}
          />
        }
        authInitial={authInitial}
        authEmail={authUser?.email ?? null}
        showAccount={Boolean(authUser)}
        showAdmin={isPlatformAdmin}
        canCreateProject={Boolean(authUser && canUseAuthorTools && !isImportingZip)}
        canPreview={Boolean(authUser && !isImportingZip)}
        canExport={Boolean(authUser)}
        canImport={Boolean(authUser && canUseAuthorTools && !isImportingZip)}
        isImporting={isImportingZip}
        onOpenAccount={openAccountModal}
        onOpenAdmin={openAdminModal}
        onNewProject={requestNewProject}
        onPreview={startPreview}
        onExport={() => void exportProjectZip()}
        onImport={() => importZipInputRef.current?.click()}
      />
      <input
        ref={importZipInputRef}
        type="file"
        accept=".zip"
        className="visually-hidden-file-input"
        onChange={(event) => void handleImportZip(event)}
      />

      {/* ── Inline warnings (edit block / provisional password) ── */}
      {editBlockReason && <div className="warning-banner">{editBlockReason}</div>}
      {authUser?.mustChangePassword && (
        <div className="warning-banner">
          Ton mot de passe provisoire doit etre change.{" "}
          <button className="button-secondary button-small" onClick={openAccountModal}>
            Changer maintenant
          </button>
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
                onClick={() => dismissToast(toast.id)}
                title="Fermer"
              >×</button>
            </div>
          ))}
        </div>
      )}

      <div className={`studio-grid${rightPanelHidden ? " studio-grid-right-hidden" : ""}`}>
        <div className="studio-left-workspace">
          <StudioLeftNavigation
            activeSection={activeLeftSection}
            onSectionChange={setActiveLeftSection}
          />
          <div className="panel-left-stack">
          {activeLeftSection === "cloud" && (
          <AuthorStudioAccountPanel
            backendEnabled={backendReady}
            authLoading={authLoading}
            isAuthenticated={Boolean(authUser)}
            authEmail={authUser?.email ?? null}
            platformRole={platformRole}
            cloudEnabled={Boolean(authUser && canUseAuthorTools && backend?.projects && backend.assets)}
            cloudBusy={cloudProjects.busy}
            cloudProjects={cloudProjects.projects}
            activeCloudProjectId={cloudProjects.activeProject?.id ?? null}
            onSaveCloud={() => { void saveProjectToCloud(); }}
            onRefreshCloud={() => { void refreshCloudProjects(); }}
            onLoadCloud={(projectId) => { void loadProjectFromCloud(projectId); }}
            onArchiveCloud={(projectId) => { void archiveCloudProject(projectId); }}
          />
          )}

          {authUser ? (
            <AuthorStudioProjectPanel
              activeSection={activeLeftSection === "cloud" ? "project" : activeLeftSection}
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
              openedValidatedChapterIds={openedValidatedChapterIds}
              onToggleValidatedChapterVisibility={toggleValidatedChapterVisibility}
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
        </div>

        {authUser ? (
          <>
            <main
              className="panel panel-canvas"
              onPointerDownCapture={handleCanvasPointerDownCapture}
            >
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
                onNodeMouseEnter={handleHoverSelectionEnter}
                nodesDraggable={canEdit}
                nodesConnectable={canEdit}
                elementsSelectable
                panOnDrag={hoverSelectionActive ? false : true}
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

            {!rightPanelHidden && (
              <div className="panel-right-shell">
                <button
                  className="panel-right-edge-toggle panel-right-edge-toggle-close"
                  onClick={() => setRightPanelHidden(true)}
                  title="Masquer panneau droit (Ctrl+B)"
                  aria-label="Masquer panneau droit"
                >
                  {">"}
                </button>
                <AuthorStudioBlockEditorPanel
                  selectedBlock={selectedBlock}
                  canEdit={canEdit}
                  project={project}
                  blocks={blocks}
                  chapterEndOptionsByChapterId={chapterEndOptionsByChapterId}
                  onDeleteSelectedBlock={deleteSelectedBlock}
                  onDuplicateSelectedBlock={duplicateSelectedBlock}
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
                  onRemoveGameplayObject={removeGameplayObjectAndEdges}
                  onUpdateGameplayObjectField={updateGameplayObjectField}
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
                  onSetChapterValidationFromEnd={setChapterValidationFromEnd}
                  onSetChapterStartPreviousLink={setChapterStartPreviousLink}
                />
              </div>
            )}
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
      {authUser && rightPanelHidden && (
        <button
          className="panel-right-edge-toggle panel-right-edge-toggle-open"
          onClick={() => setRightPanelHidden(false)}
          title="Afficher panneau droit (Ctrl+B)"
          aria-label="Afficher panneau droit"
          aria-keyshortcuts="Control+B Meta+B"
        >
          {"<"}
        </button>
      )}

      <ValidationModal
        open={validationModalOpen}
        validationSummary={validationSummary}
        visibleIssues={visibleIssues}
        onClose={() => setValidationModalOpen(false)}
        onRunValidation={runValidation}
      />

      {accountModalOpen && authUser && (
        <div className="account-modal-overlay">
          <section className="account-modal-card" role="dialog" aria-modal="true" aria-label="Mon compte">
            <div className="account-modal-head">
              <h2>Mon compte</h2>
              <button className="button-secondary" onClick={closeAccountModal} disabled={actionBusy}>
                Fermer
              </button>
            </div>
            <p className="account-modal-subtitle">
              Gere ton compte sans quitter la page de travail.
            </p>
            <p>
              Connecte: <strong>{authUser.email ?? authUser.id}</strong>{" "}
              <span className="chip chip-start">{platformRole}</span>
            </p>

            <div className="portal-divider" />

            <h3>Changer le mot de passe</h3>
            <label>
              Nouveau mot de passe
              <input
                type="password"
                placeholder="Minimum 8 caracteres"
                value={ownPasswordInput}
                onChange={(event) => setOwnPasswordInput(event.target.value)}
              />
            </label>
            <label>
              Confirmation mot de passe
              <input
                type="password"
                placeholder="Retape le mot de passe"
                value={ownPasswordConfirmInput}
                onChange={(event) => setOwnPasswordConfirmInput(event.target.value)}
              />
            </label>
            <div className="row-inline">
              <button
                className="button-secondary"
                onClick={() => {
                  void changeOwnPasswordFromModal();
                }}
                disabled={actionBusy}
              >
                Changer mon mot de passe
              </button>
              <button
                className="button-secondary"
                onClick={() => {
                  void logoutFromAccountModal();
                }}
                disabled={actionBusy}
              >
                Se deconnecter
              </button>
            </div>

            <div className="portal-divider" />

            <h3>Supprimer le compte</h3>
            <p className="portal-warning">
              Action irreversible. Saisis <strong>SUPPRIMER</strong> pour confirmer.
            </p>
            <label>
              Confirmation
              <input
                placeholder="SUPPRIMER"
                value={accountDeleteConfirmationInput}
                onChange={(event) => setAccountDeleteConfirmationInput(event.target.value)}
              />
            </label>
            <button
              className="button-danger"
              onClick={() => {
                void deleteOwnAccountFromModal();
              }}
              disabled={actionBusy}
            >
              Supprimer mon compte
            </button>

            {accountModalMessage && <p className="portal-message">{accountModalMessage}</p>}
          </section>
        </div>
      )}

      {adminModalOpen && authUser && isPlatformAdmin && (
        <div className="account-modal-overlay">
          <section className="account-modal-card admin-modal-card" role="dialog" aria-modal="true" aria-label="Administration">
            <div className="account-modal-head">
              <h2>Administration</h2>
              <div className="row-inline">
                <button
                  className="button-secondary"
                  onClick={() => {
                    void refreshPlatformProfiles();
                  }}
                  disabled={actionBusy}
                >
                  Refresh
                </button>
                <button className="button-secondary" onClick={closeAdminModal} disabled={actionBusy}>
                  Fermer
                </button>
              </div>
            </div>
            <p className="account-modal-subtitle">
              Gere les comptes et les roles sans quitter la page de travail.
            </p>

            <div className="portal-divider" />

            <h3>Creer un utilisateur</h3>
            <label>
              Email
              <input
                type="email"
                placeholder="utilisateur@studio.com"
                value={adminCreateUserEmailInput}
                onChange={(event) => setAdminCreateUserEmailInput(event.target.value)}
              />
            </label>
            <label>
              Mot de passe provisoire
              <input
                type="password"
                placeholder="Minimum 8 caracteres"
                value={adminCreateUserPasswordInput}
                onChange={(event) => setAdminCreateUserPasswordInput(event.target.value)}
              />
            </label>
            <label>
              Role
              <select
                value={adminCreateUserRole}
                onChange={(event) => setAdminCreateUserRole(event.target.value as PlatformRole)}
              >
                <option value="reader">reader</option>
                <option value="author">author</option>
                <option value="admin">admin</option>
              </select>
            </label>
            <button
              className="button-primary button-brand-blue"
              onClick={() => {
                void createUserFromAdminModal();
              }}
              disabled={actionBusy}
            >
              Creer utilisateur
            </button>

            <div className="portal-divider" />

            <h3>Utilisateurs</h3>
            {platformProfiles.length === 0 ? (
              <p className="empty-placeholder">Aucun utilisateur charge.</p>
            ) : (
              <ul className="list-compact admin-modal-list">
                {platformProfiles.map((profile) => {
                  const isSelf = profile.userId === authUser.id;
                  const isAdminProfile = profile.platformRole === "admin";
                  return (
                    <li key={profile.userId} className="cloud-project-row">
                      <div>
                        <strong>{profile.displayName}</strong>
                        <small>{profile.email ?? profile.userId}</small>
                      </div>
                      <div className="row-inline">
                        <span className="chip chip-start">{profile.platformRole}</span>
                        <button
                          className="button-secondary button-small"
                          onClick={() => {
                            void setRoleFromAdminModal(profile.userId, "reader");
                          }}
                          disabled={
                            actionBusy ||
                            profile.platformRole === "reader" ||
                            (isAdminProfile && adminCount <= 1)
                          }
                        >
                          reader
                        </button>
                        <button
                          className="button-secondary button-small"
                          onClick={() => {
                            void setRoleFromAdminModal(profile.userId, "author");
                          }}
                          disabled={
                            actionBusy ||
                            profile.platformRole === "author" ||
                            (isAdminProfile && adminCount <= 1)
                          }
                        >
                          author
                        </button>
                        <button
                          className="button-secondary button-small"
                          onClick={() => {
                            void setRoleFromAdminModal(profile.userId, "admin");
                          }}
                          disabled={actionBusy || profile.platformRole === "admin"}
                        >
                          admin
                        </button>
                        <button
                          className="button-danger button-small"
                          onClick={() => {
                            void deleteUserFromAdminModal(profile.userId);
                          }}
                          disabled={actionBusy || isSelf}
                          title={isSelf ? "Utilise la modale Compte pour ton propre compte" : "Supprimer utilisateur"}
                        >
                          Supprimer
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}

            {adminModalMessage && <p className="portal-message">{adminModalMessage}</p>}
          </section>
        </div>
      )}

      <footer className="studio-footer">
        <a className="studio-footer-link" href="/guide-premier-projet" target="_blank" rel="noreferrer">
          Guide 1er projet
        </a>
        <span className="studio-footer-separator">·</span>
        <a className="studio-footer-link" href="/confidentialite" target="_blank" rel="noreferrer">
          Confidentialite
        </a>
        <span className="studio-footer-separator">·</span>
        <a className="studio-footer-link" href="/mentions-legales" target="_blank" rel="noreferrer">
          Mentions legales
        </a>
      </footer>

      {authUser && restoreCandidate && (
        <div className="confirm-overlay">
          <div className="confirm-modal">
            <h2>{restoreCandidateSource === "cloud" ? "Ouvrir la sauvegarde Cadarium Cloud" : "Travail non exporte detecte"}</h2>
            <p>
              {restoreCandidateSource === "cloud" ? "La sauvegarde Cadarium Cloud du " : "Une sauvegarde automatique locale du "}
              <strong>{new Date(restoreCandidate.savedAt).toLocaleString("fr-FR")}</strong> existe
              {" "}({restoreCandidate.blocks.length} bloc(s), projet{" "}
              <strong>{restoreCandidate.project.info.title || "sans titre"}</strong>).
            </p>
            <p className="confirm-warning">
              Restaurer remplace le contenu actuel de l&apos;editeur. {restoreCandidateSource === "cloud"
                ? "Annuler conserve le projet actuellement ouvert."
                : "Ignorer conserve la sauvegarde jusqu'a ta prochaine modification."}
            </p>
            <div className="confirm-actions">
              <button className="button-secondary" onClick={declineRestoreCandidate}>
                {restoreCandidateSource === "cloud" ? "Annuler" : "Repartir a neuf"}
              </button>
              <button className="button-primary" onClick={applyRestoreCandidate}>
                Restaurer
              </button>
            </div>
          </div>
        </div>
      )}

      {newProjectWarningOpen && (
        <div className="confirm-overlay">
          <div className="confirm-modal">
            <h2>Nouveau projet</h2>
            <p>Tu vas fermer le projet en cours et ouvrir une page vierge.</p>
            <p className="confirm-warning">
              {hasUnsavedChanges
                ? "Attention: exporte un ZIP si tu veux conserver les modifications avant de quitter."
                : "Pense a exporter un ZIP si besoin avant de quitter ce projet."}
            </p>
            <div className="confirm-actions">
              <button
                className="button-secondary"
                onClick={() => setNewProjectWarningOpen(false)}
                disabled={actionBusy}
              >
                Annuler
              </button>
              <button
                className="button-danger"
                onClick={confirmNewProjectWithoutSave}
                disabled={actionBusy}
              >
                Quitter sans sauvegarder
              </button>
            </div>
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
          equippedInventoryItemId={previewState?.equippedInventoryItemId ?? null}
          projectVariables={project.variables}
          assetPreviewSrcById={assetPreviewSrcById}
          blockById={blockById}
          onRestart={startPreview}
          onClose={() => setPreviewOpen(false)}
          onContinue={continuePreview}
          onPickChoice={pickPreviewChoice}
          onPickObject={pickPreviewObject}
          onDropKeyOnLock={dropKeyOnLock}
          onDropInventoryItemOnLock={dropInventoryItemOnLock}
          onEquipInventoryItem={equipPreviewInventoryItem}
        />
      )}
    </div>
  );
}

