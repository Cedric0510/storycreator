export const STORY_SCHEMA_VERSION = "1.2.0";

export type BlockType =
  | "title"
  | "cinematic"
  | "dialogue"
  | "choice"
  | "gameplay"
  | "hero_profile"
  | "npc_profile";
export type ChoiceLabel = "A" | "B" | "C" | "D";
export type GameplayMode = "point_and_click" | "map_move" | "static_scene";
export type MemberRole = "owner" | "editor" | "viewer";
export type GameplayHotspotClickActionType =
  | "message"
  | "add_item"
  | "disable_hotspot"
  | "go_to_block";

export interface XYPosition {
  x: number;
  y: number;
}

export interface VariableDefinition {
  id: string;
  name: string;
  initialValue: number;
}

export interface VariableEffect {
  variableId: string;
  delta: number;
}

export interface StoryItemDefinition {
  id: string;
  name: string;
  description: string;
  iconAssetId: string | null;
}

export interface HeroBaseStat {
  id: string;
  variableId: string;
  value: number;
}

export interface HeroNpcDefinition {
  id: string;
  name: string;
  lore: string;
  baseFriendship: number;
}

export interface HeroInventoryEntry {
  id: string;
  itemId: string;
  quantity: number;
}

export interface HeroProfile {
  name: string;
  lore: string;
  baseStats: HeroBaseStat[];
  npcs: HeroNpcDefinition[];
  startingInventory: HeroInventoryEntry[];
}

export interface GameplayRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface GameplayOverlay extends GameplayRect {
  id: string;
  name: string;
  assetId: string | null;
  zIndex: number;
  visibleByDefault: boolean;
}

interface GameplayHotspotClickActionBase {
  id: string;
  type: GameplayHotspotClickActionType;
}

export interface GameplayHotspotMessageAction
  extends GameplayHotspotClickActionBase {
  type: "message";
  message: string;
}

export interface GameplayHotspotAddItemAction
  extends GameplayHotspotClickActionBase {
  type: "add_item";
  itemId: string | null;
  quantity: number;
}

export interface GameplayHotspotDisableHotspotAction
  extends GameplayHotspotClickActionBase {
  type: "disable_hotspot";
  targetHotspotId: string | null;
}

export interface GameplayHotspotGoToBlockAction
  extends GameplayHotspotClickActionBase {
  type: "go_to_block";
  targetBlockId: string | null;
}

export type GameplayHotspotClickAction =
  | GameplayHotspotMessageAction
  | GameplayHotspotAddItemAction
  | GameplayHotspotDisableHotspotAction
  | GameplayHotspotGoToBlockAction;

export interface GameplayHotspot extends GameplayRect {
  id: string;
  name: string;
  required: boolean;
  message: string;
  toggleOverlayId: string | null;
  soundAssetId: string | null;
  effects: VariableEffect[];
  onClickActions: GameplayHotspotClickAction[];
}

export interface GameplayCompletionRule {
  type: "all_required" | "required_count";
  requiredCount: number;
}

export interface AssetRef {
  id: string;
  fileName: string;
  mimeType: string;
  size: number;
  packagePath: string;
  uploadedAt: string;
  storageBucket?: string | null;
  storagePath?: string | null;
}

interface BaseBlock {
  id: string;
  type: BlockType;
  name: string;
  notes: string;
  position: XYPosition;
  entryEffects: VariableEffect[];
}

export interface TitleBlock extends BaseBlock {
  type: "title";
  storyTitle: string;
  subtitle: string;
  backgroundAssetId: string | null;
  buttonStyle: {
    backgroundColor: string;
    textColor: string;
    borderColor: string;
    radius: number;
    fontSize: number;
  };
  nextBlockId: string | null;
}

export interface CinematicBlock extends BaseBlock {
  type: "cinematic";
  heading: string;
  body: string;
  backgroundAssetId: string | null;
  videoAssetId: string | null;
  voiceAssetId: string | null;
  autoAdvanceSeconds: number | null;
  nextBlockId: string | null;
}

export interface DialogueResponse {
  id: string;
  label: ChoiceLabel;
  text: string;
  targetLineId: string | null;
  targetBlockId: string | null;
  effects: VariableEffect[];
}

export interface DialogueLine {
  id: string;
  speaker: string;
  text: string;
  voiceAssetId: string | null;
  responses: DialogueResponse[];
}

/** Position + size of a single layer in the scene composer (% based, 0-100). */
export interface SceneLayerLayout {
  x: number;       // left offset in % of scene width
  y: number;       // top offset in % of scene height
  width: number;   // width in % of scene width
  height: number;  // height in % of scene height
}

/** Persisted scene composition for a dialogue block. */
export interface SceneLayout {
  background: SceneLayerLayout;
  character: SceneLayerLayout;
}

export const DEFAULT_SCENE_LAYOUT: SceneLayout = {
  background: { x: 0, y: 0, width: 100, height: 100 },
  character:  { x: 25, y: 10, width: 50, height: 80 },
};

export interface DialogueBlock extends BaseBlock {
  type: "dialogue";
  backgroundAssetId: string | null;
  characterAssetId: string | null;
  npcProfileBlockId: string | null;
  npcImageAssetId: string | null;
  sceneLayout: SceneLayout;
  lines: DialogueLine[];
  startLineId: string;
}

export interface GameplayBlock extends BaseBlock {
  type: "gameplay";
  mode: GameplayMode;
  objective: string;
  backgroundAssetId: string | null;
  voiceAssetId: string | null;
  overlays: GameplayOverlay[];
  hotspots: GameplayHotspot[];
  completionRule: GameplayCompletionRule;
  completionEffects: VariableEffect[];
  nextBlockId: string | null;
}

export interface HeroProfileBlock extends BaseBlock {
  type: "hero_profile";
  nextBlockId: string | null;
}

export interface NpcProfileBlock extends BaseBlock {
  type: "npc_profile";
  npcName: string;
  npcLore: string;
  imageAssetIds: string[];
  defaultImageAssetId: string | null;
  nextBlockId: string | null;
}

export interface ChoiceOption {
  id: string;
  label: ChoiceLabel;
  text: string;
  description: string;
  imageAssetId: string | null;
  targetBlockId: string | null;
  effects: VariableEffect[];
}

export interface ChoiceBlock extends BaseBlock {
  type: "choice";
  prompt: string;
  backgroundAssetId: string | null;
  voiceAssetId: string | null;
  choices: ChoiceOption[];
}

export type StoryBlock =
  | TitleBlock
  | CinematicBlock
  | DialogueBlock
  | ChoiceBlock
  | GameplayBlock
  | HeroProfileBlock
  | NpcProfileBlock;

export interface Member {
  id: string;
  name: string;
  role: MemberRole;
}

export interface AuditLogEntry {
  id: string;
  memberId: string;
  timestamp: string;
  action: string;
  details: string;
}

export interface ProjectInfo {
  id: string;
  title: string;
  slug: string;
  synopsis: string;
  startBlockId: string | null;
  schemaVersion: string;
  updatedAt: string;
}

export interface ProjectMeta {
  info: ProjectInfo;
  variables: VariableDefinition[];
  items: StoryItemDefinition[];
  hero: HeroProfile;
  members: Member[];
  activeMemberId: string;
  editingLockMemberId: string | null;
  logs: AuditLogEntry[];
}

export interface ValidationIssue {
  level: "error" | "warning";
  message: string;
  blockId?: string;
}

export const BLOCK_LABELS: Record<BlockType, string> = {
  title: "Ecran titre",
  cinematic: "Cinematique",
  dialogue: "Dialogue",
  choice: "Choix",
  gameplay: "Gameplay",
  hero_profile: "Fiche Hero",
  npc_profile: "Fiche PNJ",
};

export const CHOICE_LABELS: ChoiceLabel[] = ["A", "B", "C", "D"];

function randomFragment() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID().split("-")[0];
  }

  return Math.random().toString(36).slice(2, 10);
}

export function createId(prefix: string) {
  return `${prefix}_${randomFragment()}`;
}

export function createDefaultHeroProfile(): HeroProfile {
  return {
    name: "Hero",
    lore: "",
    baseStats: [],
    npcs: [],
    startingInventory: [],
  };
}

export function normalizeHeroProfile(hero: unknown): HeroProfile {
  const fallback = createDefaultHeroProfile();
  if (!hero || typeof hero !== "object") return fallback;

  const candidate = hero as Partial<HeroProfile>;
  const baseStats = Array.isArray(candidate.baseStats)
    ? candidate.baseStats.map((stat) => ({
        id: typeof stat?.id === "string" && stat.id ? stat.id : createId("hero_stat"),
        variableId: typeof stat?.variableId === "string" ? stat.variableId : "",
        value: Number.isFinite(stat?.value) ? stat.value : 0,
      }))
    : [];

  const npcs = Array.isArray(candidate.npcs)
    ? candidate.npcs.map((npc) => ({
        id: typeof npc?.id === "string" && npc.id ? npc.id : createId("npc"),
        name: typeof npc?.name === "string" ? npc.name : "",
        lore: typeof npc?.lore === "string" ? npc.lore : "",
        baseFriendship: Number.isFinite(npc?.baseFriendship) ? npc.baseFriendship : 0,
      }))
    : [];

  const startingInventory = Array.isArray(candidate.startingInventory)
    ? candidate.startingInventory.map((entry) => ({
        id: typeof entry?.id === "string" && entry.id ? entry.id : createId("hero_item"),
        itemId: typeof entry?.itemId === "string" ? entry.itemId : "",
        quantity:
          Number.isFinite(entry?.quantity) && (entry?.quantity ?? 0) > 0
            ? Math.floor(entry.quantity)
            : 1,
      }))
    : [];

  return {
    name: typeof candidate.name === "string" ? candidate.name : fallback.name,
    lore: typeof candidate.lore === "string" ? candidate.lore : fallback.lore,
    baseStats,
    npcs,
    startingInventory,
  };
}

export function createDefaultResponse(label: ChoiceLabel): DialogueResponse {
  return {
    id: createId("resp"),
    label,
    text: "",
    targetLineId: null,
    targetBlockId: null,
    effects: [],
  };
}

export function createDefaultLine(speaker?: string): DialogueLine {
  const id = createId("dline");
  return {
    id,
    speaker: speaker ?? "Narrateur",
    text: "",
    voiceAssetId: null,
    responses: [createDefaultResponse("A"), createDefaultResponse("B")],
  };
}

function createDefaultChoiceOption(label: ChoiceLabel): ChoiceOption {
  return {
    id: createId("option"),
    label,
    text: "",
    description: "",
    imageAssetId: null,
    targetBlockId: null,
    effects: [],
  };
}

function defaultGameplayOverlay(): GameplayOverlay {
  return {
    id: createId("overlay"),
    name: "Objet",
    assetId: null,
    x: 35,
    y: 35,
    width: 20,
    height: 20,
    zIndex: 2,
    visibleByDefault: true,
  };
}

function defaultGameplayHotspot(): GameplayHotspot {
  return {
    id: createId("hotspot"),
    name: "Zone cliquable",
    required: true,
    message: "",
    toggleOverlayId: null,
    soundAssetId: null,
    effects: [],
    onClickActions: [],
    x: 35,
    y: 35,
    width: 20,
    height: 20,
  };
}

export function createGameplayHotspotClickAction(
  type: GameplayHotspotClickActionType = "message",
): GameplayHotspotClickAction {
  if (type === "add_item") {
    return {
      id: createId("action"),
      type,
      itemId: null,
      quantity: 1,
    };
  }

  if (type === "disable_hotspot") {
    return {
      id: createId("action"),
      type,
      targetHotspotId: null,
    };
  }

  if (type === "go_to_block") {
    return {
      id: createId("action"),
      type,
      targetBlockId: null,
    };
  }

  return {
    id: createId("action"),
    type: "message",
    message: "",
  };
}

function normalizeHotspotAction(action: unknown): GameplayHotspotClickAction | null {
  if (!action || typeof action !== "object") return null;
  const candidate = action as Partial<GameplayHotspotClickAction>;
  const id = typeof candidate.id === "string" && candidate.id ? candidate.id : createId("action");

  if (candidate.type === "message") {
    return {
      id,
      type: "message",
      message: typeof candidate.message === "string" ? candidate.message : "",
    };
  }

  if (candidate.type === "add_item") {
    const rawQuantity = candidate.quantity;
    const quantity =
      typeof rawQuantity === "number" && Number.isFinite(rawQuantity) && rawQuantity > 0
        ? Math.floor(rawQuantity)
        : 1;
    return {
      id,
      type: "add_item",
      itemId: typeof candidate.itemId === "string" && candidate.itemId ? candidate.itemId : null,
      quantity,
    };
  }

  if (candidate.type === "disable_hotspot") {
    return {
      id,
      type: "disable_hotspot",
      targetHotspotId:
        typeof candidate.targetHotspotId === "string" && candidate.targetHotspotId
          ? candidate.targetHotspotId
          : null,
    };
  }

  if (candidate.type === "go_to_block") {
    return {
      id,
      type: "go_to_block",
      targetBlockId:
        typeof candidate.targetBlockId === "string" && candidate.targetBlockId
          ? candidate.targetBlockId
          : null,
    };
  }

  return null;
}

function normalizeVariableEffects(effects: unknown): VariableEffect[] {
  if (!Array.isArray(effects)) return [];
  return effects.map((effect) => ({
    variableId: typeof effect?.variableId === "string" ? effect.variableId : "",
    delta: Number.isFinite(effect?.delta) ? effect.delta : 0,
  }));
}

function normalizeLayerLayout(raw: unknown, defaults: SceneLayerLayout): SceneLayerLayout {
  const obj = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
  return {
    x: typeof obj.x === "number" && Number.isFinite(obj.x) ? obj.x : defaults.x,
    y: typeof obj.y === "number" && Number.isFinite(obj.y) ? obj.y : defaults.y,
    width: typeof obj.width === "number" && Number.isFinite(obj.width) ? obj.width : defaults.width,
    height: typeof obj.height === "number" && Number.isFinite(obj.height) ? obj.height : defaults.height,
  };
}

function normalizeSceneLayout(raw: unknown): SceneLayout {
  const obj = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
  return {
    background: normalizeLayerLayout(obj.background, DEFAULT_SCENE_LAYOUT.background),
    character: normalizeLayerLayout(obj.character, DEFAULT_SCENE_LAYOUT.character),
  };
}

export function createBlock(type: BlockType, position: XYPosition): StoryBlock {
  const id = createId(type);

  if (type === "title") {
    return {
      id,
      type,
      name: "Ecran titre",
      notes: "",
      position,
      entryEffects: [],
      storyTitle: "Titre de l'histoire",
      subtitle: "",
      backgroundAssetId: null,
      buttonStyle: {
        backgroundColor: "#2563eb",
        textColor: "#f8fafc",
        borderColor: "#1d4ed8",
        radius: 14,
        fontSize: 16,
      },
      nextBlockId: null,
    };
  }

  if (type === "cinematic") {
    return {
      id,
      type,
      name: "Intro",
      notes: "",
      position,
      entryEffects: [],
      heading: "Cinematique",
      body: "",
      backgroundAssetId: null,
      videoAssetId: null,
      voiceAssetId: null,
      autoAdvanceSeconds: null,
      nextBlockId: null,
    };
  }

  if (type === "dialogue") {
    const firstLine = createDefaultLine();
    return {
      id,
      type,
      name: "Dialogue",
      notes: "",
      position,
      entryEffects: [],
      backgroundAssetId: null,
      characterAssetId: null,
      npcProfileBlockId: null,
      npcImageAssetId: null,
      sceneLayout: { ...DEFAULT_SCENE_LAYOUT },
      lines: [firstLine],
      startLineId: firstLine.id,
    };
  }

  if (type === "choice") {
    return {
      id,
      type,
      name: "Choix",
      notes: "",
      position,
      entryEffects: [],
      prompt: "Que fais-tu ?",
      backgroundAssetId: null,
      voiceAssetId: null,
      choices: [createDefaultChoiceOption("A"), createDefaultChoiceOption("B")],
    };
  }

  if (type === "hero_profile") {
    return {
      id,
      type,
      name: "Fiche Hero",
      notes: "",
      position,
      entryEffects: [],
      nextBlockId: null,
    };
  }

  if (type === "npc_profile") {
    return {
      id,
      type,
      name: "Fiche PNJ",
      notes: "",
      position,
      entryEffects: [],
      npcName: "PNJ",
      npcLore: "",
      imageAssetIds: [],
      defaultImageAssetId: null,
      nextBlockId: null,
    };
  }

  return {
    id,
    type,
    name: "Gameplay",
    notes: "",
    position,
    entryEffects: [],
    mode: "point_and_click",
    objective: "",
    backgroundAssetId: null,
    voiceAssetId: null,
    overlays: [defaultGameplayOverlay()],
    hotspots: [defaultGameplayHotspot()],
    completionRule: {
      type: "all_required",
      requiredCount: 1,
    },
    completionEffects: [],
    nextBlockId: null,
  };
}

export function normalizeGameplayBlock(block: GameplayBlock): GameplayBlock {
  return {
    ...block,
    entryEffects: normalizeVariableEffects((block as { entryEffects?: unknown }).entryEffects),
    mode: "point_and_click",
    objective: block.objective ?? "",
    backgroundAssetId: block.backgroundAssetId ?? null,
    voiceAssetId: block.voiceAssetId ?? null,
    overlays: Array.isArray(block.overlays)
      ? block.overlays.map((overlay) => ({
          id: overlay.id ?? createId("overlay"),
          name: overlay.name ?? "Objet",
          assetId: overlay.assetId ?? null,
          x: Number.isFinite(overlay.x) ? overlay.x : 35,
          y: Number.isFinite(overlay.y) ? overlay.y : 35,
          width: Number.isFinite(overlay.width) ? overlay.width : 20,
          height: Number.isFinite(overlay.height) ? overlay.height : 20,
          zIndex: Number.isFinite(overlay.zIndex) ? overlay.zIndex : 2,
          visibleByDefault:
            typeof overlay.visibleByDefault === "boolean" ? overlay.visibleByDefault : true,
        }))
      : [],
    hotspots: Array.isArray(block.hotspots)
      ? block.hotspots.map((hotspot) => ({
          id: hotspot.id ?? createId("hotspot"),
          name: hotspot.name ?? "Zone cliquable",
          required: typeof hotspot.required === "boolean" ? hotspot.required : true,
          message: hotspot.message ?? "",
          toggleOverlayId: hotspot.toggleOverlayId ?? null,
          soundAssetId: hotspot.soundAssetId ?? null,
          effects: normalizeVariableEffects(hotspot.effects),
          onClickActions: Array.isArray(hotspot.onClickActions)
            ? hotspot.onClickActions
                .map((action) => normalizeHotspotAction(action))
                .filter((action): action is GameplayHotspotClickAction => Boolean(action))
            : [],
          x: Number.isFinite(hotspot.x) ? hotspot.x : 35,
          y: Number.isFinite(hotspot.y) ? hotspot.y : 35,
          width: Number.isFinite(hotspot.width) ? hotspot.width : 20,
          height: Number.isFinite(hotspot.height) ? hotspot.height : 20,
        }))
      : [],
    completionRule: block.completionRule
      ? {
          type:
            block.completionRule.type === "required_count"
              ? "required_count"
              : "all_required",
          requiredCount:
            Number.isFinite(block.completionRule.requiredCount) &&
            block.completionRule.requiredCount > 0
              ? Math.floor(block.completionRule.requiredCount)
              : 1,
        }
      : {
          type: "all_required",
          requiredCount: 1,
        },
    completionEffects: normalizeVariableEffects(block.completionEffects),
    nextBlockId: block.nextBlockId ?? null,
  };
}

export function normalizeStoryBlock(block: StoryBlock): StoryBlock {
  if (block.type === "gameplay") {
    return normalizeGameplayBlock(block);
  }

  if (block.type === "dialogue") {
    const raw = block as unknown as Record<string, unknown>;

    // --- Migration from v1 (single speaker/line/choices) to v2 (lines[]) ---
    if (!Array.isArray(raw.lines) && Array.isArray(raw.choices)) {
      const oldSpeaker = typeof raw.speaker === "string" ? raw.speaker : "Narrateur";
      const oldText = typeof raw.line === "string" ? raw.line : "";
      const oldVoice = typeof raw.voiceAssetId === "string" && raw.voiceAssetId ? raw.voiceAssetId as string : null;
      const oldChoices = raw.choices as Array<Record<string, unknown>>;
      const lineId = createId("dline");

      const migratedResponses: DialogueResponse[] = oldChoices.map((choice) => ({
        id: typeof choice.id === "string" ? choice.id : createId("resp"),
        label: (typeof choice.label === "string" ? choice.label : "A") as ChoiceLabel,
        text: typeof choice.text === "string" ? choice.text : "",
        targetLineId: null,
        targetBlockId: typeof choice.targetBlockId === "string" ? choice.targetBlockId : null,
        effects: normalizeVariableEffects(choice.effects),
      }));

      return {
        ...block,
        entryEffects: normalizeVariableEffects(raw.entryEffects),
        npcProfileBlockId:
          typeof raw.npcProfileBlockId === "string" && raw.npcProfileBlockId
            ? raw.npcProfileBlockId as string
            : null,
        npcImageAssetId:
          typeof raw.npcImageAssetId === "string" && raw.npcImageAssetId
            ? raw.npcImageAssetId as string
            : null,
        sceneLayout: normalizeSceneLayout(raw.sceneLayout),
        lines: [{
          id: lineId,
          speaker: oldSpeaker,
          text: oldText,
          voiceAssetId: oldVoice,
          responses: migratedResponses,
        }],
        startLineId: lineId,
      } as DialogueBlock;
    }

    // --- Normal v2 normalization ---
    return {
      ...block,
      entryEffects: normalizeVariableEffects(raw.entryEffects),
      npcProfileBlockId:
        typeof raw.npcProfileBlockId === "string" && raw.npcProfileBlockId
          ? raw.npcProfileBlockId as string
          : null,
      npcImageAssetId:
        typeof raw.npcImageAssetId === "string" && raw.npcImageAssetId
          ? raw.npcImageAssetId as string
          : null,
      sceneLayout: normalizeSceneLayout(raw.sceneLayout),
      lines: Array.isArray(block.lines)
        ? block.lines.map((line) => ({
            ...line,
            speaker: line.speaker ?? "Narrateur",
            text: line.text ?? "",
            voiceAssetId: line.voiceAssetId ?? null,
            responses: Array.isArray(line.responses)
              ? line.responses.map((resp) => ({
                  ...resp,
                  targetLineId: resp.targetLineId ?? null,
                  targetBlockId: resp.targetBlockId ?? null,
                  effects: normalizeVariableEffects(resp.effects),
                }))
              : [],
          }))
        : [],
      startLineId: block.startLineId ?? (Array.isArray(block.lines) && block.lines.length > 0 ? block.lines[0].id : ""),
    };
  }

  if (block.type === "choice") {
    return {
      ...block,
      entryEffects: normalizeVariableEffects((block as { entryEffects?: unknown }).entryEffects),
      prompt: block.prompt ?? "",
      backgroundAssetId: block.backgroundAssetId ?? null,
      voiceAssetId: block.voiceAssetId ?? null,
      choices: Array.isArray(block.choices)
        ? block.choices.map((option) => ({
            ...option,
            description: option.description ?? "",
            imageAssetId: option.imageAssetId ?? null,
            effects: normalizeVariableEffects(option.effects),
          }))
        : [],
    };
  }

  if (block.type === "hero_profile") {
    return {
      ...block,
      entryEffects: normalizeVariableEffects((block as { entryEffects?: unknown }).entryEffects),
      nextBlockId: block.nextBlockId ?? null,
    };
  }

  if (block.type === "npc_profile") {
    const imageAssetIds = Array.isArray(block.imageAssetIds)
      ? block.imageAssetIds.filter((assetId): assetId is string => Boolean(assetId))
      : [];
    const defaultImageAssetId =
      typeof block.defaultImageAssetId === "string" && imageAssetIds.includes(block.defaultImageAssetId)
        ? block.defaultImageAssetId
        : imageAssetIds[0] ?? null;

    return {
      ...block,
      entryEffects: normalizeVariableEffects((block as { entryEffects?: unknown }).entryEffects),
      npcName: block.npcName ?? "",
      npcLore: block.npcLore ?? "",
      imageAssetIds,
      defaultImageAssetId,
      nextBlockId: block.nextBlockId ?? null,
    };
  }

  return {
    ...block,
    entryEffects: normalizeVariableEffects((block as { entryEffects?: unknown }).entryEffects),
  };
}

export function getBlockOutgoingTargets(block: StoryBlock) {
  if (block.type === "hero_profile" || block.type === "npc_profile") {
    return [];
  }

  if (block.type === "dialogue") {
    return block.lines
      .flatMap((line) => line.responses)
      .map((resp) => resp.targetBlockId)
      .filter((targetId): targetId is string => Boolean(targetId));
  }

  if (block.type === "choice") {
    return block.choices
      .map((choice) => choice.targetBlockId)
      .filter((targetId): targetId is string => Boolean(targetId));
  }

  if (block.type === "gameplay") {
    const targets = new Set<string>();
    if (block.nextBlockId) {
      targets.add(block.nextBlockId);
    }
    for (const hotspot of block.hotspots) {
      for (const action of hotspot.onClickActions) {
        if (action.type === "go_to_block" && action.targetBlockId) {
          targets.add(action.targetBlockId);
        }
      }
    }
    return Array.from(targets);
  }

  return block.nextBlockId ? [block.nextBlockId] : [];
}

export function sanitizeFileName(fileName: string) {
  const cleaned = fileName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9.\-_]+/g, "-")
    .replace(/-+/g, "-");

  return cleaned || "asset.bin";
}

export function blockTypeColor(type: BlockType) {
  if (type === "title") return "#f97316";
  if (type === "cinematic") return "#0891b2";
  if (type === "dialogue") return "#16a34a";
  if (type === "choice") return "#a855f7";
  if (type === "hero_profile") return "#f59e0b";
  if (type === "npc_profile") return "#0ea5e9";
  return "#7c3aed";
}

function collectReachableIds(
  blockById: Map<string, StoryBlock>,
  startBlockId: string,
  visited: Set<string>,
) {
  const stack = [startBlockId];

  while (stack.length > 0) {
    const blockId = stack.pop();

    if (!blockId || visited.has(blockId)) continue;

    visited.add(blockId);

    const block = blockById.get(blockId);
    if (!block) continue;

    const targets = getBlockOutgoingTargets(block);
    for (const target of targets) {
      if (!visited.has(target)) {
        stack.push(target);
      }
    }
  }
}

export function validateStoryBlocks(
  blocks: StoryBlock[],
  startBlockId: string | null,
  items: StoryItemDefinition[] = [],
) {
  const issues: ValidationIssue[] = [];
  const blockById = new Map(blocks.map((block) => [block.id, block]));
  const itemIds = new Set(items.map((item) => item.id));
  const titleCount = blocks.filter((block) => block.type === "title").length;

  if (titleCount === 0) {
    issues.push({
      level: "error",
      message: "Ajoutez au moins un bloc Ecran titre.",
    });
  }

  if (!startBlockId) {
    issues.push({
      level: "error",
      message: "Definissez un bloc de depart.",
    });
  } else if (!blockById.has(startBlockId)) {
    issues.push({
      level: "error",
      message: "Le bloc de depart est introuvable.",
      blockId: startBlockId,
    });
  } else {
    const startBlock = blockById.get(startBlockId);
    if (startBlock?.type === "hero_profile" || startBlock?.type === "npc_profile") {
      issues.push({
        level: "warning",
        message: "Le bloc de depart devrait etre un bloc narratif (titre/cinematique/dialogue/gameplay).",
        blockId: startBlockId,
      });
    }
  }

  for (const block of blocks) {
    if (block.type === "dialogue") {
      if (block.lines.length === 0) {
        issues.push({
          level: "error",
          message: "Ce dialogue ne contient aucune ligne.",
          blockId: block.id,
        });
      }

      const lineIds = new Set(block.lines.map((line) => line.id));

      for (const line of block.lines) {
        if (!line.text.trim()) {
          issues.push({
            level: "warning",
            message: `La ligne "${line.speaker || "?"}" a un texte vide.`,
            blockId: block.id,
          });
        }

        if (line.responses.length === 0) {
          issues.push({
            level: "warning",
            message: `La ligne "${line.speaker || "?"}" n a aucune reponse.`,
            blockId: block.id,
          });
        }

        for (const resp of line.responses) {
          if (!resp.text.trim()) {
            issues.push({
              level: "warning",
              message: `Reponse ${resp.label} de "${line.speaker || "?"}" est vide.`,
              blockId: block.id,
            });
          }

          if (resp.targetBlockId && !blockById.has(resp.targetBlockId)) {
            issues.push({
              level: "error",
              message: `Reponse ${resp.label} de "${line.speaker || "?"}" pointe vers un bloc supprime.`,
              blockId: block.id,
            });
          }

          if (resp.targetLineId && !lineIds.has(resp.targetLineId)) {
            issues.push({
              level: "error",
              message: `Reponse ${resp.label} de "${line.speaker || "?"}" pointe vers une ligne supprimee.`,
              blockId: block.id,
            });
          }
        }
      }

      if (block.npcProfileBlockId) {
        const npcBlock = blockById.get(block.npcProfileBlockId);
        if (!npcBlock || npcBlock.type !== "npc_profile") {
          issues.push({
            level: "error",
            message: "Le lien PNJ du dialogue pointe vers un bloc invalide ou supprime.",
            blockId: block.id,
          });
        } else if (
          block.npcImageAssetId &&
          !npcBlock.imageAssetIds.includes(block.npcImageAssetId)
        ) {
          issues.push({
            level: "warning",
            message: "L image PNJ selectionnee n existe plus dans la fiche PNJ.",
            blockId: block.id,
          });
        }
      }
    } else if (block.type === "choice") {
      if (block.choices.length === 0) {
        issues.push({
          level: "error",
          message: "Ce bloc de choix ne contient aucune option.",
          blockId: block.id,
        });
      }

      if (!block.prompt.trim()) {
        issues.push({
          level: "warning",
          message: "Le texte de situation (prompt) est vide.",
          blockId: block.id,
        });
      }

      for (const option of block.choices) {
        if (!option.text.trim()) {
          issues.push({
            level: "warning",
            message: `L option ${option.label} est vide.`,
            blockId: block.id,
          });
        }

        if (option.targetBlockId && !blockById.has(option.targetBlockId)) {
          issues.push({
            level: "error",
            message: `L option ${option.label} pointe vers un bloc supprime.`,
            blockId: block.id,
          });
        }
      }
    } else if (block.type === "npc_profile") {
      if (!block.npcName.trim()) {
        issues.push({
          level: "warning",
          message: "Renseigne un nom pour ce PNJ.",
          blockId: block.id,
        });
      }
    } else if (block.type === "gameplay") {
      if (!block.objective.trim()) {
        issues.push({
          level: "warning",
          message: "Ajoute un objectif gameplay.",
          blockId: block.id,
        });
      }

      if (!block.backgroundAssetId) {
        issues.push({
          level: "warning",
          message: "Ajoute une image de fond pour le gameplay.",
          blockId: block.id,
        });
      }

      if (block.hotspots.length === 0) {
        issues.push({
          level: "error",
          message: "Ajoute au moins une zone cliquable.",
          blockId: block.id,
        });
      }

      const overlayIds = new Set(block.overlays.map((overlay) => overlay.id));
      const hotspotIds = new Set(block.hotspots.map((hotspot) => hotspot.id));
      for (const hotspot of block.hotspots) {
        if (hotspot.toggleOverlayId && !overlayIds.has(hotspot.toggleOverlayId)) {
          issues.push({
            level: "error",
            message: `La zone ${hotspot.name || hotspot.id} pointe vers un overlay introuvable.`,
            blockId: block.id,
          });
        }

        for (const action of hotspot.onClickActions) {
          if (action.type === "go_to_block" && action.targetBlockId && !blockById.has(action.targetBlockId)) {
            issues.push({
              level: "error",
              message: `La zone ${hotspot.name || hotspot.id} contient une action vers un bloc supprime.`,
              blockId: block.id,
            });
          }

          if (
            action.type === "disable_hotspot" &&
            action.targetHotspotId &&
            !hotspotIds.has(action.targetHotspotId)
          ) {
            issues.push({
              level: "error",
              message: `La zone ${hotspot.name || hotspot.id} desactive une zone introuvable.`,
              blockId: block.id,
            });
          }

          if (action.type === "add_item") {
            if (!action.itemId) {
              issues.push({
                level: "warning",
                message: `La zone ${hotspot.name || hotspot.id} a une recompense sans objet cible.`,
                blockId: block.id,
              });
            } else if (!itemIds.has(action.itemId)) {
              issues.push({
                level: "error",
                message: `La zone ${hotspot.name || hotspot.id} donne un objet introuvable.`,
                blockId: block.id,
              });
            }
          }
        }
      }
    }

    if (
      block.type !== "dialogue" &&
      block.type !== "choice" &&
      block.type !== "hero_profile" &&
      block.type !== "npc_profile" &&
      block.nextBlockId &&
      !blockById.has(block.nextBlockId)
    ) {
      issues.push({
        level: "error",
        message: "Le bloc suivant pointe vers un bloc supprime.",
        blockId: block.id,
      });
    }
  }

  if (startBlockId && blockById.has(startBlockId)) {
    const reachable = new Set<string>();
    collectReachableIds(blockById, startBlockId, reachable);

    for (const block of blocks) {
      if (block.type === "hero_profile" || block.type === "npc_profile") continue;
      if (!reachable.has(block.id)) {
        issues.push({
          level: "warning",
          message: "Bloc inaccessible depuis le depart.",
          blockId: block.id,
        });
      }
    }
  }

  return issues;
}
