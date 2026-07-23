import { Dispatch, SetStateAction, useCallback, useMemo, useState } from "react";

import {
  EditorEdge,
  EditorNode,
  computePartBlockSets,
} from "@/components/author-studio-core";
import { ProjectMeta, StoryBlock } from "@/lib/story";

interface UseStudioPartsOptions {
  nodes: EditorNode[];
  edges: EditorEdge[];
  project: ProjectMeta;
  setProject: Dispatch<SetStateAction<ProjectMeta>>;
  blockById: Map<string, StoryBlock>;
  canEdit: boolean;
  removeSelectedBlocks: (ids: Set<string>) => void;
  replaceSelectedBlocks: (ids: string[], focusedId: string | null) => void;
  setStatusMessage: (message: string) => void;
}

export function useStudioParts({
  nodes,
  edges,
  project,
  setProject,
  blockById,
  canEdit,
  removeSelectedBlocks,
  replaceSelectedBlocks,
  setStatusMessage,
}: UseStudioPartsOptions) {
  const [openedValidatedPartIds, setOpenedValidatedPartIds] = useState<string[]>([]);
  const partBlockSets = useMemo(
    () => computePartBlockSets(nodes, edges, project.parts),
    [edges, nodes, project.parts],
  );
  const openedValidatedPartIdSet = useMemo(
    () => new Set(openedValidatedPartIds),
    [openedValidatedPartIds],
  );
  const hiddenValidatedPartIds = useMemo(
    () =>
      new Set(
        project.parts
          .filter((part) => part.validated && !openedValidatedPartIdSet.has(part.id))
          .map((part) => part.id),
      ),
    [openedValidatedPartIdSet, project.parts],
  );

  const setPartValidationFromEnd = useCallback((partEndBlockId: string, validated: boolean) => {
    if (!canEdit) return;
    const endBlock = blockById.get(partEndBlockId);
    if (!endBlock || endBlock.type !== "part_end" || !endBlock.partId) return;
    const part = project.parts.find((candidate) => candidate.id === endBlock.partId);
    if (!part) {
      setStatusMessage("Partie introuvable pour cette fin de partie.");
      return;
    }
    if (validated && !part.chapterId) {
      setStatusMessage("Selectionne le chapitre parent avant de valider cette partie.");
      return;
    }
    const memberIds = partBlockSets.get(part.id);
    const hasStart = nodes.some(
      (node) => node.data.block.type === "part_start" && node.data.block.partId === part.id,
    );
    if (validated && (!hasStart || !memberIds?.has(partEndBlockId))) {
      setStatusMessage("Relie le debut de partie a cette fin de partie avant de la valider.");
      return;
    }

    setProject((current) => ({
      ...current,
      parts: current.parts.map((candidate) =>
        candidate.id === part.id ? { ...candidate, validated } : candidate,
      ),
      info: { ...current.info, updatedAt: new Date().toISOString() },
    }));

    if (validated) {
      setOpenedValidatedPartIds((current) => current.filter((id) => id !== part.id));
      removeSelectedBlocks(memberIds ?? new Set<string>());
      setStatusMessage(`Partie "${part.name}" validee et archivee.`);
      return;
    }

    setStatusMessage(`Partie "${part.name}" remise en edition.`);
  }, [
    blockById,
    canEdit,
    nodes,
    partBlockSets,
    project.parts,
    removeSelectedBlocks,
    setProject,
    setStatusMessage,
  ]);

  const toggleValidatedPartVisibility = useCallback((partId: string) => {
    const part = project.parts.find((candidate) => candidate.id === partId);
    if (!part?.validated) return;
    if (openedValidatedPartIdSet.has(partId)) {
      setOpenedValidatedPartIds((current) => current.filter((id) => id !== partId));
      removeSelectedBlocks(partBlockSets.get(partId) ?? new Set<string>());
      setStatusMessage(`Partie "${part.name}" masquee du whiteboard.`);
      return;
    }
    setOpenedValidatedPartIds((current) => [...current, partId]);
    const start = nodes.find(
      (node) => node.data.block.type === "part_start" && node.data.block.partId === partId,
    );
    if (start) replaceSelectedBlocks([start.id], start.id);
    setStatusMessage(`Partie "${part.name}" reouverte sur le whiteboard.`);
  }, [
    nodes,
    openedValidatedPartIdSet,
    partBlockSets,
    project.parts,
    removeSelectedBlocks,
    replaceSelectedBlocks,
    setStatusMessage,
  ]);

  return {
    hiddenValidatedPartIds,
    openedValidatedPartIds,
    partBlockSets,
    setOpenedValidatedPartIds,
    setPartValidationFromEnd,
    toggleValidatedPartVisibility,
  };
}
