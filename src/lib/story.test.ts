import { describe, expect, it } from "vitest";

import {
  createBlock,
  getBlockOutgoingTargets,
  normalizeGameplayBlock,
  normalizeStoryBlock,
  validateStoryBlocks,
  type ChoiceBlock,
  type DialogueBlock,
  type GameplayBlock,
} from "./story";

describe("story gameplay schema", () => {
  it("creates gameplay block with V3 defaults", () => {
    const block = createBlock("gameplay", { x: 100, y: 120 }) as GameplayBlock;

    expect(block.objects).toEqual([]);
    expect(block.buttonSequence).toEqual([]);
    expect(block.buttonSequenceSuccessBlockId).toBeNull();
    expect(block.buttonSequenceFailureBlockId).toBeNull();
    expect(block.completionEffects).toEqual([]);
    expect(block.nextBlockId).toBeNull();
  });

  it("normalizes malformed gameplay payloads", () => {
    const base = createBlock("gameplay", { x: 0, y: 0 }) as GameplayBlock;
    const malformed = {
      ...base,
      objects: undefined,
      completionEffects: null,
    } as unknown as GameplayBlock;

    const normalized = normalizeGameplayBlock(malformed);

    expect(normalized.objects).toEqual([]);
    expect(normalized.completionEffects).toEqual([]);
  });

  it("auto-completes button sequence with missing button ids", () => {
    const gameplay = createBlock("gameplay", { x: 0, y: 0 }) as GameplayBlock;
    gameplay.objects = [
      {
        id: "btn-1",
        name: "Bouton 1",
        assetId: null,
        soundAssetId: null,
        x: 10,
        y: 10,
        width: 10,
        height: 10,
        zIndex: 1,
        visibleByDefault: true,
        objectType: "button",
        grantItemId: null,
        linkedKeyId: null,
        lockInputMode: "scene_key",
        requiredItemId: null,
        consumeRequiredItem: false,
        targetBlockId: null,
        unlockEffect: "go_to_next",
        lockedMessage: "",
        successMessage: "",
        effects: [],
      },
      {
        id: "btn-2",
        name: "Bouton 2",
        assetId: null,
        soundAssetId: null,
        x: 20,
        y: 10,
        width: 10,
        height: 10,
        zIndex: 1,
        visibleByDefault: true,
        objectType: "button",
        grantItemId: null,
        linkedKeyId: null,
        lockInputMode: "scene_key",
        requiredItemId: null,
        consumeRequiredItem: false,
        targetBlockId: null,
        unlockEffect: "go_to_next",
        lockedMessage: "",
        successMessage: "",
        effects: [],
      },
      {
        id: "btn-3",
        name: "Bouton 3",
        assetId: null,
        soundAssetId: null,
        x: 30,
        y: 10,
        width: 10,
        height: 10,
        zIndex: 1,
        visibleByDefault: true,
        objectType: "button",
        grantItemId: null,
        linkedKeyId: null,
        lockInputMode: "scene_key",
        requiredItemId: null,
        consumeRequiredItem: false,
        targetBlockId: null,
        unlockEffect: "go_to_next",
        lockedMessage: "",
        successMessage: "",
        effects: [],
      },
    ];
    gameplay.buttonSequence = ["btn-2"];

    const normalized = normalizeGameplayBlock(gameplay);

    expect(normalized.buttonSequence).toEqual(["btn-2", "btn-1", "btn-3"]);
  });

  it("reports gameplay validation issues for empty objects", () => {
    const title = createBlock("title", { x: 0, y: 0 });
    const gameplay = createBlock("gameplay", { x: 50, y: 50 }) as GameplayBlock;

    gameplay.objects = [];
    gameplay.objective = "";

    const issues = validateStoryBlocks([title, gameplay], title.id);

    expect(
      issues.some(
        (issue) =>
          issue.level === "warning" &&
          issue.blockId === gameplay.id &&
          issue.message.includes("objectif"),
      ),
    ).toBe(true);
  });

  it("detects lock referencing missing key object", () => {
    const title = createBlock("title", { x: 0, y: 0 });
    const gameplay = createBlock("gameplay", { x: 50, y: 50 }) as GameplayBlock;

    gameplay.objects = [
      {
        id: "lock1",
        name: "Serrure",
        assetId: null,
        soundAssetId: null,
        x: 10, y: 10, width: 20, height: 20, zIndex: 1,
        visibleByDefault: true,
        objectType: "lock",
        grantItemId: null,
        linkedKeyId: "key_missing",
        lockInputMode: "scene_key",
        requiredItemId: null,
        consumeRequiredItem: false,
        targetBlockId: null,
        unlockEffect: "go_to_next",
        lockedMessage: "",
        successMessage: "",
        effects: [],
      },
    ];

    const issues = validateStoryBlocks([title, gameplay], title.id);

    expect(
      issues.some(
        (issue) =>
          issue.level === "error" &&
          issue.blockId === gameplay.id &&
          issue.message.includes("cle introuvable"),
      ),
    ).toBe(true);
  });

  it("warns when lock has no linked key", () => {
    const title = createBlock("title", { x: 0, y: 0 });
    const gameplay = createBlock("gameplay", { x: 50, y: 50 }) as GameplayBlock;

    gameplay.objects = [
      {
        id: "lock1",
        name: "Serrure",
        assetId: null,
        soundAssetId: null,
        x: 10, y: 10, width: 20, height: 20, zIndex: 1,
        visibleByDefault: true,
        objectType: "lock",
        grantItemId: null,
        linkedKeyId: null,
        lockInputMode: "scene_key",
        requiredItemId: null,
        consumeRequiredItem: false,
        targetBlockId: null,
        unlockEffect: "go_to_next",
        lockedMessage: "",
        successMessage: "",
        effects: [],
      },
    ];

    const issues = validateStoryBlocks([title, gameplay], title.id);

    expect(
      issues.some(
        (issue) =>
          issue.level === "warning" &&
          issue.blockId === gameplay.id &&
          issue.message.includes("aucune cle associee"),
      ),
    ).toBe(true);
  });

  it("warns when inventory lock has no required item", () => {
    const title = createBlock("title", { x: 0, y: 0 });
    const gameplay = createBlock("gameplay", { x: 50, y: 50 }) as GameplayBlock;

    gameplay.objects = [
      {
        id: "lock-inv-1",
        name: "Serrure inventaire",
        assetId: null,
        soundAssetId: null,
        x: 10, y: 10, width: 20, height: 20, zIndex: 1,
        visibleByDefault: true,
        objectType: "lock",
        grantItemId: null,
        linkedKeyId: null,
        lockInputMode: "inventory_item",
        requiredItemId: null,
        consumeRequiredItem: false,
        targetBlockId: null,
        unlockEffect: "go_to_next",
        lockedMessage: "",
        successMessage: "",
        effects: [],
      },
    ];

    const issues = validateStoryBlocks([title, gameplay], title.id);

    expect(
      issues.some(
        (issue) =>
          issue.level === "warning" &&
          issue.blockId === gameplay.id &&
          issue.message.includes("item d'inventaire"),
      ),
    ).toBe(true);
  });

  it("does not warn about missing key for inventory lock", () => {
    const title = createBlock("title", { x: 0, y: 0 });
    const gameplay = createBlock("gameplay", { x: 50, y: 50 }) as GameplayBlock;

    gameplay.objects = [
      {
        id: "lock-inv-2",
        name: "Serrure inventaire",
        assetId: null,
        soundAssetId: null,
        x: 10, y: 10, width: 20, height: 20, zIndex: 1,
        visibleByDefault: true,
        objectType: "lock",
        grantItemId: null,
        linkedKeyId: null,
        lockInputMode: "inventory_item",
        requiredItemId: "item-1",
        consumeRequiredItem: false,
        targetBlockId: null,
        unlockEffect: "go_to_next",
        lockedMessage: "",
        successMessage: "",
        effects: [],
      },
    ];

    const issues = validateStoryBlocks(
      [title, gameplay],
      title.id,
      [{ id: "item-1", name: "Cle USB", description: "", iconAssetId: null }],
    );

    expect(
      issues.some(
        (issue) =>
          issue.blockId === gameplay.id &&
          issue.message.includes("aucune cle associee"),
      ),
    ).toBe(false);
  });

  it("accepts inventory lock requiring a collectible fallback id", () => {
    const title = createBlock("title", { x: 0, y: 0 });
    const gameplayCollect = createBlock("gameplay", { x: 50, y: 50 }) as GameplayBlock;
    const gameplayLock = createBlock("gameplay", { x: 80, y: 80 }) as GameplayBlock;

    gameplayCollect.objects = [
      {
        id: "collect-1",
        name: "Badge",
        assetId: null,
        soundAssetId: null,
        x: 10, y: 10, width: 20, height: 20, zIndex: 1,
        visibleByDefault: true,
        objectType: "collectible",
        grantItemId: null,
        linkedKeyId: null,
        lockInputMode: "scene_key",
        requiredItemId: null,
        consumeRequiredItem: false,
        targetBlockId: null,
        unlockEffect: "go_to_next",
        lockedMessage: "",
        successMessage: "",
        effects: [],
      },
    ];

    gameplayLock.objects = [
      {
        id: "lock-inv-3",
        name: "Porte badge",
        assetId: null,
        soundAssetId: null,
        x: 10, y: 10, width: 20, height: 20, zIndex: 1,
        visibleByDefault: true,
        objectType: "lock",
        grantItemId: null,
        linkedKeyId: null,
        lockInputMode: "inventory_item",
        requiredItemId: "collect-1",
        consumeRequiredItem: false,
        targetBlockId: null,
        unlockEffect: "go_to_next",
        lockedMessage: "",
        successMessage: "",
        effects: [],
      },
    ];

    const issues = validateStoryBlocks([title, gameplayCollect, gameplayLock], title.id, []);

    expect(
      issues.some(
        (issue) =>
          issue.level === "error" &&
          issue.blockId === gameplayLock.id &&
          issue.message.includes("item introuvable"),
      ),
    ).toBe(false);
  });

  it("warns when key has no associated lock", () => {
    const title = createBlock("title", { x: 0, y: 0 });
    const gameplay = createBlock("gameplay", { x: 50, y: 50 }) as GameplayBlock;

    gameplay.objects = [
      {
        id: "key1",
        name: "Cle",
        assetId: null,
        soundAssetId: null,
        x: 10, y: 10, width: 20, height: 20, zIndex: 1,
        visibleByDefault: true,
        objectType: "key",
        grantItemId: null,
        linkedKeyId: null,
        lockInputMode: "scene_key",
        requiredItemId: null,
        consumeRequiredItem: false,
        targetBlockId: null,
        unlockEffect: "go_to_next",
        lockedMessage: "",
        successMessage: "",
        effects: [],
      },
    ];

    const issues = validateStoryBlocks([title, gameplay], title.id);

    expect(
      issues.some(
        (issue) =>
          issue.level === "warning" &&
          issue.blockId === gameplay.id &&
          issue.message.includes("aucune serrure"),
      ),
    ).toBe(true);
  });

  it("detects collectible granting missing items", () => {
    const title = createBlock("title", { x: 0, y: 0 });
    const gameplay = createBlock("gameplay", { x: 50, y: 50 }) as GameplayBlock;

    gameplay.objects = [
      {
        id: "obj1",
        name: "Objet 1",
        assetId: null,
        soundAssetId: null,
        x: 10, y: 10, width: 20, height: 20, zIndex: 1,
        visibleByDefault: true,
        objectType: "collectible",
        grantItemId: "item_missing",
        linkedKeyId: null,
        lockInputMode: "scene_key",
        requiredItemId: null,
        consumeRequiredItem: false,
        targetBlockId: null,
        unlockEffect: "go_to_next",
        lockedMessage: "",
        successMessage: "",
        effects: [],
      },
    ];

    const issues = validateStoryBlocks([title, gameplay], title.id, []);

    expect(
      issues.some(
        (issue) =>
          issue.level === "error" &&
          issue.blockId === gameplay.id &&
          issue.message.includes("item introuvable"),
      ),
    ).toBe(true);
  });

  it("includes lock branch targets in gameplay outgoing links", () => {
    const gameplay = createBlock("gameplay", { x: 50, y: 50 }) as GameplayBlock;
    gameplay.nextBlockId = "fallback-block";
    gameplay.objects = [
      {
        id: "lock-1",
        name: "Serrure A",
        assetId: null,
        soundAssetId: null,
        x: 20, y: 20, width: 12, height: 12, zIndex: 1,
        visibleByDefault: true,
        objectType: "lock",
        grantItemId: null,
        linkedKeyId: "key-1",
        lockInputMode: "scene_key",
        requiredItemId: null,
        consumeRequiredItem: false,
        targetBlockId: "success-block",
        unlockEffect: "go_to_next",
        lockedMessage: "",
        successMessage: "",
        effects: [],
      },
    ];

    const outgoing = getBlockOutgoingTargets(gameplay);

    expect(outgoing).toContain("fallback-block");
    expect(outgoing).toContain("success-block");
  });

  it("includes button sequence success/failure targets in gameplay outgoing links", () => {
    const gameplay = createBlock("gameplay", { x: 20, y: 20 }) as GameplayBlock;
    gameplay.objects = [
      {
        id: "btn-1",
        name: "Bouton 1",
        assetId: null,
        soundAssetId: null,
        x: 20, y: 20, width: 12, height: 12, zIndex: 1,
        visibleByDefault: true,
        objectType: "button",
        grantItemId: null,
        linkedKeyId: null,
        lockInputMode: "scene_key",
        requiredItemId: null,
        consumeRequiredItem: false,
        targetBlockId: null,
        unlockEffect: "go_to_next",
        lockedMessage: "",
        successMessage: "",
        effects: [],
      },
    ];
    gameplay.buttonSequence = ["btn-1"];
    gameplay.buttonSequenceSuccessBlockId = "code-ok";
    gameplay.buttonSequenceFailureBlockId = "code-ko";

    const outgoing = getBlockOutgoingTargets(gameplay);

    expect(outgoing).toContain("code-ok");
    expect(outgoing).toContain("code-ko");
  });

  it("reports an error when gameplay contains more than 5 buttons", () => {
    const title = createBlock("title", { x: 0, y: 0 });
    const gameplay = createBlock("gameplay", { x: 50, y: 50 }) as GameplayBlock;
    gameplay.objects = Array.from({ length: 11 }).map((_, index) => ({
      id: `btn-${index}`,
      name: `Bouton ${index + 1}`,
      assetId: null,
      soundAssetId: null,
      x: 10,
      y: 10,
      width: 10,
      height: 10,
      zIndex: 1,
      visibleByDefault: true,
      objectType: "button" as const,
      grantItemId: null,
      linkedKeyId: null,
      lockInputMode: "scene_key",
      requiredItemId: null,
      consumeRequiredItem: false,
      targetBlockId: null,
      unlockEffect: "go_to_next" as const,
      lockedMessage: "",
      successMessage: "",
      effects: [],
    }));

    const issues = validateStoryBlocks([title, gameplay], title.id);
    expect(
      issues.some(
        (issue) =>
          issue.level === "error" &&
          issue.blockId === gameplay.id &&
          issue.message.includes("5 boutons"),
      ),
    ).toBe(true);
  });

  it("normalizes gameplay lock targetBlockId to null when malformed", () => {
    const base = createBlock("gameplay", { x: 0, y: 0 }) as GameplayBlock;
    const malformed = {
      ...base,
      objects: [
        {
          id: "lock-1",
          name: "Serrure",
          assetId: null,
          soundAssetId: null,
          x: 10, y: 10, width: 12, height: 12, zIndex: 1,
          visibleByDefault: true,
          objectType: "lock",
          grantItemId: null,
          linkedKeyId: "key-1",
          lockInputMode: "scene_key",
          requiredItemId: null,
          consumeRequiredItem: false,
          targetBlockId: 123 as unknown as string,
          unlockEffect: "go_to_next",
          lockedMessage: "",
          successMessage: "",
          effects: [],
        },
      ],
    } as unknown as GameplayBlock;

    const normalized = normalizeGameplayBlock(malformed);

    expect(normalized.objects[0].targetBlockId).toBeNull();
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
    expect(block.lines[0].responses[0].affinityEffects).toEqual([]);
    expect(block.lines[0].conditions).toEqual([]);
    expect(block.lines[0].fallbackLineId).toBeNull();
    // sceneLayout defaults
    expect(block.sceneLayout).toEqual({
      background: { x: 0, y: 0, width: 100, height: 100 },
      character: { x: 25, y: 10, width: 50, height: 80 },
    });
    // characterLayers defaults
    expect(block.characterLayers).toEqual([]);
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
    expect(dBlock.lines[0].responses[0].affinityEffects).toEqual([]);
    expect(dBlock.lines[0].conditions).toEqual([]);
    expect(dBlock.lines[0].fallbackLineId).toBeNull();
    expect(dBlock.startLineId).toBe(dBlock.lines[0].id);
    // sceneLayout is auto-filled even on v1 migration
    expect(dBlock.sceneLayout).toEqual({
      background: { x: 0, y: 0, width: 100, height: 100 },
      character: { x: 25, y: 10, width: 50, height: 80 },
    });
    // characterLayers migrated (both null -> empty)
    expect(dBlock.characterLayers).toEqual([]);
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


