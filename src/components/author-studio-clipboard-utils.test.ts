import { describe, expect, it } from "vitest";

import { duplicateClipboardBlocks } from "./author-studio-clipboard-utils";
import {
  createBlock,
  type ChapterStartBlock,
  type ChoiceBlock,
  type DialogueBlock,
  type TitleBlock,
} from "../lib/story";

describe("author studio clipboard utils", () => {
  it("ignores chapter boundary blocks and drops inter-block graph links", () => {
    const chapterStart = createBlock("chapter_start", { x: 0, y: 0 }) as ChapterStartBlock;
    const title = createBlock("title", { x: 20, y: 10 }) as TitleBlock;
    const choice = createBlock("choice", { x: 80, y: 10 }) as ChoiceBlock;

    title.nextBlockId = choice.id;
    choice.choices = choice.choices.map((option, index) => ({
      ...option,
      targetBlockId: index === 0 ? title.id : option.targetBlockId,
    }));

    const duplicatedBlocks = duplicateClipboardBlocks([chapterStart, title, choice], { x: 60, y: 40 });

    expect(duplicatedBlocks).toHaveLength(2);
    expect(duplicatedBlocks.some((block) => block.type === "chapter_start")).toBe(false);

    const duplicatedTitle = duplicatedBlocks.find((block) => block.type === "title") as TitleBlock | undefined;
    const duplicatedChoice = duplicatedBlocks.find((block) => block.type === "choice") as ChoiceBlock | undefined;

    expect(duplicatedTitle?.nextBlockId).toBeNull();
    expect(duplicatedChoice?.choices[0]?.targetBlockId).toBeNull();
    expect(duplicatedTitle?.position).toEqual({ x: 80, y: 50 });
  });

  it("keeps dialogue internal line references and removes external block targets", () => {
    const dialogue = createBlock("dialogue", { x: 0, y: 0 }) as DialogueBlock;

    dialogue.startLineId = "line_a";
    dialogue.lines = [
      {
        id: "line_a",
        speaker: "Narrateur",
        text: "Debut",
        voiceAssetId: null,
        conditions: [],
        fallbackLineId: null,
        continueTargetBlockId: "external_block",
        responses: [
          {
            id: "resp_a",
            label: "A",
            text: "Continuer",
            targetLineId: "line_b",
            targetBlockId: null,
            effects: [],
            affinityEffects: [],
          },
          {
            id: "resp_b",
            label: "B",
            text: "Sortir",
            targetLineId: "external_line",
            targetBlockId: "external_block",
            effects: [],
            affinityEffects: [],
          },
        ],
      },
      {
        id: "line_b",
        speaker: "Narrateur",
        text: "Suite",
        voiceAssetId: null,
        conditions: [],
        fallbackLineId: "line_a",
        continueTargetBlockId: null,
        responses: [],
      },
    ];

    const [duplicatedDialogue] = duplicateClipboardBlocks([dialogue], { x: 30, y: 15 }) as DialogueBlock[];

    expect(duplicatedDialogue.id).not.toBe(dialogue.id);
    expect(duplicatedDialogue.position).toEqual({ x: 30, y: 15 });
    expect(duplicatedDialogue.startLineId).toBe(duplicatedDialogue.lines[0]?.id);
    expect(duplicatedDialogue.lines[1]?.fallbackLineId).toBe(duplicatedDialogue.lines[0]?.id);
    expect(duplicatedDialogue.lines[0]?.continueTargetBlockId).toBeNull();
    expect(duplicatedDialogue.lines[0]?.responses[0]?.targetBlockId).toBeNull();
    expect(duplicatedDialogue.lines[0]?.responses[0]?.targetLineId).toBe(duplicatedDialogue.lines[1]?.id);
    expect(duplicatedDialogue.lines[0]?.responses[1]?.targetBlockId).toBeNull();
    expect(duplicatedDialogue.lines[0]?.responses[1]?.targetLineId).toBeNull();
  });
});
