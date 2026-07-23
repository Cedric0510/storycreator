import { describe, expect, it } from "vitest";

import {
  createBlock,
  createDefaultResponse,
  getBlockOutgoingTargets,
  normalizeGameplayBlock,
  normalizeStoryBlock,
  validateStoryBlocks,
  type CinematicBlock,
  type ChoiceBlock,
  type DialogueBlock,
  type GameplayBlock,
  type SwitchBlock,
} from "./story";

describe("story bust schema", () => {
  it("creates every scene block with the same bust defaults", () => {
    for (const type of ["cinematic", "dialogue", "choice", "gameplay"] as const) {
      const block = createBlock(type, { x: 0, y: 0 }) as
        | CinematicBlock
        | DialogueBlock
        | ChoiceBlock
        | GameplayBlock;
      expect(block.bust).toEqual({ assetId: null, side: "left", width: 38 });
    }
  });

  it("normalizes old scene blocks without a bust", () => {
    const block = createBlock("dialogue", { x: 0, y: 0 }) as DialogueBlock;
    delete block.bust;

    const normalized = normalizeStoryBlock(block) as DialogueBlock;
    expect(normalized.bust).toEqual({ assetId: null, side: "left", width: 38 });
  });
});

describe("story gameplay schema", () => {
  it("migrates overlapping legacy choice layouts without changing custom layouts", () => {
    const block = createBlock("choice", { x: 0, y: 0 }) as ChoiceBlock;
    block.choices = [
      { ...block.choices[0], id: "a", label: "A", layout: { x: 8, y: 22, width: 38, height: 68 } },
      { ...block.choices[1], id: "b", label: "B", layout: { x: 54, y: 22, width: 38, height: 68 } },
      { ...block.choices[0], id: "c", label: "C", layout: { x: 12, y: 61, width: 30, height: 25 } },
    ];

    const normalized = normalizeStoryBlock(block) as ChoiceBlock;
    expect(normalized.choices[0].layout).toEqual({ x: 8, y: 18, width: 38, height: 34 });
    expect(normalized.choices[1].layout).toEqual({ x: 54, y: 18, width: 38, height: 34 });
    expect(normalized.choices[2].layout).toEqual({ x: 12, y: 61, width: 30, height: 25 });
  });

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

  it("preserves the exported button sequence (buttons hors sequence = leurres)", () => {
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
    // btn-2 dedouble, id inconnu filtre; btn-1 et btn-3 restent des leurres
    // (le lecteur applique la sequence telle quelle: leurre presse = echec).
    gameplay.buttonSequence = ["btn-2", "btn-2", "btn-fantome"];

    const normalized = normalizeGameplayBlock(gameplay);

    expect(normalized.buttonSequence).toEqual(["btn-2"]);
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
    expect(block.displayMode).toBe("visual");
    expect(block.prompt).toBe("Que fais-tu ?");
    expect(block.backgroundAssetId).toBeNull();
    expect(block.sceneLayout).toEqual({
      background: { x: 0, y: 0, width: 100, height: 100 },
      character: { x: 25, y: 10, width: 50, height: 80 },
    });
    expect(block.characterLayers).toEqual([]);
    expect(block.voiceAssetId).toBeNull();
    expect(block.choices).toHaveLength(2);
    expect(block.choices[0].label).toBe("A");
    expect(block.choices[1].label).toBe("B");
    expect(block.choices[0].description).toBe("");
    expect(block.choices[0].imageAssetId).toBeNull();
    expect(block.choices[0].layout).toEqual({ x: 8, y: 18, width: 38, height: 34 });
    expect(block.choices[0].zIndex).toBe(2);
    expect(block.choices[0].effects).toEqual([]);
    expect(block.choices[0].heroMemoryVariableId).toBeNull();
    expect(block.choices[0].heroMemoryValue).toBe(1);
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

  it("normalizes legacy choice options without layout", () => {
    const raw = {
      id: "choice_legacy",
      type: "choice",
      name: "Choice",
      notes: "",
      position: { x: 0, y: 0 },
      entryEffects: [],
      chapterId: null,
      prompt: "Choix",
      backgroundAssetId: null,
      voiceAssetId: null,
      choices: [
        {
          id: "opt_a",
          label: "A",
          text: "Option A",
          description: "",
          imageAssetId: null,
          targetBlockId: null,
          effects: [],
        },
      ],
    };

    const normalized = normalizeStoryBlock(raw as unknown as ChoiceBlock) as ChoiceBlock;
    expect(normalized.displayMode).toBe("text");
    expect(normalized.sceneLayout).toEqual({
      background: { x: 0, y: 0, width: 100, height: 100 },
      character: { x: 25, y: 10, width: 50, height: 80 },
    });
    expect(normalized.choices[0].layout).toEqual({ x: 8, y: 18, width: 38, height: 34 });
    expect(normalized.choices[0].zIndex).toBe(2);
  });

  it("normalizes legacy choice with images to visual mode", () => {
    const raw = {
      id: "choice_legacy_visual",
      type: "choice",
      name: "Choice Visual",
      notes: "",
      position: { x: 0, y: 0 },
      entryEffects: [],
      chapterId: null,
      prompt: "Choix",
      backgroundAssetId: null,
      voiceAssetId: null,
      choices: [
        {
          id: "opt_a",
          label: "A",
          text: "Option A",
          description: "",
          imageAssetId: "asset_choice_img",
          targetBlockId: null,
          effects: [],
        },
      ],
    };

    const normalized = normalizeStoryBlock(raw as unknown as ChoiceBlock) as ChoiceBlock;
    expect(normalized.displayMode).toBe("visual");
  });

  it("preserves explicit choice display mode", () => {
    const raw = {
      id: "choice_explicit_mode",
      type: "choice",
      name: "Choice",
      notes: "",
      position: { x: 0, y: 0 },
      entryEffects: [],
      chapterId: null,
      displayMode: "text",
      prompt: "Choix",
      backgroundAssetId: null,
      voiceAssetId: null,
      choices: [
        {
          id: "opt_a",
          label: "A",
          text: "Option A",
          description: "",
          imageAssetId: "asset_choice_img",
          targetBlockId: null,
          effects: [],
        },
      ],
    };

    const normalized = normalizeStoryBlock(raw as unknown as ChoiceBlock) as ChoiceBlock;
    expect(normalized.displayMode).toBe("text");
  });
});

describe("story switch block", () => {
  it("creates switch block with defaults", () => {
    const block = createBlock("switch", { x: 0, y: 0 }) as SwitchBlock;

    expect(block.type).toBe("switch");
    expect(block.variableId).toBeNull();
    expect(block.cases).toHaveLength(1);
    expect(block.cases[0].logic).toBe("and");
    expect(block.cases[0].conditionType).toBe("choice");
    expect(block.cases[0].expectedValue).toBe(1);
    expect(block.cases[0].conditions).toHaveLength(1);
    expect(block.cases[0].conditions[0].type).toBe("choice");
    expect(block.cases[0].conditions[0].choiceBlockId).toBeNull();
    expect(block.cases[0].conditions[0].choiceOptionId).toBeNull();
    expect(block.cases[0].choiceConditions).toHaveLength(1);
    expect(block.cases[0].choiceConditions[0].choiceBlockId).toBeNull();
    expect(block.cases[0].choiceConditions[0].choiceOptionId).toBeNull();
    expect(block.cases[0].choiceBlockId).toBeNull();
    expect(block.cases[0].choiceOptionId).toBeNull();
    expect(block.cases[0].targetBlockId).toBeNull();
    expect(block.nextBlockId).toBeNull();
  });

  it("includes switch case and fallback targets in outgoing links", () => {
    const block = createBlock("switch", { x: 0, y: 0 }) as SwitchBlock;
    block.cases = [
      {
        id: "case-1",
        logic: "and",
        conditionType: "value",
        expectedValue: 1,
        conditions: [
          {
            id: "cond-1",
            type: "variable",
            variableId: "force",
            npcProfileBlockId: null,
            choiceBlockId: null,
            choiceOptionId: null,
            operator: "eq",
            expectedValue: 1,
          },
        ],
        choiceConditions: [],
        choiceBlockId: null,
        choiceOptionId: null,
        targetBlockId: "target-a",
      },
      {
        id: "case-2",
        logic: "and",
        conditionType: "value",
        expectedValue: 2,
        conditions: [
          {
            id: "cond-2",
            type: "variable",
            variableId: "force",
            npcProfileBlockId: null,
            choiceBlockId: null,
            choiceOptionId: null,
            operator: "eq",
            expectedValue: 2,
          },
        ],
        choiceConditions: [],
        choiceBlockId: null,
        choiceOptionId: null,
        targetBlockId: "target-b",
      },
    ];
    block.nextBlockId = "target-fallback";

    const outgoing = getBlockOutgoingTargets(block);

    expect(outgoing).toContain("target-a");
    expect(outgoing).toContain("target-b");
    expect(outgoing).toContain("target-fallback");
  });

  it("normalizes legacy switch cases to value mode", () => {
    const raw = {
      id: "switch_legacy",
      type: "switch",
      name: "Legacy",
      notes: "",
      position: { x: 0, y: 0 },
      entryEffects: [],
      chapterId: null,
      variableId: "var_1",
      cases: [
        {
          id: "case_1",
          expectedValue: 2,
          targetBlockId: "block_ok",
        },
      ],
      nextBlockId: "block_ko",
    };

    const normalized = normalizeStoryBlock(raw as unknown as SwitchBlock) as SwitchBlock;
    expect(normalized.cases[0].logic).toBe("and");
    expect(normalized.cases[0].conditionType).toBe("value");
    expect(normalized.cases[0].conditions).toHaveLength(1);
    expect(normalized.cases[0].conditions[0].type).toBe("variable");
    expect(normalized.cases[0].conditions[0].variableId).toBe("var_1");
    expect(normalized.cases[0].conditions[0].operator).toBe("gte");
    expect(normalized.cases[0].conditions[0].expectedValue).toBe(2);
    expect(normalized.cases[0].choiceConditions).toEqual([]);
    expect(normalized.cases[0].choiceBlockId).toBeNull();
    expect(normalized.cases[0].choiceOptionId).toBeNull();
  });

  it("migrates legacy single choice condition to choiceConditions array", () => {
    const raw = {
      id: "switch_choice_legacy",
      type: "switch",
      name: "Legacy Choice",
      notes: "",
      position: { x: 0, y: 0 },
      entryEffects: [],
      chapterId: null,
      variableId: null,
      cases: [
        {
          id: "case_legacy_choice",
          conditionType: "choice",
          expectedValue: 0,
          choiceBlockId: "choice_block_1",
          choiceOptionId: "choice_option_b",
          targetBlockId: "block_target",
        },
      ],
      nextBlockId: "block_else",
    };

    const normalized = normalizeStoryBlock(raw as unknown as SwitchBlock) as SwitchBlock;
    expect(normalized.cases[0].logic).toBe("and");
    expect(normalized.cases[0].conditions).toHaveLength(1);
    expect(normalized.cases[0].conditions[0].type).toBe("choice");
    expect(normalized.cases[0].conditions[0].choiceBlockId).toBe("choice_block_1");
    expect(normalized.cases[0].conditions[0].choiceOptionId).toBe("choice_option_b");
    expect(normalized.cases[0].choiceConditions).toHaveLength(1);
    expect(normalized.cases[0].choiceConditions[0].choiceBlockId).toBe("choice_block_1");
    expect(normalized.cases[0].choiceConditions[0].choiceOptionId).toBe("choice_option_b");
  });

  it("keeps mixed switch conditions normalized", () => {
    const normalized = normalizeStoryBlock({
      id: "switch_mixed",
      type: "switch",
      name: "Mixed",
      notes: "",
      position: { x: 0, y: 0 },
      entryEffects: [],
      chapterId: null,
      variableId: null,
      cases: [
        {
          id: "case_mixed",
          logic: "or",
          conditionType: "mixed",
          expectedValue: 0,
          conditions: [
            {
              id: "cond_force",
              type: "variable",
              variableId: "var_force",
              npcProfileBlockId: null,
              choiceBlockId: null,
              choiceOptionId: null,
              operator: "gte",
              expectedValue: 5,
            },
            {
              id: "cond_emma",
              type: "affinity",
              variableId: null,
              npcProfileBlockId: "npc_emma",
              choiceBlockId: null,
              choiceOptionId: null,
              operator: "gte",
              expectedValue: 20,
            },
          ],
          choiceConditions: [],
          choiceBlockId: null,
          choiceOptionId: null,
          targetBlockId: "target_ok",
        },
      ],
      nextBlockId: "target_else",
    } as unknown as SwitchBlock) as SwitchBlock;

    expect(normalized.cases[0].conditionType).toBe("mixed");
    expect(normalized.cases[0].logic).toBe("or");
    expect(normalized.cases[0].conditions).toHaveLength(2);
    expect(normalized.cases[0].conditions[0].operator).toBe("gte");
    expect(normalized.cases[0].conditions[1].type).toBe("affinity");
    expect(normalized.cases[0].conditions[1].operator).toBe("gte");
  });

  it("validates deleted variable and affinity references in switch conditions", () => {
    const title = createBlock("title", { x: 0, y: 0 });
    const choice = createBlock("choice", { x: 100, y: 0 }) as ChoiceBlock;
    const switchBlock = createBlock("switch", { x: 200, y: 0 }) as SwitchBlock;

    switchBlock.cases = [
      {
        id: "case_invalid",
        logic: "and",
        conditionType: "mixed",
        expectedValue: 0,
        conditions: [
          {
            id: "cond_var",
            type: "variable",
            variableId: "missing_var",
            npcProfileBlockId: null,
            choiceBlockId: null,
            choiceOptionId: null,
            operator: "gte",
            expectedValue: 5,
          },
          {
            id: "cond_aff",
            type: "affinity",
            variableId: null,
            npcProfileBlockId: "missing_npc",
            choiceBlockId: null,
            choiceOptionId: null,
            operator: "gte",
            expectedValue: 10,
          },
          {
            id: "cond_choice",
            type: "choice",
            variableId: null,
            npcProfileBlockId: null,
            choiceBlockId: choice.id,
            choiceOptionId: choice.choices[0].id,
            operator: "eq",
            expectedValue: 0,
          },
        ],
        choiceConditions: [],
        choiceBlockId: null,
        choiceOptionId: null,
        targetBlockId: null,
      },
    ];

    const issues = validateStoryBlocks(
      [title, choice, switchBlock],
      title.id,
      [],
      [{ id: "existing_var", name: "Force", initialValue: 0 }],
    );

    expect(issues.some((issue) => issue.message.includes("ressource supprimee"))).toBe(true);
    expect(issues.some((issue) => issue.message.includes("personnage supprime"))).toBe(true);
  });

  it("defaults legacy switch logic to and", () => {
    const normalized = normalizeStoryBlock({
      id: "switch_legacy_logic",
      type: "switch",
      name: "Legacy Logic",
      notes: "",
      position: { x: 0, y: 0 },
      entryEffects: [],
      chapterId: null,
      variableId: "var_1",
      cases: [
        {
          id: "case_legacy_logic",
          expectedValue: 3,
          targetBlockId: "target_ok",
        },
      ],
      nextBlockId: "target_else",
    } as unknown as SwitchBlock) as SwitchBlock;

    expect(normalized.cases[0].logic).toBe("and");
  });
});

describe("story dialogue block (multi-line)", () => {
  it("creates dialogue block with one default line and no response", () => {
    const block = createBlock("dialogue", { x: 0, y: 0 }) as DialogueBlock;

    expect(block.type).toBe("dialogue");
    expect(block.lines).toHaveLength(1);
    expect(block.startLineId).toBe(block.lines[0].id);
    expect(block.lines[0].speaker).toBe("Narrateur");
    expect(block.lines[0].text).toBe("");
    expect(block.lines[0].voiceAssetId).toBeNull();
    expect(block.lines[0].responses).toHaveLength(0);
    expect(block.lines[0].conditions).toEqual([]);
    expect(block.lines[0].fallbackLineId).toBeNull();
    expect(block.lines[0].continueTargetBlockId).toBeNull();
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
    expect(dBlock.lines[0].continueTargetBlockId).toBeNull();
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
    dialogue.lines[0].responses = [createDefaultResponse("A")];
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
    dialogue.lines[0].responses = [createDefaultResponse("A")];
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

describe("story cinematic block (multi-character)", () => {
  it("creates cinematic block with multi-character defaults", () => {
    const block = createBlock("cinematic", { x: 0, y: 0 }) as CinematicBlock;

    expect(block.type).toBe("cinematic");
    expect(block.narrations).toHaveLength(1);
    expect(block.startNarrationId).toBe(block.narrations[0]?.id);
    expect(block.heading).toBe(block.narrations[0]?.heading);
    expect(block.body).toBe(block.narrations[0]?.body);
    expect(block.narrations[0]?.continueTargetBlockId).toBeNull();
    expect(block.narrations[0]?.continueTargetNarrationId).toBeNull();
    expect(block.characterAssetId).toBeNull();
    expect(block.characterLayers).toEqual([]);
    expect(block.sceneLayout).toEqual({
      background: { x: 0, y: 0, width: 100, height: 100 },
      character: { x: 25, y: 10, width: 50, height: 80 },
    });
  });

  it("migrates legacy single character asset to one cinematic layer", () => {
    const rawLegacy = {
      id: "cin_1",
      type: "cinematic",
      name: "Intro",
      notes: "",
      position: { x: 0, y: 0 },
      entryEffects: [],
      chapterId: null,
      heading: "Intro",
      body: "",
      backgroundAssetId: null,
      characterAssetId: "asset_char_legacy",
      sceneLayout: {
        background: { x: 0, y: 0, width: 100, height: 100 },
        character: { x: 30, y: 12, width: 42, height: 76 },
      },
      videoAssetId: null,
      voiceAssetId: null,
      autoAdvanceSeconds: null,
      nextBlockId: null,
    };

    const normalized = normalizeStoryBlock(rawLegacy as unknown as CinematicBlock);
    const cinematic = normalized as CinematicBlock;

    expect(cinematic.narrations).toHaveLength(1);
    expect(cinematic.startNarrationId).toBe(cinematic.narrations[0]?.id);
    expect(cinematic.heading).toBe("Intro");
    expect(cinematic.body).toBe("");
    expect(cinematic.narrations[0]?.continueTargetBlockId).toBeNull();
    expect(cinematic.narrations[0]?.continueTargetNarrationId).toBeNull();
    expect(cinematic.characterAssetId).toBe("asset_char_legacy");
    expect(cinematic.characterLayers).toHaveLength(1);
    expect(cinematic.characterLayers[0].assetId).toBe("asset_char_legacy");
    expect(cinematic.characterLayers[0].layout).toEqual({
      x: 30,
      y: 12,
      width: 42,
      height: 76,
    });
  });

  it("keeps cinematic narrations and syncs legacy heading/body to the start narration", () => {
    const raw = {
      id: "cin_2",
      type: "cinematic",
      name: "Flashback",
      notes: "",
      position: { x: 0, y: 0 },
      entryEffects: [],
      chapterId: null,
      heading: "Ancien titre",
      body: "Ancien texte",
      narrations: [
        { id: "cnarr_1", heading: "Intro", body: "Premier ecran", continueTargetBlockId: null, continueTargetNarrationId: "cnarr_2" },
        { id: "cnarr_2", heading: "Suite", body: "Deuxieme ecran", continueTargetBlockId: "block_ext", continueTargetNarrationId: null },
      ],
      startNarrationId: "cnarr_1",
      backgroundAssetId: null,
      characterAssetId: null,
      sceneLayout: {
        background: { x: 0, y: 0, width: 100, height: 100 },
        character: { x: 25, y: 10, width: 50, height: 80 },
      },
      characterLayers: [],
      videoAssetId: null,
      voiceAssetId: null,
      autoAdvanceSeconds: null,
      nextBlockId: null,
    };

    const cinematic = normalizeStoryBlock(raw as unknown as CinematicBlock) as CinematicBlock;

    expect(cinematic.narrations).toHaveLength(2);
    expect(cinematic.startNarrationId).toBe("cnarr_1");
    expect(cinematic.heading).toBe("Intro");
    expect(cinematic.body).toBe("Premier ecran");
    expect(cinematic.narrations[1]?.heading).toBe("Suite");
    expect(cinematic.narrations[1]?.body).toBe("Deuxieme ecran");
    expect(cinematic.narrations[0]?.continueTargetNarrationId).toBe("cnarr_2");
    expect(cinematic.narrations[1]?.continueTargetBlockId).toBe("block_ext");
  });

  it("includes cinematic narration block targets in outgoing links", () => {
    const block = createBlock("cinematic", { x: 0, y: 0 }) as CinematicBlock;
    block.nextBlockId = "block_default";
    block.narrations = [
      {
        ...block.narrations[0],
        continueTargetBlockId: "block_alt",
        continueTargetNarrationId: null,
      },
    ];

    expect(getBlockOutgoingTargets(block)).toEqual(["block_alt", "block_default"]);
  });

  it("allows a cinematic narration to target a narration in another cinematic block", () => {
    const title = createBlock("title", { x: 0, y: 0 });
    const source = createBlock("cinematic", { x: 50, y: 50 }) as CinematicBlock;
    const target = createBlock("cinematic", { x: 100, y: 50 }) as CinematicBlock;

    source.narrations = [
      {
        ...source.narrations[0],
        body: "Source narration",
        continueTargetBlockId: target.id,
        continueTargetNarrationId: target.narrations[0].id,
      },
    ];
    target.narrations = [
      {
        ...target.narrations[0],
        body: "Target narration",
      },
    ];

    const issues = validateStoryBlocks([title, source, target], title.id);

    expect(
      issues.some(
        (issue) =>
          issue.level === "error" &&
          issue.blockId === source.id,
      ),
    ).toBe(false);
  });

  it("reports a cinematic narration target on a non-cinematic block", () => {
    const title = createBlock("title", { x: 0, y: 0 });
    const source = createBlock("cinematic", { x: 50, y: 50 }) as CinematicBlock;
    const target = createBlock("dialogue", { x: 100, y: 50 }) as DialogueBlock;

    source.narrations = [
      {
        ...source.narrations[0],
        body: "Source narration",
        continueTargetBlockId: target.id,
        continueTargetNarrationId: "fake_narration_id",
      },
    ];

    const issues = validateStoryBlocks([title, source, target], title.id);

    expect(
      issues.some(
        (issue) =>
          issue.level === "error" &&
          issue.blockId === source.id &&
          issue.message.includes("pas une cinematique"),
      ),
    ).toBe(true);
  });

  it("creates and normalizes part boundary blocks", () => {
    const start = createBlock("part_start", { x: 10, y: 20 });
    const end = createBlock("part_end", { x: 30, y: 40 });

    expect(start.type).toBe("part_start");
    if (start.type !== "part_start") throw new Error("part_start attendu");
    expect(start.partId).toBeNull();
    expect(start.chapterId).toBeNull();
    expect(getBlockOutgoingTargets({ ...start, nextBlockId: end.id })).toEqual([end.id]);
    expect(normalizeStoryBlock(end)).toMatchObject({
      type: "part_end",
      partId: null,
      chapterId: null,
    });
  });
});


