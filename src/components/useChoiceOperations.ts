import {
  normalizeDelta,
} from "@/components/author-studio-core";
import {
  CHOICE_LABELS,
  ChoiceBlock,
  StoryBlock,
  createId,
} from "@/lib/story";

/* ------------------------------------------------------------------ */
/*  Params                                                             */
/* ------------------------------------------------------------------ */

interface UseChoiceOperationsParams {
  canEdit: boolean;
  selectedBlock: StoryBlock | null;
  updateSelectedBlock: (updater: (block: StoryBlock) => StoryBlock) => void;
  setConnection: (sourceId: string, sourceHandle: string, targetId: string | null, targetHandle?: string | null) => void;
  logAction: (action: string, details: string) => void;
  setStatusMessage: (message: string) => void;
  projectVariables: { id: string }[];
  registerAsset: (file: File) => string;
  ensureAssetPreviewSrc: (assetId: string | null) => Promise<string | null>;
}

/* ------------------------------------------------------------------ */
/*  Hook                                                               */
/* ------------------------------------------------------------------ */

export function useChoiceOperations({
  canEdit,
  selectedBlock,
  updateSelectedBlock,
  setConnection,
  logAction,
  setStatusMessage,
  projectVariables,
  registerAsset,
  ensureAssetPreviewSrc,
}: UseChoiceOperationsParams) {

  const asChoice = (): ChoiceBlock | null =>
    canEdit && selectedBlock?.type === "choice" ? selectedBlock : null;

  /* ── Options ── */

  const addChoiceOption = () => {
    const block = asChoice();
    if (!block || block.choices.length >= 4) return;
    const label = CHOICE_LABELS[block.choices.length];
    updateSelectedBlock((b) => {
      if (b.type !== "choice") return b;
      return {
        ...b,
        choices: [
          ...b.choices,
          {
            id: createId("option"),
            label,
            text: "",
            description: "",
            imageAssetId: null,
            targetBlockId: null,
            effects: [],
          },
        ],
      };
    });
    logAction("add_choice_option", `${block.id} option ${label}`);
  };

  const removeChoiceOption = () => {
    const block = asChoice();
    if (!block || block.choices.length <= 1) return;
    const removed = block.choices[block.choices.length - 1];
    setConnection(block.id, `choice-${removed.label}`, null);
    updateSelectedBlock((b) => {
      if (b.type !== "choice") return b;
      return { ...b, choices: b.choices.slice(0, -1) };
    });
    logAction("remove_choice_option", `${block.id} option ${removed.label}`);
  };

  const updateChoiceOptionDescription = (optionId: string, description: string) => {
    if (!asChoice()) return;
    updateSelectedBlock((b) => {
      if (b.type !== "choice") return b;
      return {
        ...b,
        choices: b.choices.map((option) =>
          option.id === optionId ? { ...option, description } : option,
        ),
      };
    });
  };

  const setChoiceOptionImage = (optionId: string, file: File) => {
    const block = asChoice();
    if (!block) return;
    const assetId = registerAsset(file);
    void ensureAssetPreviewSrc(assetId);
    updateSelectedBlock((b) => {
      if (b.type !== "choice") return b;
      return {
        ...b,
        choices: b.choices.map((option) =>
          option.id === optionId ? { ...option, imageAssetId: assetId } : option,
        ),
      };
    });
    logAction("set_choice_option_image", `${block.id} option ${optionId}`);
  };

  const clearChoiceOptionImage = (optionId: string) => {
    const block = asChoice();
    if (!block) return;
    updateSelectedBlock((b) => {
      if (b.type !== "choice") return b;
      return {
        ...b,
        choices: b.choices.map((option) =>
          option.id === optionId ? { ...option, imageAssetId: null } : option,
        ),
      };
    });
    logAction("clear_choice_option_image", `${block.id} option ${optionId}`);
  };

  const updateChoiceField = (
    choiceId: string,
    field: "text" | "targetBlockId",
    value: string,
  ) => {
    if (!selectedBlock || selectedBlock.type !== "choice") return;

    if (field === "targetBlockId") {
      const choice = selectedBlock.choices.find((item) => item.id === choiceId);
      if (!choice) return;
      setConnection(selectedBlock.id, `choice-${choice.label}`, value || null);
      return;
    }

    updateSelectedBlock((b) => {
      if (b.type === "choice") {
        return {
          ...b,
          choices: b.choices.map((option) =>
            option.id === choiceId ? { ...option, [field]: value } : option,
          ),
        };
      }
      return b;
    });
  };

  /* ── Choice effects ── */

  const addChoiceEffect = (choiceId: string) => {
    if (!asChoice()) return;
    const fallbackVariableId = projectVariables[0]?.id;
    if (!fallbackVariableId) {
      setStatusMessage("Ajoute d'abord une variable globale.");
      return;
    }
    const addEffect = <T extends { id: string; effects: { variableId: string; delta: number }[] }>(choice: T): T =>
      choice.id === choiceId
        ? { ...choice, effects: [...choice.effects, { variableId: fallbackVariableId, delta: 1 }] }
        : choice;

    updateSelectedBlock((b) => {
      if (b.type === "choice") return { ...b, choices: b.choices.map(addEffect) };
      return b;
    });
  };

  const updateChoiceEffect = (
    choiceId: string,
    effectIndex: number,
    key: "variableId" | "delta",
    value: string,
  ) => {
    const patchEffect = <T extends { id: string; effects: { variableId: string; delta: number }[] }>(choice: T): T => {
      if (choice.id !== choiceId) return choice;
      return {
        ...choice,
        effects: choice.effects.map((effect, index) =>
          index === effectIndex
            ? { ...effect, [key]: key === "delta" ? normalizeDelta(value) : value }
            : effect,
        ),
      };
    };
    updateSelectedBlock((b) => {
      if (b.type === "choice") return { ...b, choices: b.choices.map(patchEffect) };
      return b;
    });
  };

  const removeChoiceEffect = (choiceId: string, effectIndex: number) => {
    const dropEffect = <T extends { id: string; effects: { variableId: string; delta: number }[] }>(choice: T): T =>
      choice.id === choiceId
        ? { ...choice, effects: choice.effects.filter((_, index) => index !== effectIndex) }
        : choice;

    updateSelectedBlock((b) => {
      if (b.type === "choice") return { ...b, choices: b.choices.map(dropEffect) };
      return b;
    });
  };

  return {
    addChoiceOption,
    removeChoiceOption,
    updateChoiceOptionDescription,
    setChoiceOptionImage,
    clearChoiceOptionImage,
    updateChoiceField,
    addChoiceEffect,
    updateChoiceEffect,
    removeChoiceEffect,
  };
}
