/**
 * Parite moteur: la preview du studio doit produire EXACTEMENT les memes
 * traces que le moteur du lecteur mobile (la reference) sur les scenarios
 * golden. Fixtures et goldens sont dupliques depuis
 * story-player-mobile/src/core/parity/ (voir README.md, regle de synchro).
 */

import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { deserializeBlockFromExport } from "../../components/author-studio-core";
import {
  PreviewAction,
  PreviewRuntimeState,
  PreviewStory,
  createInitialPreviewState,
  getPreviewBlock,
  reducePreview,
} from "../previewEngine";
import { StoryBlock, normalizeHeroProfile } from "../story";

const parityDir = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(parityDir, "fixtures");
const goldenDir = join(parityDir, "golden");

interface ParityFixture {
  name: string;
  description: string;
  story: {
    project: { startBlockId: string | null };
    variables: Array<{ id: string; name: string; initialValue: number }>;
    hero: unknown;
    blocks: Array<Record<string, unknown>>;
  };
  script: PreviewAction[];
}

interface ParitySnapshot {
  blockId: string | null;
  blockType: string | null;
  dialogueLineId: string | null;
  cinematicNarrationId: string | null;
  ended: boolean;
  variables: Record<string, number>;
  choiceHistory: Record<string, string>;
  inventory: Record<string, number>;
  npcAffinity: Record<string, number>;
  equippedInventoryItemId: string | null;
  interactedObjectIds: string[];
  objectVisibility: Record<string, boolean>;
  buttonSequenceInput: string[];
}

function sortedRecord<T>(input: Record<string, T>): Record<string, T> {
  const next: Record<string, T> = {};
  for (const key of Object.keys(input).sort()) {
    next[key] = input[key];
  }
  return next;
}

function snapshot(story: PreviewStory, state: PreviewRuntimeState): ParitySnapshot {
  const block = getPreviewBlock(story, state);
  return {
    blockId: state.currentBlockId,
    blockType: block?.type ?? null,
    dialogueLineId: state.currentDialogueLineId,
    cinematicNarrationId: state.currentCinematicNarrationId,
    ended: state.ended,
    variables: sortedRecord(state.variables),
    choiceHistory: sortedRecord(state.choiceHistory),
    inventory: sortedRecord(state.inventory),
    npcAffinity: sortedRecord(state.npcAffinity),
    equippedInventoryItemId: state.equippedInventoryItemId,
    interactedObjectIds: [...state.gameplayInteractedObjectIds].sort(),
    objectVisibility: sortedRecord(state.gameplayObjectVisibility),
    buttonSequenceInput: [...state.gameplayButtonSequenceInput],
  };
}

function buildPreviewStory(fixture: ParityFixture): PreviewStory {
  const blockById = new Map<string, StoryBlock>();
  for (const rawBlock of fixture.story.blocks) {
    const block = deserializeBlockFromExport(rawBlock, new Map());
    if (block) blockById.set(block.id, block);
  }

  return {
    startBlockId: fixture.story.project.startBlockId,
    variables: fixture.story.variables,
    hero: normalizeHeroProfile(fixture.story.hero),
    blockById,
  };
}

const fixtureFiles = readdirSync(fixturesDir).filter((file) => file.endsWith(".json"));

describe("parite moteur preview (contre la reference lecteur)", () => {
  it("au moins un scenario de parite existe", () => {
    expect(fixtureFiles.length).toBeGreaterThan(0);
  });

  for (const fixtureFile of fixtureFiles) {
    it(`scenario ${fixtureFile}`, () => {
      const fixture = JSON.parse(
        readFileSync(join(fixturesDir, fixtureFile), "utf8"),
      ) as ParityFixture;

      const story = buildPreviewStory(fixture);

      let state = createInitialPreviewState(story);
      const trace = {
        initial: snapshot(story, state),
        steps: [] as Array<{ action: PreviewAction; state: ParitySnapshot }>,
      };
      for (const action of fixture.script) {
        state = reducePreview(story, state, action);
        trace.steps.push({ action, state: snapshot(story, state) });
      }

      const goldenPath = join(goldenDir, fixtureFile.replace(/\.json$/, ".trace.json"));
      const golden = JSON.parse(readFileSync(goldenPath, "utf8"));
      expect(trace).toEqual(golden);
    });
  }
});
