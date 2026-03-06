import { normalizeDelta } from "@/components/author-studio-core";
import { StoryBlock } from "@/lib/story";

/* ------------------------------------------------------------------ */
/*  Params                                                             */
/* ------------------------------------------------------------------ */

interface UseBlockEffectOperationsParams {
  selectedBlock: StoryBlock | null;
  updateSelectedBlock: (updater: (block: StoryBlock) => StoryBlock) => void;
  setStatusMessage: (message: string) => void;
  projectVariables: { id: string }[];
}

/* ------------------------------------------------------------------ */
/*  Hook                                                               */
/* ------------------------------------------------------------------ */

export function useBlockEffectOperations({
  selectedBlock,
  updateSelectedBlock,
  setStatusMessage,
  projectVariables,
}: UseBlockEffectOperationsParams) {

  const addBlockEntryEffect = () => {
    if (!selectedBlock) return;
    const fallbackVariableId = projectVariables[0]?.id;
    if (!fallbackVariableId) {
      setStatusMessage("Ajoute d'abord une variable globale.");
      return;
    }
    updateSelectedBlock((block) => ({
      ...block,
      entryEffects: [...(block.entryEffects ?? []), { variableId: fallbackVariableId, delta: 1 }],
    }));
  };

  const updateBlockEntryEffect = (
    effectIndex: number,
    key: "variableId" | "delta",
    value: string,
  ) => {
    updateSelectedBlock((block) => ({
      ...block,
      entryEffects: (block.entryEffects ?? []).map((effect, index) =>
        index === effectIndex
          ? { ...effect, [key]: key === "delta" ? normalizeDelta(value) : value }
          : effect,
      ),
    }));
  };

  const removeBlockEntryEffect = (effectIndex: number) => {
    updateSelectedBlock((block) => ({
      ...block,
      entryEffects: (block.entryEffects ?? []).filter((_, index) => index !== effectIndex),
    }));
  };

  return {
    addBlockEntryEffect,
    updateBlockEntryEffect,
    removeBlockEntryEffect,
  };
}
