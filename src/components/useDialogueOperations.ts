import { Dispatch, SetStateAction } from "react";

import {
  EditorEdge,
  buildEdge,
  normalizeDelta,
} from "@/components/author-studio-core";
import {
  CHOICE_LABELS,
  DialogueBlock,
  StoryBlock,
  createDefaultLine,
  createDefaultResponse,
} from "@/lib/story";

/* ------------------------------------------------------------------ */
/*  Params                                                             */
/* ------------------------------------------------------------------ */

interface UseDialogueOperationsParams {
  canEdit: boolean;
  selectedBlock: StoryBlock | null;
  updateSelectedBlock: (updater: (block: StoryBlock) => StoryBlock) => void;
  setEdges: Dispatch<SetStateAction<EditorEdge[]>>;
  setConnection: (sourceId: string, sourceHandle: string, targetId: string | null, targetHandle?: string | null) => void;
  touchProject: () => void;
  logAction: (action: string, details: string) => void;
  setStatusMessage: (message: string) => void;
  projectVariables: { id: string }[];
}

/* ------------------------------------------------------------------ */
/*  Hook                                                               */
/* ------------------------------------------------------------------ */

export function useDialogueOperations({
  canEdit,
  selectedBlock,
  updateSelectedBlock,
  setEdges,
  setConnection,
  touchProject,
  logAction,
  setStatusMessage,
  projectVariables,
}: UseDialogueOperationsParams) {

  const asDialogue = (): DialogueBlock | null =>
    canEdit && selectedBlock?.type === "dialogue" ? selectedBlock : null;

  /* ── Lines ── */

  const addDialogueLine = (afterLineId?: string) => {
    const block = asDialogue();
    if (!block) return;
    const requestedIndex =
      afterLineId
        ? block.lines.findIndex((line) => line.id === afterLineId) + 1
        : block.lines.length;
    const insertIndex =
      requestedIndex > 0 && requestedIndex <= block.lines.length
        ? requestedIndex
        : block.lines.length;
    let defaultSpeaker = "Narrateur";
    if (afterLineId) {
      const sourceLine = block.lines.find((line) => line.id === afterLineId) ?? null;
      const sourceSpeaker = sourceLine?.speaker?.trim();
      if (sourceSpeaker) {
        defaultSpeaker = sourceSpeaker;
      }
    }
    if (defaultSpeaker === "Narrateur") {
      for (let index = insertIndex - 1; index >= 0; index -= 1) {
        const candidateSpeaker = block.lines[index]?.speaker?.trim();
        if (candidateSpeaker) {
          defaultSpeaker = candidateSpeaker;
          break;
        }
      }
    }
    if (defaultSpeaker === "Narrateur") {
      const firstSpeaker = block.lines[0]?.speaker?.trim();
      if (firstSpeaker) defaultSpeaker = firstSpeaker;
    }
    const newLine = createDefaultLine(defaultSpeaker);
    updateSelectedBlock((b) => {
      if (b.type !== "dialogue") return b;
      const nextLines = [...b.lines];
      nextLines.splice(insertIndex, 0, newLine);
      return {
        ...b,
        lines: nextLines,
        startLineId: b.startLineId || newLine.id,
      };
    });
    logAction(
      "add_dialogue_line",
      `${block.id} line ${newLine.id}${afterLineId ? ` after ${afterLineId}` : ""}`,
    );
  };

  const removeDialogueLine = (lineId: string) => {
    const block = asDialogue();
    if (!block || block.lines.length <= 1) return;
    const removedLine = block.lines.find((l) => l.id === lineId);
    if (!removedLine) return;

    const removedRespHandles = new Set(
      removedLine.responses
        .filter((r) => r.targetBlockId || r.targetLineId)
        .map((r) => `resp-${r.id}`),
    );

    setEdges((current) =>
      current.filter((edge) => {
        if (edge.source === block.id && removedRespHandles.has(edge.sourceHandle ?? "")) return false;
        if (
          edge.source === block.id &&
          (edge.sourceHandle ?? "") === `line-continue-${lineId}`
        ) {
          return false;
        }
        if (edge.target === block.id && edge.targetHandle === `line-${lineId}`) return false;
        return true;
      }),
    );

    updateSelectedBlock((b) => {
      if (b.type !== "dialogue") return b;
      const newLines = b.lines
        .filter((l) => l.id !== lineId)
        .map((l) => ({
          ...l,
          responses: l.responses.map((r) =>
            r.targetLineId === lineId ? { ...r, targetLineId: null } : r,
          ),
        }));
      const startLineId =
        b.startLineId === lineId ? (newLines[0]?.id ?? b.startLineId) : b.startLineId;
      return { ...b, lines: newLines, startLineId };
    });
    logAction("remove_dialogue_line", `${block.id} line ${lineId}`);
  };

  const updateDialogueLineField = (lineId: string, field: string, value: string | number | null) => {
    if (!asDialogue()) return;
    updateSelectedBlock((b) => {
      if (b.type !== "dialogue") return b;
      return {
        ...b,
        lines: b.lines.map((l) =>
          l.id === lineId ? { ...l, [field]: value } : l,
        ),
      };
    });
  };

  /* ── Responses ── */

  const addDialogueLineResponse = (lineId: string) => {
    const block = asDialogue();
    if (!block) return;
    const line = block.lines.find((l) => l.id === lineId);
    if (!line || line.responses.length >= 4) return;
    if (line.responses.length === 0) {
      setEdges((current) =>
        current.filter(
          (edge) =>
            !(
              edge.source === block.id &&
              (edge.sourceHandle ?? "") === `line-continue-${lineId}`
            ),
        ),
      );
    }
    const label = CHOICE_LABELS[line.responses.length];
    const newResp = createDefaultResponse(label);
    updateSelectedBlock((b) => {
      if (b.type !== "dialogue") return b;
      return {
        ...b,
        lines: b.lines.map((l) =>
          l.id === lineId
            ? {
                ...l,
                continueTargetBlockId: null,
                responses: [...l.responses, newResp],
              }
            : l,
        ),
      };
    });
    logAction("add_dialogue_response", `${block.id} line ${lineId} resp ${newResp.id}`);
  };

  const removeDialogueLineResponse = (lineId: string, responseId: string) => {
    const block = asDialogue();
    if (!block) return;
    const line = block.lines.find((l) => l.id === lineId);
    if (!line || line.responses.length === 0) return;
    const removed = line.responses.find((r) => r.id === responseId);
    if (!removed) return;
    if (removed.targetBlockId || removed.targetLineId) {
      setEdges((current) =>
        current.filter(
          (edge) => !(edge.source === block.id && edge.sourceHandle === `resp-${removed.id}`),
        ),
      );
    }
    updateSelectedBlock((b) => {
      if (b.type !== "dialogue") return b;
      return {
        ...b,
        lines: b.lines.map((l) =>
          l.id === lineId
            ? { ...l, responses: l.responses.filter((r) => r.id !== responseId) }
            : l,
        ),
      };
    });
    logAction("remove_dialogue_response", `${block.id} resp ${responseId}`);
  };

  const updateDialogueResponseField = (
    lineId: string,
    responseId: string,
    field: "text" | "targetLineId" | "targetBlockId",
    value: string,
  ) => {
    const block = asDialogue();
    if (!block) return;

    if (field === "targetBlockId") {
      updateSelectedBlock((b) => {
        if (b.type !== "dialogue") return b;
        return {
          ...b,
          lines: b.lines.map((l) =>
            l.id === lineId
              ? {
                  ...l,
                  responses: l.responses.map((r) =>
                    r.id === responseId
                      ? { ...r, targetBlockId: value || null, targetLineId: null }
                      : r,
                  ),
                }
              : l,
          ),
        };
      });
      setConnection(block.id, `resp-${responseId}`, value || null);
      return;
    }

    if (field === "targetLineId") {
      const resp = block.lines
        .flatMap((l) => l.responses)
        .find((r) => r.id === responseId);
      if (resp?.targetBlockId || resp?.targetLineId) {
        setEdges((current) =>
          current.filter(
            (edge) => !(edge.source === block.id && edge.sourceHandle === `resp-${responseId}`),
          ),
        );
      }

      if (value) {
        updateSelectedBlock((b) => {
          if (b.type !== "dialogue") return b;
          return {
            ...b,
            lines: b.lines.map((l) =>
              l.id === lineId
                ? {
                    ...l,
                    responses: l.responses.map((r) =>
                      r.id === responseId
                        ? { ...r, targetLineId: value, targetBlockId: null }
                        : r,
                    ),
                  }
                : l,
            ),
          };
        });
        setEdges((current) => [
          ...current,
          buildEdge(block.id, block.id, `resp-${responseId}`, undefined, `line-${value}`),
        ]);
      } else {
        updateSelectedBlock((b) => {
          if (b.type !== "dialogue") return b;
          return {
            ...b,
            lines: b.lines.map((l) =>
              l.id === lineId
                ? {
                    ...l,
                    responses: l.responses.map((r) =>
                      r.id === responseId
                        ? { ...r, targetLineId: null, targetBlockId: null }
                        : r,
                    ),
                  }
                : l,
            ),
          };
        });
      }
      touchProject();
      return;
    }

    // text field
    updateSelectedBlock((b) => {
      if (b.type !== "dialogue") return b;
      return {
        ...b,
        lines: b.lines.map((l) =>
          l.id === lineId
            ? {
                ...l,
                responses: l.responses.map((r) =>
                  r.id === responseId ? { ...r, [field]: value } : r,
                ),
              }
            : l,
        ),
      };
    });
  };

  /* ── Response effects ── */

  const addResponseEffect = (lineId: string, responseId: string) => {
    if (!asDialogue()) return;
    const fallbackVariableId = projectVariables[0]?.id;
    if (!fallbackVariableId) {
      setStatusMessage("Ajoute d'abord une variable globale.");
      return;
    }
    updateSelectedBlock((b) => {
      if (b.type !== "dialogue") return b;
      return {
        ...b,
        lines: b.lines.map((l) =>
          l.id === lineId
            ? {
                ...l,
                responses: l.responses.map((r) =>
                  r.id === responseId
                    ? { ...r, effects: [...r.effects, { variableId: fallbackVariableId, delta: 1 }] }
                    : r,
                ),
              }
            : l,
        ),
      };
    });
  };

  const updateResponseEffect = (
    lineId: string,
    responseId: string,
    effectIndex: number,
    key: "variableId" | "delta",
    value: string,
  ) => {
    updateSelectedBlock((b) => {
      if (b.type !== "dialogue") return b;
      return {
        ...b,
        lines: b.lines.map((l) =>
          l.id === lineId
            ? {
                ...l,
                responses: l.responses.map((r) =>
                  r.id === responseId
                    ? {
                        ...r,
                        effects: r.effects.map((eff, idx) =>
                          idx === effectIndex
                            ? { ...eff, [key]: key === "delta" ? normalizeDelta(value) : value }
                            : eff,
                        ),
                      }
                    : r,
                ),
              }
            : l,
        ),
      };
    });
  };

  const removeResponseEffect = (lineId: string, responseId: string, effectIndex: number) => {
    updateSelectedBlock((b) => {
      if (b.type !== "dialogue") return b;
      return {
        ...b,
        lines: b.lines.map((l) =>
          l.id === lineId
            ? {
                ...l,
                responses: l.responses.map((r) =>
                  r.id === responseId
                    ? { ...r, effects: r.effects.filter((_, idx) => idx !== effectIndex) }
                    : r,
                ),
              }
            : l,
        ),
      };
    });
  };

  return {
    addDialogueLine,
    removeDialogueLine,
    updateDialogueLineField,
    addDialogueLineResponse,
    removeDialogueLineResponse,
    updateDialogueResponseField,
    addResponseEffect,
    updateResponseEffect,
    removeResponseEffect,
  };
}
