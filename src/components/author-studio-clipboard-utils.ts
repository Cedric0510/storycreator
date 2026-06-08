import {
  BLOCK_LABELS,
  type ChoiceBlock,
  type CinematicBlock,
  createId,
  type DialogueBlock,
  type GameplayBlock,
  normalizeStoryBlock,
  type StoryBlock,
  type SwitchBlock,
  type XYPosition,
} from "../lib/story";

export function isClipboardEligibleBlock(block: StoryBlock) {
  return block.type !== "chapter_start" && block.type !== "chapter_end";
}

export function filterClipboardEligibleBlocks(blocks: StoryBlock[]) {
  return blocks.filter(isClipboardEligibleBlock);
}

export function sortBlocksForClipboard(blocks: StoryBlock[]) {
  return [...blocks].sort(
    (left, right) =>
      left.position.y - right.position.y ||
      left.position.x - right.position.x ||
      left.id.localeCompare(right.id),
  );
}

export function duplicateClipboardBlocks(
  sourceBlocks: StoryBlock[],
  positionOffset: XYPosition,
) {
  const sortedSourceBlocks = sortBlocksForClipboard(filterClipboardEligibleBlocks(sourceBlocks));
  const dialogueLineIdMaps = new Map<string, Map<string, string>>();
  const cinematicNarrationIdMaps = new Map<string, Map<string, string>>();
  const gameplayObjectIdMaps = new Map<string, Map<string, string>>();
  const clonedBlocksBySourceId = new Map<string, StoryBlock>();

  for (const sourceBlock of sortedSourceBlocks) {
    const clone = structuredClone(sourceBlock) as StoryBlock;
    clone.id = createId(sourceBlock.type);
    clone.name = `${sourceBlock.name || BLOCK_LABELS[sourceBlock.type]} (copie)`;
    clone.position = {
      x: sourceBlock.position.x + positionOffset.x,
      y: sourceBlock.position.y + positionOffset.y,
    };

    if (clone.type === "dialogue") {
      const lineIdMap = new Map<string, string>();
      for (const line of clone.lines) {
        const newLineId = createId("line");
        lineIdMap.set(line.id, newLineId);
        line.id = newLineId;
        for (const response of line.responses) {
          response.id = createId("resp");
        }
      }
      dialogueLineIdMaps.set(sourceBlock.id, lineIdMap);
    } else if (clone.type === "cinematic") {
      const narrationIdMap = new Map<string, string>();
      for (const narration of clone.narrations) {
        const newNarrationId = createId("cnarr");
        narrationIdMap.set(narration.id, newNarrationId);
        narration.id = newNarrationId;
      }
      cinematicNarrationIdMaps.set(sourceBlock.id, narrationIdMap);
    } else if (clone.type === "choice") {
      for (const choice of clone.choices) {
        choice.id = createId("opt");
      }
    } else if (clone.type === "switch") {
      for (const item of clone.cases) {
        item.id = createId("switch_case");
        item.conditions = item.conditions.map((condition) => ({
          ...condition,
          id: createId("switch_cond"),
        }));
        item.choiceConditions = item.choiceConditions.map((condition) => ({
          ...condition,
          id: createId("switch_choice_cond"),
        }));
      }
    } else if (clone.type === "gameplay") {
      const objectIdMap = new Map<string, string>();
      for (const object of clone.objects) {
        const newObjectId = createId("gobj");
        objectIdMap.set(object.id, newObjectId);
        object.id = newObjectId;
      }
      gameplayObjectIdMaps.set(sourceBlock.id, objectIdMap);
    }

    clonedBlocksBySourceId.set(sourceBlock.id, clone);
  }

  for (const sourceBlock of sortedSourceBlocks) {
    const clone = clonedBlocksBySourceId.get(sourceBlock.id);
    if (!clone) continue;

    if (clone.type === "title") {
      clone.nextBlockId = null;
      continue;
    }

    if (clone.type === "dialogue") {
      const sourceDialogue = sourceBlock as DialogueBlock;
      const lineIdMap = dialogueLineIdMaps.get(sourceBlock.id) ?? new Map<string, string>();

      clone.startLineId =
        lineIdMap.get(sourceDialogue.startLineId) ?? clone.lines[0]?.id ?? "";
      clone.lines = clone.lines.map((line, lineIndex) => {
        const sourceLine = sourceDialogue.lines[lineIndex];
        const responses = line.responses.map((response, responseIndex) => {
          const sourceResponse = sourceLine.responses[responseIndex];
          const targetsCurrentBlock =
            !sourceResponse.targetBlockId || sourceResponse.targetBlockId === sourceDialogue.id;

          return {
            ...response,
            targetBlockId: sourceResponse.targetBlockId === sourceDialogue.id ? clone.id : null,
            targetLineId:
              targetsCurrentBlock && sourceResponse.targetLineId
                ? lineIdMap.get(sourceResponse.targetLineId) ?? null
                : null,
          };
        });

        return {
          ...line,
          fallbackLineId: sourceLine.fallbackLineId
            ? lineIdMap.get(sourceLine.fallbackLineId) ?? null
            : null,
          continueTargetBlockId:
            sourceLine.continueTargetBlockId === sourceDialogue.id ? clone.id : null,
          responses,
        };
      });
      continue;
    }

    if (clone.type === "cinematic") {
      const sourceCinematic = sourceBlock as CinematicBlock;
      const narrationIdMap = cinematicNarrationIdMaps.get(sourceBlock.id) ?? new Map<string, string>();

      clone.startNarrationId =
        narrationIdMap.get(sourceCinematic.startNarrationId) ?? clone.narrations[0]?.id ?? "";
      clone.narrations = clone.narrations.map((narration, narrationIndex) => {
        const sourceNarration = sourceCinematic.narrations[narrationIndex];
        const targetsCurrentBlock =
          !sourceNarration.continueTargetBlockId ||
          sourceNarration.continueTargetBlockId === sourceCinematic.id;

        return {
          ...narration,
          continueTargetBlockId:
            sourceNarration.continueTargetBlockId === sourceCinematic.id ? clone.id : null,
          continueTargetNarrationId:
            targetsCurrentBlock && sourceNarration.continueTargetNarrationId
              ? narrationIdMap.get(sourceNarration.continueTargetNarrationId) ?? null
              : null,
        };
      });
      clone.nextBlockId = null;
      continue;
    }

    if (clone.type === "choice") {
      const sourceChoice = sourceBlock as ChoiceBlock;
      clone.choices = clone.choices.map((choice, choiceIndex) => {
        const sourceOption = sourceChoice.choices[choiceIndex];
        return {
          ...choice,
          targetBlockId: sourceOption.targetBlockId === sourceChoice.id ? clone.id : null,
        };
      });
      continue;
    }

    if (clone.type === "switch") {
      const sourceSwitch = sourceBlock as SwitchBlock;
      clone.cases = clone.cases.map((item, caseIndex) => {
        const sourceCase = sourceSwitch.cases[caseIndex];
        return {
          ...item,
          conditions: item.conditions.map((condition) => ({
            ...condition,
            choiceBlockId: null,
            choiceOptionId: null,
          })),
          choiceConditions: item.choiceConditions.map((condition) => ({
            ...condition,
            choiceBlockId: null,
            choiceOptionId: null,
          })),
          choiceBlockId: null,
          choiceOptionId: null,
          targetBlockId: sourceCase.targetBlockId === sourceSwitch.id ? clone.id : null,
        };
      });
      clone.nextBlockId = null;
      continue;
    }

    if (clone.type === "gameplay") {
      const sourceGameplay = sourceBlock as GameplayBlock;
      const objectIdMap = gameplayObjectIdMaps.get(sourceBlock.id) ?? new Map<string, string>();

      clone.objects = clone.objects.map((object, objectIndex) => {
        const sourceObject = sourceGameplay.objects[objectIndex];
        return {
          ...object,
          linkedKeyId: sourceObject.linkedKeyId
            ? objectIdMap.get(sourceObject.linkedKeyId) ?? null
            : null,
          targetBlockId: sourceObject.targetBlockId === sourceGameplay.id ? clone.id : null,
        };
      });
      clone.buttonSequence = sourceGameplay.buttonSequence
        .map((buttonId) => objectIdMap.get(buttonId) ?? null)
        .filter((buttonId): buttonId is string => Boolean(buttonId));
      clone.buttonSequenceSuccessBlockId = null;
      clone.buttonSequenceFailureBlockId = null;
      clone.nextBlockId = null;
      continue;
    }

    if (
      clone.type === "hero_profile" ||
      clone.type === "npc_profile"
    ) {
      clone.nextBlockId = null;
    }
  }

  return sortedSourceBlocks.map((sourceBlock) =>
    normalizeStoryBlock(clonedBlocksBySourceId.get(sourceBlock.id) ?? sourceBlock),
  );
}
