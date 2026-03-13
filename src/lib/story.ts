export const STORY_SCHEMA_VERSION = "1.4.0";

export type BlockType =
  | "title"
  | "cinematic"
  | "dialogue"
  | "choice"
  | "gameplay"
  | "hero_profile"
  | "npc_profile"
  | "chapter_start"
  | "chapter_end";
export type ChoiceLabel = "A" | "B" | "C" | "D";
export type GameplayMode = "point_and_click" | "map_move" | "static_scene";
export type MemberRole = "owner" | "editor" | "viewer";

/* ── V3 gameplay: ultra-simplified 4-type object model ───────── */

/** What kind of object is this? */
export type GameplayObjectType =
  | "decoration"    // Not interactive — just visual
  | "collectible"   // Goes to inventory on click
  | "key"           // Draggable — must be dropped on its linked lock
  | "lock";         // Waits for its linked key, then triggers unlock effect

/** What happens when a lock is unlocked by its key. */
export type GameplayUnlockEffect =
  | "go_to_next"    // Advance to the next block
  | "disappear"     // Lock (and key) disappear
  | "modify_stats"; // Apply variable effects (future)

export interface GameplayObject {
  id: string;
  name: string;
  assetId: string | null;
  x: number;       // % position
  y: number;
  width: number;   // % size
  height: number;
  zIndex: number;
  visibleByDefault: boolean;
  objectType: GameplayObjectType;
  /** For collectible: which inventory item to grant */
  grantItemId: string | null;
  /** For lock: which "key" object unlocks this lock */
  linkedKeyId: string | null;
  /** For lock: what happens on unlock */
  unlockEffect: GameplayUnlockEffect;
  /** For lock: message shown when clicked without the key */
  lockedMessage: string;
  /** For lock: message shown on successful unlock */
  successMessage: string;
  /** Sound to play on interaction */
  soundAssetId: string | null;
  /** Variable effects when interacted */
  effects: VariableEffect[];
}

/* ── Legacy V2 link types (kept for migration only) ──────────── */

export type GameplayObjectAction =
  | "pick_up" | "inspect" | "push" | "go_to_block" | "none";

export type GameplayLinkInteraction =
  | "use_on" | "destroy_both" | "reveal";

export type GameplayLinkResult =
  | "hide_source" | "hide_target" | "hide_both"
  | "show_object" | "go_to_block" | "none";

export interface GameplayLink {
  id: string;
  sourceObjectId: string;
  targetObjectId: string;
  interaction: GameplayLinkInteraction;
  result: GameplayLinkResult;
  resultObjectId: string | null;
  resultBlockId: string | null;
  successMessage: string;
  lockedMessage: string;
  consumeSource: boolean;
}

/* ── Legacy V1 gameplay types (kept for migration) ────────────── */
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

/** Change to the affinity gauge of a specific NPC. */
export interface AffinityEffect {
  npcProfileBlockId: string;
  delta: number;
}

/** Condition that must be met for a dialogue line to trigger. */
export type DialogueLineConditionType = "min_affinity" | "max_affinity";

export interface DialogueLineCondition {
  type: DialogueLineConditionType;
  npcProfileBlockId: string;
  value: number;
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
  draggable: boolean;
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
  requiredItemId: string | null;
  consumeRequiredItem: boolean;
  lockedMessage: string;
  acceptOverlayId: string | null;
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
  /** Which chapter this block belongs to (null = default / no chapter) */
  chapterId: string | null;
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
  characterAssetId: string | null;
  sceneLayout: SceneLayout;
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
  /** Affinity changes when this response is picked */
  affinityEffects: AffinityEffect[];
}

export interface DialogueLine {
  id: string;
  speaker: string;
  text: string;
  voiceAssetId: string | null;
  /** Conditions that must ALL be met for this line to trigger */
  conditions: DialogueLineCondition[];
  /** If conditions fail, jump to this line instead (null = skip responses) */
  fallbackLineId: string | null;
  responses: DialogueResponse[];
}

/** Position + size of a single layer in the scene composer (% based, 0-100). */
export interface SceneLayerLayout {
  x: number;       // left offset in % of scene width
  y: number;       // top offset in % of scene height
  width: number;   // width in % of scene width
  height: number;  // height in % of scene height
}

/** A single character image layer in a dialogue scene (up to 5 layers, z-index 1-5). */
export interface CharacterLayer {
  id: string;
  assetId: string | null;
  label: string;         // Display name e.g. "Perso 1", "PNJ archer"
  zIndex: number;        // 1 (foreground) to 5 (far back)
  layout: SceneLayerLayout;
}

export const DEFAULT_CHARACTER_LAYOUT: SceneLayerLayout = { x: 25, y: 10, width: 50, height: 80 };

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
  /** @deprecated Use characterLayers instead. Kept for migration. */
  characterAssetId: string | null;
  npcProfileBlockId: string | null;
  /** @deprecated Use characterLayers instead. Kept for migration. */
  npcImageAssetId: string | null;
  sceneLayout: SceneLayout;
  /** Multiple character/NPC image layers with z-ordering */
  characterLayers: CharacterLayer[];
  lines: DialogueLine[];
  startLineId: string;
}

export interface GameplayBlock extends BaseBlock {
  type: "gameplay";
  mode: GameplayMode;
  objective: string;
  backgroundAssetId: string | null;
  sceneLayout: SceneLayout;
  voiceAssetId: string | null;
  /** V3: simplified objects with 4 types */
  objects: GameplayObject[];
  completionEffects: VariableEffect[];
  nextBlockId: string | null;
  /* ── Legacy fields (kept for migration, not used in V3 UI) ── */
  links?: GameplayLink[];
  completionMode?: "all_interactive" | "manual_count";
  completionCount?: number;
  overlays?: GameplayOverlay[];
  hotspots?: GameplayHotspot[];
  completionRule?: GameplayCompletionRule;
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
  /** Starting affinity value (0-100 scale) */
  initialAffinity: number;
  nextBlockId: string | null;
}

/** Marks the beginning of a chapter. One per chapter. */
export interface ChapterStartBlock extends BaseBlock {
  type: "chapter_start";
  /** Display name of the chapter */
  chapterTitle: string;
  nextBlockId: string | null;
}

/** Marks an exit point of a chapter. Multiple allowed per chapter. */
export interface ChapterEndBlock extends BaseBlock {
  type: "chapter_end";
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
  | NpcProfileBlock
  | ChapterStartBlock
  | ChapterEndBlock;

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

export interface Chapter {
  id: string;
  name: string;
  /** Whether this chapter is collapsed on the whiteboard */
  collapsed: boolean;
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
  chapters: Chapter[];
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
  chapter_start: "Debut chapitre",
  chapter_end: "Fin chapitre",
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
    affinityEffects: [],
  };
}

export function createDefaultLine(speaker?: string): DialogueLine {
  const id = createId("dline");
  return {
    id,
    speaker: speaker ?? "Narrateur",
    text: "",
    voiceAssetId: null,
    conditions: [],
    fallbackLineId: null,
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

export function defaultGameplayObject(): GameplayObject {
  return {
    id: createId("gobj"),
    name: "Objet",
    assetId: null,
    x: 35,
    y: 35,
    width: 15,
    height: 15,
    zIndex: 2,
    visibleByDefault: true,
    objectType: "decoration",
    grantItemId: null,
    linkedKeyId: null,
    unlockEffect: "go_to_next",
    lockedMessage: "",
    successMessage: "",
    soundAssetId: null,
    effects: [],
  };
}

/** @deprecated Legacy — only used for migration */
export function defaultGameplayLink(
  sourceObjectId: string,
  targetObjectId: string,
): GameplayLink {
  return {
    id: createId("glink"),
    sourceObjectId,
    targetObjectId,
    interaction: "use_on",
    result: "hide_source",
    resultObjectId: null,
    resultBlockId: null,
    successMessage: "",
    lockedMessage: "",
    consumeSource: true,
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

function normalizeVariableEffects(effects: unknown): VariableEffect[] {
  if (!Array.isArray(effects)) return [];
  return effects.map((effect) => ({
    variableId: typeof effect?.variableId === "string" ? effect.variableId : "",
    delta: Number.isFinite(effect?.delta) ? effect.delta : 0,
  }));
}

function normalizeAffinityEffects(effects: unknown): AffinityEffect[] {
  if (!Array.isArray(effects)) return [];
  return effects.map((effect) => ({
    npcProfileBlockId: typeof effect?.npcProfileBlockId === "string" ? effect.npcProfileBlockId : "",
    delta: Number.isFinite(effect?.delta) ? effect.delta : 0,
  }));
}

function normalizeConditions(conds: unknown): DialogueLineCondition[] {
  if (!Array.isArray(conds)) return [];
  return conds
    .filter((c) => c && typeof c === "object" && typeof c.type === "string")
    .map((c) => ({
      type: (c.type === "min_affinity" || c.type === "max_affinity" ? c.type : "min_affinity") as DialogueLineConditionType,
      npcProfileBlockId: typeof c.npcProfileBlockId === "string" ? c.npcProfileBlockId : "",
      value: Number.isFinite(c.value) ? c.value : 0,
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

function normalizeCharacterLayers(raw: unknown): CharacterLayer[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item): item is Record<string, unknown> => item && typeof item === "object")
    .map((item) => ({
      id: typeof item.id === "string" ? item.id : createId("clayer"),
      assetId: typeof item.assetId === "string" && item.assetId ? item.assetId : null,
      label: typeof item.label === "string" ? item.label : "Perso",
      zIndex: typeof item.zIndex === "number" && item.zIndex >= 1 && item.zIndex <= 5
        ? item.zIndex
        : 1,
      layout: normalizeLayerLayout(item.layout, DEFAULT_CHARACTER_LAYOUT),
    }));
}

/** Migrate legacy single characterAssetId / npcImageAssetId into characterLayers. */
function migrateCharacterLayers(
  raw: Record<string, unknown>,
  existingLayers: CharacterLayer[],
  sceneLayout: SceneLayout,
): CharacterLayer[] {
  if (existingLayers.length > 0) return existingLayers;
  const layers: CharacterLayer[] = [];
  if (typeof raw.characterAssetId === "string" && raw.characterAssetId) {
    layers.push({
      id: createId("clayer"),
      assetId: raw.characterAssetId,
      label: "Perso 1",
      zIndex: 1,
      layout: { ...sceneLayout.character },
    });
  }
  if (typeof raw.npcImageAssetId === "string" && raw.npcImageAssetId) {
    layers.push({
      id: createId("clayer"),
      assetId: raw.npcImageAssetId,
      label: "PNJ",
      zIndex: 2,
      layout: layers.length > 0
        ? { x: 50, y: 10, width: 50, height: 80 }
        : { ...sceneLayout.character },
    });
  }
  return layers;
}

export function createBlock(type: BlockType, position: XYPosition): StoryBlock {
  const id = createId(type);
  const base = { id, notes: "", position, entryEffects: [] as VariableEffect[], chapterId: null as string | null };

  if (type === "chapter_start") {
    return {
      ...base,
      type,
      name: "Debut chapitre",
      chapterTitle: "Nouveau chapitre",
      nextBlockId: null,
    };
  }

  if (type === "chapter_end") {
    return {
      ...base,
      type,
      name: "Fin chapitre",
      nextBlockId: null,
    };
  }

  if (type === "title") {
    return {
      ...base,
      type,
      name: "Ecran titre",
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
      ...base,
      type,
      name: "Intro",
      heading: "Cinematique",
      body: "",
      backgroundAssetId: null,
      characterAssetId: null,
      sceneLayout: { ...DEFAULT_SCENE_LAYOUT },
      videoAssetId: null,
      voiceAssetId: null,
      autoAdvanceSeconds: null,
      nextBlockId: null,
    };
  }

  if (type === "dialogue") {
    const firstLine = createDefaultLine();
    return {
      ...base,
      type,
      name: "Dialogue",
      backgroundAssetId: null,
      characterAssetId: null,
      npcProfileBlockId: null,
      npcImageAssetId: null,
      sceneLayout: { ...DEFAULT_SCENE_LAYOUT },
      characterLayers: [],
      lines: [firstLine],
      startLineId: firstLine.id,
    };
  }

  if (type === "choice") {
    return {
      ...base,
      type,
      name: "Choix",
      prompt: "Que fais-tu ?",
      backgroundAssetId: null,
      voiceAssetId: null,
      choices: [createDefaultChoiceOption("A"), createDefaultChoiceOption("B")],
    };
  }

  if (type === "hero_profile") {
    return {
      ...base,
      type,
      name: "Fiche Hero",
      nextBlockId: null,
    };
  }

  if (type === "npc_profile") {
    return {
      ...base,
      type,
      name: "Fiche PNJ",
      npcName: "PNJ",
      npcLore: "",
      imageAssetIds: [],
      defaultImageAssetId: null,
      initialAffinity: 50,
      nextBlockId: null,
    };
  }

  return {
    ...base,
    type: type as "gameplay",
    name: "Gameplay",
    mode: "point_and_click" as const,
    objective: "",
    backgroundAssetId: null,
    sceneLayout: { ...DEFAULT_SCENE_LAYOUT },
    voiceAssetId: null,
    objects: [],
    completionEffects: [],
    nextBlockId: null,
  };
}

export function normalizeGameplayBlock(block: GameplayBlock): GameplayBlock {
  const raw = block as unknown as Record<string, unknown>;

  // ── Detect data generation ──
  const hasV1 =
    (Array.isArray(raw.overlays) && (raw.overlays as unknown[]).length > 0) ||
    (Array.isArray(raw.hotspots) && (raw.hotspots as unknown[]).length > 0);
  const hasObjects = Array.isArray(raw.objects) && (raw.objects as unknown[]).length > 0;
  // V3 objects have "objectType"; V2 had "action"
  const isV3 = hasObjects && (raw.objects as Record<string, unknown>[])[0]?.objectType != null;

  // ── Helper: normalize a single V3 object ──
  function normObj(obj: Record<string, unknown>): GameplayObject {
    return {
      id: (obj.id as string) ?? createId("gobj"),
      name: typeof obj.name === "string" ? obj.name : "Objet",
      assetId: (obj.assetId as string) ?? null,
      x: Number.isFinite(obj.x) ? (obj.x as number) : 35,
      y: Number.isFinite(obj.y) ? (obj.y as number) : 35,
      width: Number.isFinite(obj.width) ? (obj.width as number) : 15,
      height: Number.isFinite(obj.height) ? (obj.height as number) : 15,
      zIndex: Number.isFinite(obj.zIndex) ? (obj.zIndex as number) : 2,
      visibleByDefault: typeof obj.visibleByDefault === "boolean" ? obj.visibleByDefault : true,
      objectType: (["decoration", "collectible", "key", "lock"] as string[]).includes(obj.objectType as string)
        ? (obj.objectType as GameplayObjectType)
        : "decoration",
      grantItemId: typeof obj.grantItemId === "string" && obj.grantItemId ? obj.grantItemId : null,
      linkedKeyId: typeof obj.linkedKeyId === "string" && obj.linkedKeyId ? obj.linkedKeyId : null,
      unlockEffect: (["go_to_next", "disappear", "modify_stats"] as string[]).includes(obj.unlockEffect as string)
        ? (obj.unlockEffect as GameplayUnlockEffect)
        : "go_to_next",
      lockedMessage: typeof obj.lockedMessage === "string" ? obj.lockedMessage : "",
      successMessage: typeof obj.successMessage === "string" ? obj.successMessage : "",
      soundAssetId: typeof obj.soundAssetId === "string" && obj.soundAssetId ? obj.soundAssetId : null,
      effects: normalizeVariableEffects(obj.effects),
    };
  }

  let objects: GameplayObject[] = [];

  if (isV3) {
    // ── Already V3: just normalize field values ──
    objects = (raw.objects as Record<string, unknown>[]).map(normObj);
  } else if (hasObjects) {
    // ── V2 → V3 migration: convert action + links to 4-type model ──
    const v2Objs = raw.objects as Record<string, unknown>[];
    const v2Links = Array.isArray(raw.links) ? (raw.links as Record<string, unknown>[]) : [];

    // Map V2 action → V3 objectType
    const actionToType: Record<string, GameplayObjectType> = {
      pick_up: "collectible",
      push: "key",
      none: "decoration",
      inspect: "decoration",
      go_to_block: "decoration",
    };

    // First pass: convert objects
    const objMap = new Map<string, GameplayObject>();
    for (const v2 of v2Objs) {
      const action = (v2.action as string) ?? "none";
      const obj: GameplayObject = {
        id: (v2.id as string) ?? createId("gobj"),
        name: typeof v2.name === "string" ? v2.name : "Objet",
        assetId: (v2.assetId as string) ?? null,
        x: Number.isFinite(v2.x) ? (v2.x as number) : 35,
        y: Number.isFinite(v2.y) ? (v2.y as number) : 35,
        width: Number.isFinite(v2.width) ? (v2.width as number) : 15,
        height: Number.isFinite(v2.height) ? (v2.height as number) : 15,
        zIndex: Number.isFinite(v2.zIndex) ? (v2.zIndex as number) : 2,
        visibleByDefault: typeof v2.visibleByDefault === "boolean" ? v2.visibleByDefault : true,
        objectType: actionToType[action] ?? "decoration",
        grantItemId: typeof v2.grantItemId === "string" && v2.grantItemId ? v2.grantItemId : null,
        linkedKeyId: null,
        unlockEffect: "go_to_next",
        lockedMessage: "",
        successMessage: "",
        soundAssetId: typeof v2.soundAssetId === "string" && v2.soundAssetId ? v2.soundAssetId : null,
        effects: normalizeVariableEffects(v2.effects),
      };
      objMap.set(obj.id, obj);
    }

    // Second pass: apply link info (source=key, target=lock)
    for (const link of v2Links) {
      const sourceId = link.sourceObjectId as string;
      const targetId = link.targetObjectId as string;
      const source = sourceId ? objMap.get(sourceId) : undefined;
      const target = targetId ? objMap.get(targetId) : undefined;
      if (source && target) {
        source.objectType = "key";
        target.objectType = "lock";
        target.linkedKeyId = sourceId;
        target.lockedMessage = typeof link.lockedMessage === "string" ? link.lockedMessage : "";
        target.successMessage = typeof link.successMessage === "string" ? link.successMessage : "";
        target.unlockEffect = link.result === "go_to_block" ? "go_to_next" : "disappear";
      }
    }

    objects = Array.from(objMap.values());
  } else if (hasV1) {
    // ── V1 → V3 migration: convert overlays+hotspots directly ──
    const legacyOverlays = Array.isArray(raw.overlays) ? (raw.overlays as GameplayOverlay[]) : [];
    const legacyHotspots = Array.isArray(raw.hotspots) ? (raw.hotspots as GameplayHotspot[]) : [];

    for (const ov of legacyOverlays) {
      objects.push({
        id: createId("gobj"),
        name: ov.name || "Objet",
        assetId: ov.assetId,
        x: ov.x, y: ov.y, width: ov.width, height: ov.height,
        zIndex: ov.zIndex,
        visibleByDefault: ov.visibleByDefault,
        objectType: "decoration",
        grantItemId: null, linkedKeyId: null,
        unlockEffect: "go_to_next", lockedMessage: "", successMessage: "",
        soundAssetId: null,
        effects: [],
      });
    }

    for (const hs of legacyHotspots) {
      let objectType: GameplayObjectType = "decoration";
      let grantItemId: string | null = null;
      for (const a of hs.onClickActions) {
        if (a.type === "add_item" && a.itemId) {
          objectType = "collectible";
          grantItemId = a.itemId;
        }
      }
      objects.push({
        id: createId("gobj"),
        name: hs.name || "Zone",
        assetId: null,
        x: hs.x, y: hs.y, width: hs.width, height: hs.height,
        zIndex: 10,
        visibleByDefault: true,
        objectType,
        grantItemId,
        linkedKeyId: null,
        unlockEffect: "go_to_next", lockedMessage: hs.lockedMessage || "", successMessage: "",
        soundAssetId: hs.soundAssetId,
        effects: normalizeVariableEffects(hs.effects),
      });
    }
  }

  return {
    ...block,
    entryEffects: normalizeVariableEffects(raw.entryEffects),
    mode: "point_and_click" as const,
    objective: block.objective ?? "",
    backgroundAssetId: block.backgroundAssetId ?? null,
    sceneLayout: normalizeSceneLayout(raw.sceneLayout),
    voiceAssetId: block.voiceAssetId ?? null,
    objects,
    completionEffects: normalizeVariableEffects(block.completionEffects),
    nextBlockId: block.nextBlockId ?? null,
    // Clear all legacy fields
    links: undefined,
    overlays: undefined,
    hotspots: undefined,
    completionMode: undefined,
    completionCount: undefined,
    completionRule: undefined,
  };
}

export function normalizeStoryBlock(block: StoryBlock): StoryBlock {
  // Ensure chapterId exists on all blocks (migration from older projects)
  const raw = block as unknown as Record<string, unknown>;
  if (typeof raw.chapterId !== "string") {
    (block as unknown as Record<string, unknown>).chapterId = null;
  }

  if (block.type === "chapter_start") {
    return {
      ...block,
      chapterId: block.chapterId ?? null,
      entryEffects: normalizeVariableEffects((block as { entryEffects?: unknown }).entryEffects),
      chapterTitle: block.chapterTitle ?? "Chapitre",
      nextBlockId: block.nextBlockId ?? null,
    };
  }

  if (block.type === "chapter_end") {
    return {
      ...block,
      chapterId: block.chapterId ?? null,
      entryEffects: normalizeVariableEffects((block as { entryEffects?: unknown }).entryEffects),
      nextBlockId: block.nextBlockId ?? null,
    };
  }

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
        affinityEffects: normalizeAffinityEffects(choice.affinityEffects),
      }));

      const sceneLayout = normalizeSceneLayout(raw.sceneLayout);

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
        sceneLayout,
        characterLayers: migrateCharacterLayers(raw, normalizeCharacterLayers(raw.characterLayers), sceneLayout),
        lines: [{
          id: lineId,
          speaker: oldSpeaker,
          text: oldText,
          voiceAssetId: oldVoice,
          conditions: [],
          fallbackLineId: null,
          responses: migratedResponses,
        }],
        startLineId: lineId,
      } as DialogueBlock;
    }

    // --- Normal v2 normalization ---
    const sceneLayout = normalizeSceneLayout(raw.sceneLayout);
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
      sceneLayout,
      characterLayers: migrateCharacterLayers(raw, normalizeCharacterLayers(raw.characterLayers), sceneLayout),
      lines: Array.isArray(block.lines)
        ? block.lines.map((line) => ({
            ...line,
            speaker: line.speaker ?? "Narrateur",
            text: line.text ?? "",
            voiceAssetId: line.voiceAssetId ?? null,
            conditions: normalizeConditions((line as unknown as Record<string, unknown>).conditions),
            fallbackLineId: typeof (line as unknown as Record<string, unknown>).fallbackLineId === "string" ? (line as unknown as Record<string, unknown>).fallbackLineId as string : null,
            responses: Array.isArray(line.responses)
              ? line.responses.map((resp) => ({
                  ...resp,
                  targetLineId: resp.targetLineId ?? null,
                  targetBlockId: resp.targetBlockId ?? null,
                  effects: normalizeVariableEffects(resp.effects),
                  affinityEffects: normalizeAffinityEffects((resp as unknown as Record<string, unknown>).affinityEffects),
                }))
              : [],
          }))
        : [],
      startLineId: block.startLineId ?? (Array.isArray(block.lines) && block.lines.length > 0 ? block.lines[0].id : ""),
    };
  }

  if (block.type === "cinematic") {
    const raw = block as unknown as Record<string, unknown>;
    return {
      ...block,
      entryEffects: normalizeVariableEffects(raw.entryEffects),
      characterAssetId:
        typeof raw.characterAssetId === "string" && raw.characterAssetId
          ? raw.characterAssetId as string
          : null,
      sceneLayout: normalizeSceneLayout(raw.sceneLayout),
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
      initialAffinity: typeof (block as unknown as Record<string, unknown>).initialAffinity === "number"
        ? block.initialAffinity
        : 50,
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
    return (block.lines ?? [])
      .flatMap((line) => line.responses)
      .map((resp) => resp.targetBlockId)
      .filter((targetId): targetId is string => Boolean(targetId));
  }

  if (block.type === "choice") {
    return block.choices
      .map((choice) => choice.targetBlockId)
      .filter((targetId): targetId is string => Boolean(targetId));
  }

  if (block.type === "chapter_start" || block.type === "chapter_end") {
    return block.nextBlockId ? [block.nextBlockId] : [];
  }

  if (block.type === "gameplay") {
    return block.nextBlockId ? [block.nextBlockId] : [];
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
  if (type === "chapter_start") return "#059669";
  if (type === "chapter_end") return "#dc2626";
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
      if ((block.lines ?? []).length === 0) {
        issues.push({
          level: "error",
          message: "Ce dialogue ne contient aucune ligne.",
          blockId: block.id,
        });
      }

      const lineIds = new Set((block.lines ?? []).map((line) => line.id));

      for (const line of (block.lines ?? [])) {
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

        // Validate conditions
        for (const cond of line.conditions ?? []) {
          if (cond.npcProfileBlockId) {
            const npcBlock = blockById.get(cond.npcProfileBlockId);
            if (!npcBlock || npcBlock.type !== "npc_profile") {
              issues.push({
                level: "error",
                message: `Condition de "${line.speaker || "?"}" reference un PNJ supprime.`,
                blockId: block.id,
              });
            }
          }
        }

        // Validate fallback line
        if (line.fallbackLineId && !lineIds.has(line.fallbackLineId)) {
          issues.push({
            level: "error",
            message: `Ligne de repli de "${line.speaker || "?"}" pointe vers une ligne supprimee.`,
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

          if (resp.targetLineId) {
            // If the response targets an external block, validate the lineId against that block's lines
            const ownerBlock = resp.targetBlockId ? blockById.get(resp.targetBlockId) : block;
            const ownerLineIds = ownerBlock && ownerBlock.type === "dialogue"
              ? new Set(ownerBlock.lines.map((l) => l.id))
              : lineIds;
            if (!ownerLineIds.has(resp.targetLineId)) {
              issues.push({
                level: "error",
                message: `Reponse ${resp.label} de "${line.speaker || "?"}" pointe vers une ligne supprimee.`,
                blockId: block.id,
              });
            }
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

      if ((block.characterLayers ?? []).length > 5) {
        issues.push({
          level: "warning",
          message: "Un dialogue ne peut pas contenir plus de 5 personnages.",
          blockId: block.id,
        });
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

      const objectIds = new Set(block.objects.map((o) => o.id));
      for (const obj of block.objects) {
        if (obj.objectType === "collectible" && obj.grantItemId && !itemIds.has(obj.grantItemId)) {
          issues.push({
            level: "error",
            message: `L'objet "${obj.name}" donne un item introuvable.`,
            blockId: block.id,
          });
        }
        if (obj.objectType === "lock" && obj.linkedKeyId && !objectIds.has(obj.linkedKeyId)) {
          issues.push({
            level: "error",
            message: `La serrure "${obj.name}" pointe vers une cle introuvable.`,
            blockId: block.id,
          });
        }
        if (obj.objectType === "lock" && !obj.linkedKeyId) {
          issues.push({
            level: "warning",
            message: `La serrure "${obj.name}" n'a aucune cle associee.`,
            blockId: block.id,
          });
        }
        if (obj.objectType === "key") {
          const hasLock = block.objects.some(
            (o) => o.objectType === "lock" && o.linkedKeyId === obj.id,
          );
          if (!hasLock) {
            issues.push({
              level: "warning",
              message: `La cle "${obj.name}" n'est associee a aucune serrure.`,
              blockId: block.id,
            });
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
