import { describe, expect, it } from "vitest";

import {
  createBlock,
  normalizeGameplayBlock,
  normalizeStoryBlock,
  validateStoryBlocks,
  type ChoiceBlock,
  type DialogueBlock,
  type GameplayBlock,
} from "./story";

describe("story gameplay schema", () => {
  it("creates gameplay block with point and click defaults", () => {
    const block = createBlock("gameplay", { x: 100, y: 120 }) as GameplayBlock;

    expect(block.mode).toBe("point_and_click");
    expect(block.overlays.length).toBeGreaterThan(0);
    expect(block.hotspots.length).toBeGreaterThan(0);
    expect(block.completionRule.type).toBe("all_required");
  });

  it("normalizes malformed gameplay payloads", () => {
    const base = createBlock("gameplay", { x: 0, y: 0 }) as GameplayBlock;
    const malformed = {
      ...base,
      overlays: undefined,
      hotspots: undefined,
      completionRule: null,
      completionEffects: null,
    } as unknown as GameplayBlock;

    const normalized = normalizeGameplayBlock(malformed);

    expect(normalized.mode).toBe("point_and_click");
    expect(normalized.overlays).toEqual([]);
    expect(normalized.hotspots).toEqual([]);
    expect(normalized.completionRule.type).toBe("all_required");
    expect(normalized.completionRule.requiredCount).toBe(1);
    expect(normalized.completionEffects).toEqual([]);
  });

  it("reports gameplay validation issues", () => {
    const title = createBlock("title", { x: 0, y: 0 });
    const gameplay = createBlock("gameplay", { x: 50, y: 50 }) as GameplayBlock;

    gameplay.hotspots = [];

    const issues = validateStoryBlocks([title, gameplay], title.id);

    expect(
      issues.some(
        (issue) =>
          issue.level === "error" &&
          issue.blockId === gameplay.id &&
          issue.message.includes("zone cliquable"),
      ),
    ).toBe(true);
  });

  it("detects hotspot links to missing overlays", () => {
    const title = createBlock("title", { x: 0, y: 0 });
    const gameplay = createBlock("gameplay", { x: 50, y: 50 }) as GameplayBlock;

    gameplay.hotspots = gameplay.hotspots.map((hotspot) => ({
      ...hotspot,
      toggleOverlayId: "overlay_missing",
    }));

    const issues = validateStoryBlocks([title, gameplay], title.id);

    expect(
      issues.some(
        (issue) =>
          issue.level === "error" &&
          issue.blockId === gameplay.id &&
          issue.message.includes("overlay introuvable"),
      ),
    ).toBe(true);
  });

  it("detects hotspot click actions targeting missing blocks", () => {
    const title = createBlock("title", { x: 0, y: 0 });
    const gameplay = createBlock("gameplay", { x: 50, y: 50 }) as GameplayBlock;

    gameplay.hotspots = gameplay.hotspots.map((hotspot) => ({
      ...hotspot,
      onClickActions: [
        {
          id: "action_1",
          type: "go_to_block",
          targetBlockId: "block_missing",
        },
      ],
    }));

    const issues = validateStoryBlocks([title, gameplay], title.id);

    expect(
      issues.some(
        (issue) =>
          issue.level === "error" &&
          issue.blockId === gameplay.id &&
          issue.message.includes("action vers un bloc supprime"),
      ),
    ).toBe(true);
  });

  it("detects hotspot item rewards targeting missing items", () => {
    const title = createBlock("title", { x: 0, y: 0 });
    const gameplay = createBlock("gameplay", { x: 50, y: 50 }) as GameplayBlock;

    gameplay.hotspots = gameplay.hotspots.map((hotspot) => ({
      ...hotspot,
      onClickActions: [
        {
          id: "action_item_1",
          type: "add_item",
          itemId: "item_missing",
          quantity: 1,
        },
      ],
    }));

    const issues = validateStoryBlocks([title, gameplay], title.id, []);

    expect(
      issues.some(
        (issue) =>
          issue.level === "error" &&
          issue.blockId === gameplay.id &&
          issue.message.includes("objet introuvable"),
      ),
    ).toBe(true);
  });
});

describe("story choice block", () => {
  it("creates choice block with default options", () => {
    const block = createBlock("choice", { x: 0, y: 0 }) as ChoiceBlock;

    expect(block.type).toBe("choice");
    expect(block.prompt).toBe("Que fais-tu ?");
    expect(block.backgroundAssetId).toBeNull();
    expect(block.voiceAssetId).toBeNull();
    expect(block.choices).toHaveLength(2);
    expect(block.choices[0].label).toBe("A");
    expect(block.choices[1].label).toBe("B");
    expect(block.choices[0].description).toBe("");
    expect(block.choices[0].imageAssetId).toBeNull();
    expect(block.choices[0].effects).toEqual([]);
  });

  it("reports empty prompt as warning", () => {
    const title = createBlock("title", { x: 0, y: 0 });
    const choice = createBlock("choice", { x: 50, y: 50 }) as ChoiceBlock;
    choice.prompt = "";

    const issues = validateStoryBlocks([title, choice], title.id);

    expect(
      issues.some(
        (issue) =>
          issue.level === "warning" &&
          issue.blockId === choice.id &&
          issue.message.includes("prompt"),
      ),
    ).toBe(true);
  });

  it("reports empty choices as error", () => {
    const title = createBlock("title", { x: 0, y: 0 });
    const choice = createBlock("choice", { x: 50, y: 50 }) as ChoiceBlock;
    choice.choices = [];

    const issues = validateStoryBlocks([title, choice], title.id);

    expect(
      issues.some(
        (issue) =>
          issue.level === "error" &&
          issue.blockId === choice.id &&
          issue.message.includes("option"),
      ),
    ).toBe(true);
  });

  it("reports choice option targeting deleted block", () => {
    const title = createBlock("title", { x: 0, y: 0 });
    const choice = createBlock("choice", { x: 50, y: 50 }) as ChoiceBlock;
    choice.choices[0].targetBlockId = "block_missing";

    const issues = validateStoryBlocks([title, choice], title.id);

    expect(
      issues.some(
        (issue) =>
          issue.level === "error" &&
          issue.blockId === choice.id &&
          issue.message.includes("supprime"),
      ),
    ).toBe(true);
  });
});

describe("story dialogue block (multi-line)", () => {
  it("creates dialogue block with one default line and two responses", () => {
    const block = createBlock("dialogue", { x: 0, y: 0 }) as DialogueBlock;

    expect(block.type).toBe("dialogue");
    expect(block.lines).toHaveLength(1);
    expect(block.startLineId).toBe(block.lines[0].id);
    expect(block.lines[0].speaker).toBe("Narrateur");
    expect(block.lines[0].text).toBe("");
    expect(block.lines[0].voiceAssetId).toBeNull();
    expect(block.lines[0].responses).toHaveLength(2);
    expect(block.lines[0].responses[0].label).toBe("A");
    expect(block.lines[0].responses[1].label).toBe("B");
    expect(block.lines[0].responses[0].targetLineId).toBeNull();
    expect(block.lines[0].responses[0].targetBlockId).toBeNull();
    expect(block.lines[0].responses[0].effects).toEqual([]);
    // sceneLayout defaults
    expect(block.sceneLayout).toEqual({
      background: { x: 0, y: 0, width: 100, height: 100 },
      character: { x: 25, y: 10, width: 50, height: 80 },
    });
  });

  it("normalizes old v1 dialogue format to multi-line v2", () => {
    const v1Raw = {
      id: "block_1",
      type: "dialogue",
      name: "Test",
      speaker: "Alice",
      line: "Bonjour",
      voiceAssetId: "voice_1",
      backgroundAssetId: null,
      characterAssetId: null,
      npcProfileBlockId: null,
      npcImageAssetId: null,
      choices: [
        { id: "ch_1", label: "A", text: "Oui", targetBlockId: "block_2", effects: [] },
        { id: "ch_2", label: "B", text: "Non", targetBlockId: null, effects: [] },
      ],
      position: { x: 0, y: 0 },
      entryEffects: [],
    };

    const normalized = normalizeStoryBlock(v1Raw as unknown as DialogueBlock);

    expect(normalized.type).toBe("dialogue");
    const dBlock = normalized as DialogueBlock;
    expect(dBlock.lines).toHaveLength(1);
    expect(dBlock.lines[0].speaker).toBe("Alice");
    expect(dBlock.lines[0].text).toBe("Bonjour");
    expect(dBlock.lines[0].voiceAssetId).toBe("voice_1");
    expect(dBlock.lines[0].responses).toHaveLength(2);
    expect(dBlock.lines[0].responses[0].label).toBe("A");
    expect(dBlock.lines[0].responses[0].text).toBe("Oui");
    expect(dBlock.lines[0].responses[0].targetBlockId).toBe("block_2");
    expect(dBlock.startLineId).toBe(dBlock.lines[0].id);
    // sceneLayout is auto-filled even on v1 migration
    expect(dBlock.sceneLayout).toEqual({
      background: { x: 0, y: 0, width: 100, height: 100 },
      character: { x: 25, y: 10, width: 50, height: 80 },
    });
  });

  it("reports empty dialogue lines as error", () => {
    const title = createBlock("title", { x: 0, y: 0 });
    const dialogue = createBlock("dialogue", { x: 50, y: 50 }) as DialogueBlock;
    dialogue.lines = [];

    const issues = validateStoryBlocks([title, dialogue], title.id);

    expect(
      issues.some(
        (issue) =>
          issue.level === "error" &&
          issue.blockId === dialogue.id &&
          issue.message.includes("ligne"),
      ),
    ).toBe(true);
  });

  it("reports response targeting a deleted external block", () => {
    const title = createBlock("title", { x: 0, y: 0 });
    const dialogue = createBlock("dialogue", { x: 50, y: 50 }) as DialogueBlock;
    dialogue.lines[0].responses[0].targetBlockId = "block_missing";

    const issues = validateStoryBlocks([title, dialogue], title.id);

    expect(
      issues.some(
        (issue) =>
          issue.level === "error" &&
          issue.blockId === dialogue.id &&
          issue.message.includes("supprime"),
      ),
    ).toBe(true);
  });

  it("reports response targeting a deleted internal line", () => {
    const title = createBlock("title", { x: 0, y: 0 });
    const dialogue = createBlock("dialogue", { x: 50, y: 50 }) as DialogueBlock;
    dialogue.lines[0].responses[0].targetLineId = "line_missing";

    const issues = validateStoryBlocks([title, dialogue], title.id);

    expect(
      issues.some(
        (issue) =>
          issue.level === "error" &&
          issue.blockId === dialogue.id &&
          issue.message.includes("ligne supprimee"),
      ),
    ).toBe(true);
  });
});
