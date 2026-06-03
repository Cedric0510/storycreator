export const STORY_SCHEMA_VERSION = "1.10.0";

export type BlockType =
  | "title"
  | "cinematic"
  | "dialogue"
  | "choice"
  | "switch"
  | "gameplay"
  | "hero_profile"
  | "npc_profile"
  | "chapter_start"
  | "chapter_end";
export type ChoiceLabel = "A" | "B" | "C" | "D";
export type ChoiceDisplayMode = "visual" | "text";
export type GameplayMode = "point_and_click" | "map_move" | "static_scene";
export type MemberRole = "owner" | "editor" | "viewer";

/* â”€â”€ V3 gameplay: ultra-simplified 4-type object model â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

/** What kind of object is this? */
export type GameplayObjectType =
  | "decoration"    // Not interactive â€” just visual
  | "collectible"   // Goes to inventory on click
  | "key"           // Draggable â€” must be dropped on its linked lock
  | "lock"          // Waits for its linked key, then triggers unlock effect
  | "button";       // Clickable button used in an ordered sequence

/** What happens when a lock is unlocked by its key. */
export type GameplayUnlockEffect =
  | "go_to_next"    // Advance to the next block
  | "disappear"     // Lock (and key) disappear
  | "modify_stats"; // Apply variable effects (future)

export type GameplayLockInputMode = "scene_key" | "inventory_item";

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
  /** For lock: where the unlock requirement comes from (scene key or inventory item). */
  lockInputMode: GameplayLockInputMode;
  /** For lock with inventory_item mode: required inventory item id. */
  requiredItemId: string | null;
  /** For lock with inventory_item mode: consume one item when unlocked. */
  consumeRequiredItem: boolean;
  /** Optional branch target when this lock unlocks (null = end of story). */
  targetBlockId: string | null;
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

/* â”€â”€ Legacy V2 link types (kept for migration only) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

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

/* â”€â”€ Legacy V1 gameplay types (kept for migration) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
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

export type SwitchConditionType = "choice" | "variable" | "affinity";
export type SwitchComparisonOperator = "eq" | "ne" | "gt" | "gte" | "lt" | "lte";
export type SwitchCaseLogic = "and" | "or";

export interface SwitchCondition {
  id: string;
  type: SwitchConditionType;
  variableId: string | null;
  npcProfileBlockId: string | null;
  choiceBlockId: string | null;
  choiceOptionId: string | null;
  operator: SwitchComparisonOperator;
  expectedValue: number;
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
  narrations: CinematicNarration[];
  startNarrationId: string;
  backgroundAssetId: string | null;
  /** @deprecated Use characterLayers instead. Kept for migration. */
  characterAssetId: string | null;
  sceneLayout: SceneLayout;
  /** Multiple character image layers with z-ordering */
  characterLayers: CharacterLayer[];
  videoAssetId: string | null;
  voiceAssetId: string | null;
  autoAdvanceSeconds: number | null;
  nextBlockId: string | null;
}

export interface CinematicNarration {
  id: string;
  heading: string;
  body: string;
  continueTargetBlockId: string | null;
  continueTargetNarrationId: string | null;
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
  /** Optional external block target used by "Continuer" when there are no responses. */
  continueTargetBlockId: string | null;
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

const DEFAULT_CHOICE_OPTION_LAYOUTS: Record<ChoiceLabel, SceneLayerLayout> = {
  A: { x: 8, y: 22, width: 38, height: 68 },
  B: { x: 54, y: 22, width: 38, height: 68 },
  C: { x: 8, y: 56, width: 38, height: 36 },
  D: { x: 54, y: 56, width: 38, height: 36 },
};

export function defaultChoiceOptionLayout(label: ChoiceLabel): SceneLayerLayout {
  const layout = DEFAULT_CHOICE_OPTION_LAYOUTS[label] ?? DEFAULT_CHOICE_OPTION_LAYOUTS.A;
  return { ...layout };
}

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
  /** V3: simplified objects with 5 types */
  objects: GameplayObject[];
  /** Expected button press order (button object IDs). */
  buttonSequence: string[];
  /** Target when the button sequence is entered correctly. */
  buttonSequenceSuccessBlockId: string | null;
  /** Target when the button sequence fails. */
  buttonSequenceFailureBlockId: string | null;
  completionEffects: VariableEffect[];
  nextBlockId: string | null;
  /* â”€â”€ Legacy fields (kept for migration, not used in V3 UI) â”€â”€ */
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
  /** Optional link to a previously validated chapter. */
  linkedFromChapterId: string | null;
  /** Optional chapter_end block used as entry from the previous chapter. */
  linkedFromChapterEndBlockId: string | null;
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
  layout: SceneLayerLayout;
  zIndex: number;
  targetBlockId: string | null;
  effects: VariableEffect[];
  /** Optional hero-choice memory variable updated when this option is selected. */
  heroMemoryVariableId: string | null;
  /** Value assigned to heroMemoryVariableId when this option is selected. */
  heroMemoryValue: number;
}

export interface ChoiceBlock extends BaseBlock {
  type: "choice";
  displayMode: ChoiceDisplayMode;
  prompt: string;
  backgroundAssetId: string | null;
  sceneLayout: SceneLayout;
  /** Scene-only characters used in text mode (independent from choice options). */
  characterLayers: CharacterLayer[];
  voiceAssetId: string | null;
  choices: ChoiceOption[];
}

export interface SwitchCase {
  id: string;
  logic: SwitchCaseLogic;
  conditionType: "value" | "choice" | "mixed";
  expectedValue: number;
  /** Unified conditions evaluated with case-level logic (authoritative representation). */
  conditions: SwitchCondition[];
  /** Choice conditions combined with AND (choice mode only). */
  choiceConditions: SwitchChoiceCondition[];
  /** @deprecated Legacy single choice source (migrated to choiceConditions). */
  /** Choice block whose selected option should be checked (choice mode only). */
  choiceBlockId: string | null;
  /** @deprecated Legacy single choice option (migrated to choiceConditions). */
  /** Expected selected option id in the referenced choice block (choice mode only). */
  choiceOptionId: string | null;
  targetBlockId: string | null;
}

export interface SwitchChoiceCondition {
  id: string;
  choiceBlockId: string | null;
  choiceOptionId: string | null;
}

export interface SwitchBlock extends BaseBlock {
  type: "switch";
  /** Variable to evaluate when entering this block. */
  variableId: string | null;
  /** Ordered cases tested top-to-bottom (first match wins). */
  cases: SwitchCase[];
  /** Fallback path when no case matches. */
  nextBlockId: string | null;
}

export type StoryBlock =
  | TitleBlock
  | CinematicBlock
  | DialogueBlock
  | ChoiceBlock
  | SwitchBlock
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
  /** Whether the chapter is archived in the validated chapters list. */
  validated: boolean;
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
  switch: "Switch",
  gameplay: "Gameplay",
  hero_profile: "Fiche Hero",
  npc_profile: "Fiche PNJ",
  chapter_start: "Debut chapitre",
  chapter_end: "Fin chapitre",
};

export const CHOICE_LABELS: ChoiceLabel[] = ["A", "B", "C", "D"];
export const MAX_GAMEPLAY_BUTTONS = 5;

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
    continueTargetBlockId: null,
    responses: [],
  };
}

export function createDefaultCinematicNarration(): CinematicNarration {
  return {
    id: createId("cnarr"),
    heading: "Cinematique",
    body: "",
    continueTargetBlockId: null,
    continueTargetNarrationId: null,
  };
}

export function createDefaultSwitchCondition(type: SwitchConditionType = "choice"): SwitchCondition {
  return {
    id: createId("switch_cond"),
    type,
    variableId: null,
    npcProfileBlockId: null,
    choiceBlockId: null,
    choiceOptionId: null,
    operator: type === "choice" ? "eq" : "gte",
    expectedValue: 0,
  };
}

function normalizeSwitchConditionType(raw: unknown): SwitchConditionType {
  switch (raw) {
    case "variable":
    case "affinity":
    case "choice":
      return raw;
    default:
      return "choice";
  }
}

export function normalizeSwitchCondition(condition: unknown): SwitchCondition {
  const candidate = (condition && typeof condition === "object"
    ? condition
    : {}) as Partial<SwitchCondition>;
  const type = normalizeSwitchConditionType(candidate.type);
  return {
    id: typeof candidate.id === "string" && candidate.id ? candidate.id : createId("switch_cond"),
    type,
    variableId:
      typeof candidate.variableId === "string" && candidate.variableId
        ? candidate.variableId
        : null,
    npcProfileBlockId:
      typeof candidate.npcProfileBlockId === "string" && candidate.npcProfileBlockId
        ? candidate.npcProfileBlockId
        : null,
    choiceBlockId:
      typeof candidate.choiceBlockId === "string" && candidate.choiceBlockId
        ? candidate.choiceBlockId
        : null,
    choiceOptionId:
      typeof candidate.choiceOptionId === "string" && candidate.choiceOptionId
        ? candidate.choiceOptionId
        : null,
    operator: type === "choice" ? "eq" : "gte",
    expectedValue:
      typeof candidate.expectedValue === "number" && Number.isFinite(candidate.expectedValue)
        ? candidate.expectedValue
        : 0,
  };
}

export function syncSwitchCaseCompatibility(caseItem: SwitchCase): SwitchCase {
  const normalizedConditions = Array.isArray(caseItem.conditions)
    ? caseItem.conditions.map((condition) => normalizeSwitchCondition(condition))
    : [];
  const choiceConditions = normalizedConditions
    .filter((condition) => condition.type === "choice")
    .map((condition) => ({
      id: condition.id,
      choiceBlockId: condition.choiceBlockId,
      choiceOptionId: condition.choiceOptionId,
    }));
  const onlyChoiceConditions =
    normalizedConditions.length > 0 && normalizedConditions.every((condition) => condition.type === "choice");
  const onlySingleVariableCondition =
    normalizedConditions.length === 1 && normalizedConditions[0]?.type === "variable";

  return {
    ...caseItem,
    logic: caseItem.logic === "or" ? "or" : "and",
    conditions: normalizedConditions,
    conditionType: onlyChoiceConditions ? "choice" : onlySingleVariableCondition ? "value" : "mixed",
    expectedValue: onlySingleVariableCondition
      ? normalizedConditions[0].expectedValue
      : typeof caseItem.expectedValue === "number" && Number.isFinite(caseItem.expectedValue)
        ? caseItem.expectedValue
        : 0,
    choiceConditions,
    choiceBlockId: choiceConditions[0]?.choiceBlockId ?? null,
    choiceOptionId: choiceConditions[0]?.choiceOptionId ?? null,
  };
}

export function describeSwitchCase(caseItem: SwitchCase): string {
  const conditionCount = caseItem.conditions?.length ?? 0;
  const logicLabel = caseItem.logic === "or" ? "OU" : "ET";
  if (conditionCount === 0) return `${logicLabel}: aucune condition`;

  const counts = {
    choice: 0,
    variable: 0,
    affinity: 0,
  };
  for (const condition of caseItem.conditions) {
    counts[condition.type] += 1;
  }

  const parts: string[] = [];
  if (counts.choice > 0) parts.push(counts.choice === 1 ? "1 choix" : `${counts.choice} choix`);
  if (counts.variable > 0) parts.push(counts.variable === 1 ? "1 ressource" : `${counts.variable} ressources`);
  if (counts.affinity > 0) parts.push(counts.affinity === 1 ? "1 affinite" : `${counts.affinity} affinites`);
  return `${logicLabel}: ${parts.join(" + ")}`;
}

function createDefaultChoiceOption(label: ChoiceLabel): ChoiceOption {
  return {
    id: createId("option"),
    label,
    text: "",
    description: "",
    imageAssetId: null,
    layout: defaultChoiceOptionLayout(label),
    zIndex: 2,
    targetBlockId: null,
    effects: [],
    heroMemoryVariableId: null,
    heroMemoryValue: 1,
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
    lockInputMode: "scene_key",
    requiredItemId: null,
    consumeRequiredItem: false,
    targetBlockId: null,
    unlockEffect: "go_to_next",
    lockedMessage: "",
    successMessage: "",
    soundAssetId: null,
    effects: [],
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
  includeNpcImage = true,
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
  if (includeNpcImage && typeof raw.npcImageAssetId === "string" && raw.npcImageAssetId) {
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
      linkedFromChapterId: null,
      linkedFromChapterEndBlockId: null,
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
    const firstNarration = createDefaultCinematicNarration();
    return {
      ...base,
      type,
      name: "Intro",
      heading: firstNarration.heading,
      body: firstNarration.body,
      narrations: [firstNarration],
      startNarrationId: firstNarration.id,
      backgroundAssetId: null,
      characterAssetId: null,
      sceneLayout: { ...DEFAULT_SCENE_LAYOUT },
      characterLayers: [],
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
      displayMode: "visual",
      prompt: "Que fais-tu ?",
      backgroundAssetId: null,
      sceneLayout: { ...DEFAULT_SCENE_LAYOUT },
      characterLayers: [],
      voiceAssetId: null,
      choices: [createDefaultChoiceOption("A"), createDefaultChoiceOption("B")],
    };
  }

  if (type === "switch") {
    return {
      ...base,
      type,
      name: "Switch",
      variableId: null,
      cases: [
        {
          id: createId("switch_case"),
          logic: "and",
          conditionType: "choice",
          expectedValue: 1,
          conditions: [
            {
              ...createDefaultSwitchCondition("choice"),
            },
          ],
          choiceConditions: [
            {
              id: createId("switch_cond"),
              choiceBlockId: null,
              choiceOptionId: null,
            },
          ],
          choiceBlockId: null,
          choiceOptionId: null,
          targetBlockId: null,
        },
      ],
      nextBlockId: null,
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
    buttonSequence: [],
    buttonSequenceSuccessBlockId: null,
    buttonSequenceFailureBlockId: null,
    completionEffects: [],
    nextBlockId: null,
  };
}

export function normalizeGameplayBlock(block: GameplayBlock): GameplayBlock {
  const raw = block as unknown as Record<string, unknown>;

  // â”€â”€ Detect data generation â”€â”€
  const hasV1 =
    (Array.isArray(raw.overlays) && (raw.overlays as unknown[]).length > 0) ||
    (Array.isArray(raw.hotspots) && (raw.hotspots as unknown[]).length > 0);
  const hasObjects = Array.isArray(raw.objects) && (raw.objects as unknown[]).length > 0;
  // V3 objects have "objectType"; V2 had "action"
  const isV3 = hasObjects && (raw.objects as Record<string, unknown>[])[0]?.objectType != null;

  // â”€â”€ Helper: normalize a single V3 object â”€â”€
  function normObj(obj: Record<string, unknown>): GameplayObject {
    const objectType = (["decoration", "collectible", "key", "lock", "button"] as string[]).includes(obj.objectType as string)
      ? (obj.objectType as GameplayObjectType)
      : "decoration";
    const lockInputModeRaw = typeof obj.lockInputMode === "string" ? obj.lockInputMode : "";
    const inferredLockInputMode: GameplayLockInputMode =
      typeof obj.requiredItemId === "string" && obj.requiredItemId ? "inventory_item" : "scene_key";
    const lockInputMode: GameplayLockInputMode =
      lockInputModeRaw === "inventory_item" || lockInputModeRaw === "scene_key"
        ? (lockInputModeRaw as GameplayLockInputMode)
        : inferredLockInputMode;
    const requiredItemId =
      typeof obj.requiredItemId === "string" && obj.requiredItemId ? obj.requiredItemId : null;
    const consumeRequiredItem =
      typeof obj.consumeRequiredItem === "boolean" ? obj.consumeRequiredItem : false;

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
      objectType,
      grantItemId: typeof obj.grantItemId === "string" && obj.grantItemId ? obj.grantItemId : null,
      linkedKeyId: typeof obj.linkedKeyId === "string" && obj.linkedKeyId ? obj.linkedKeyId : null,
      lockInputMode: objectType === "lock" ? lockInputMode : "scene_key",
      requiredItemId: objectType === "lock" ? requiredItemId : null,
      consumeRequiredItem: objectType === "lock" ? consumeRequiredItem : false,
      targetBlockId: typeof obj.targetBlockId === "string" && obj.targetBlockId ? obj.targetBlockId : null,
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
    // â”€â”€ Already V3: just normalize field values â”€â”€
    objects = (raw.objects as Record<string, unknown>[]).map(normObj);
  } else if (hasObjects) {
    // â”€â”€ V2 â†’ V3 migration: convert action + links to 4-type model â”€â”€
    const v2Objs = raw.objects as Record<string, unknown>[];
    const v2Links = Array.isArray(raw.links) ? (raw.links as Record<string, unknown>[]) : [];

    // Map V2 action â†’ V3 objectType
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
        lockInputMode: "scene_key",
        requiredItemId: null,
        consumeRequiredItem: false,
        targetBlockId: null,
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
        target.lockInputMode = "scene_key";
        target.lockedMessage = typeof link.lockedMessage === "string" ? link.lockedMessage : "";
        target.successMessage = typeof link.successMessage === "string" ? link.successMessage : "";
        target.unlockEffect = link.result === "go_to_block" ? "go_to_next" : "disappear";
        target.targetBlockId =
          link.result === "go_to_block" && typeof link.resultBlockId === "string" && link.resultBlockId
            ? link.resultBlockId
            : null;
      }
    }

    objects = Array.from(objMap.values());
  } else if (hasV1) {
    // â”€â”€ V1 â†’ V3 migration: convert overlays+hotspots directly â”€â”€
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
        grantItemId: null, linkedKeyId: null, lockInputMode: "scene_key", requiredItemId: null, consumeRequiredItem: false, targetBlockId: null,
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
        lockInputMode: "scene_key",
        requiredItemId: null,
        consumeRequiredItem: false,
        targetBlockId: null,
        unlockEffect: "go_to_next", lockedMessage: hs.lockedMessage || "", successMessage: "",
        soundAssetId: hs.soundAssetId,
        effects: normalizeVariableEffects(hs.effects),
      });
    }
  }

  const orderedButtonIds = objects
    .filter((obj) => obj.objectType === "button")
    .map((obj) => obj.id);
  const buttonIds = new Set(orderedButtonIds);
  const rawButtonSequence = Array.isArray(raw.buttonSequence) ? raw.buttonSequence : [];
  const seenButtonIds = new Set<string>();
  const explicitButtonSequence = rawButtonSequence
    .filter((value): value is string => typeof value === "string" && buttonIds.has(value))
    .filter((buttonId) => {
      if (seenButtonIds.has(buttonId)) return false;
      seenButtonIds.add(buttonId);
      return true;
    })
    .slice(0, MAX_GAMEPLAY_BUTTONS);
  const missingButtonIds = orderedButtonIds.filter((buttonId) => !seenButtonIds.has(buttonId));
  const buttonSequence = [...explicitButtonSequence, ...missingButtonIds].slice(0, MAX_GAMEPLAY_BUTTONS);
  const buttonSequenceSuccessBlockId =
    typeof raw.buttonSequenceSuccessBlockId === "string" && raw.buttonSequenceSuccessBlockId
      ? raw.buttonSequenceSuccessBlockId
      : null;
  const buttonSequenceFailureBlockId =
    typeof raw.buttonSequenceFailureBlockId === "string" && raw.buttonSequenceFailureBlockId
      ? raw.buttonSequenceFailureBlockId
      : null;

  return {
    ...block,
    entryEffects: normalizeVariableEffects(raw.entryEffects),
    mode: "point_and_click" as const,
    objective: block.objective ?? "",
    backgroundAssetId: block.backgroundAssetId ?? null,
    sceneLayout: normalizeSceneLayout(raw.sceneLayout),
    voiceAssetId: block.voiceAssetId ?? null,
    objects,
    buttonSequence,
    buttonSequenceSuccessBlockId,
    buttonSequenceFailureBlockId,
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
      linkedFromChapterId:
        typeof (block as unknown as Record<string, unknown>).linkedFromChapterId === "string"
          ? (block as unknown as Record<string, unknown>).linkedFromChapterId as string
          : null,
      linkedFromChapterEndBlockId:
        typeof (block as unknown as Record<string, unknown>).linkedFromChapterEndBlockId === "string"
          ? (block as unknown as Record<string, unknown>).linkedFromChapterEndBlockId as string
          : null,
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
          continueTargetBlockId: null,
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
            continueTargetBlockId:
              typeof (line as unknown as Record<string, unknown>).continueTargetBlockId === "string"
                ? (line as unknown as Record<string, unknown>).continueTargetBlockId as string
                : null,
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
    const sceneLayout = normalizeSceneLayout(raw.sceneLayout);
    const rawNarrations = Array.isArray(raw.narrations) ? raw.narrations : [];
    const normalizedNarrations = rawNarrations
      .map((item) => {
        if (!item || typeof item !== "object") return null;
        const narration = item as Record<string, unknown>;
        return {
          id:
            typeof narration.id === "string" && narration.id
              ? narration.id
              : createId("cnarr"),
          heading:
            typeof narration.heading === "string"
              ? narration.heading
              : typeof raw.heading === "string"
                ? raw.heading
                : "Cinematique",
          body:
            typeof narration.body === "string"
              ? narration.body
              : typeof raw.body === "string"
                ? raw.body
                : "",
          continueTargetBlockId:
            typeof narration.continueTargetBlockId === "string" && narration.continueTargetBlockId
              ? narration.continueTargetBlockId
              : null,
          continueTargetNarrationId:
            typeof narration.continueTargetNarrationId === "string" && narration.continueTargetNarrationId
              ? narration.continueTargetNarrationId
              : null,
        };
      })
      .filter((item): item is CinematicNarration => Boolean(item));
    const fallbackNarration = {
      id:
        typeof raw.startNarrationId === "string" && raw.startNarrationId
          ? raw.startNarrationId
          : createId("cnarr"),
      heading: typeof raw.heading === "string" ? raw.heading : "Cinematique",
      body: typeof raw.body === "string" ? raw.body : "",
      continueTargetBlockId: null,
      continueTargetNarrationId: null,
    };
    const narrations =
      normalizedNarrations.length > 0 ? normalizedNarrations : [fallbackNarration];
    const startNarrationId =
      typeof raw.startNarrationId === "string" &&
      narrations.some((item) => item.id === raw.startNarrationId)
        ? raw.startNarrationId
        : narrations[0].id;
    const startNarration =
      narrations.find((item) => item.id === startNarrationId) ?? narrations[0];
    return {
      ...block,
      entryEffects: normalizeVariableEffects(raw.entryEffects),
      heading: startNarration.heading,
      body: startNarration.body,
      narrations,
      startNarrationId,
      characterAssetId:
        typeof raw.characterAssetId === "string" && raw.characterAssetId
          ? raw.characterAssetId as string
          : null,
      sceneLayout,
      characterLayers: migrateCharacterLayers(
        raw,
        normalizeCharacterLayers(raw.characterLayers),
        sceneLayout,
        false,
      ),
    };
  }

  if (block.type === "choice") {
    const rawChoice = block as unknown as Record<string, unknown>;
    const sceneLayout = normalizeSceneLayout(rawChoice.sceneLayout);
    const rawChoices = Array.isArray(block.choices) ? block.choices : [];
    const hasAnyChoiceImage = rawChoices.some((option) => Boolean(option.imageAssetId));
    const displayMode: ChoiceDisplayMode =
      rawChoice.displayMode === "text" || rawChoice.displayMode === "visual"
        ? rawChoice.displayMode
        : hasAnyChoiceImage
          ? "visual"
          : "text";
    const normalizedChoices = rawChoices.map((option) => ({
      ...option,
      description: option.description ?? "",
      imageAssetId: option.imageAssetId ?? null,
      layout: normalizeLayerLayout(
        (option as unknown as Record<string, unknown>).layout,
        defaultChoiceOptionLayout(option.label),
      ),
      zIndex:
        typeof (option as unknown as Record<string, unknown>).zIndex === "number" &&
        Number.isFinite((option as unknown as Record<string, unknown>).zIndex)
          ? Math.min(5, Math.max(1, Math.round((option as unknown as Record<string, unknown>).zIndex as number)))
          : 2,
      effects: normalizeVariableEffects(option.effects),
      heroMemoryVariableId:
        typeof (option as unknown as Record<string, unknown>).heroMemoryVariableId === "string" &&
        (option as unknown as Record<string, unknown>).heroMemoryVariableId
          ? ((option as unknown as Record<string, unknown>).heroMemoryVariableId as string)
          : null,
      heroMemoryValue:
        typeof (option as unknown as Record<string, unknown>).heroMemoryValue === "number" &&
        Number.isFinite((option as unknown as Record<string, unknown>).heroMemoryValue)
          ? ((option as unknown as Record<string, unknown>).heroMemoryValue as number)
          : 1,
    }));
    const explicitCharacterLayers = normalizeCharacterLayers(rawChoice.characterLayers);
    const migratedTextCharacterLayers =
      displayMode === "text" && explicitCharacterLayers.length === 0
        ? normalizedChoices
            .filter((option) => Boolean(option.imageAssetId))
            .map((option, index) => ({
              id: `choice-text-layer-${option.id}`,
              assetId: option.imageAssetId,
              label: option.text?.trim() || `Perso ${index + 1}`,
              zIndex: option.zIndex,
              layout: option.layout,
            }))
        : explicitCharacterLayers;
    return {
      ...block,
      entryEffects: normalizeVariableEffects((block as { entryEffects?: unknown }).entryEffects),
      displayMode,
      prompt: block.prompt ?? "",
      backgroundAssetId: block.backgroundAssetId ?? null,
      sceneLayout,
      characterLayers: migratedTextCharacterLayers,
      voiceAssetId: block.voiceAssetId ?? null,
      choices: normalizedChoices,
    };
  }

  if (block.type === "switch") {
    const rawSwitch = block as unknown as Record<string, unknown>;
    const normalizedVariableId =
      typeof rawSwitch.variableId === "string" && rawSwitch.variableId
        ? (rawSwitch.variableId as string)
        : null;
    return {
      ...block,
      entryEffects: normalizeVariableEffects((block as { entryEffects?: unknown }).entryEffects),
      variableId: normalizedVariableId,
      cases: Array.isArray(rawSwitch.cases)
        ? (rawSwitch.cases as Record<string, unknown>[])
            .map((item) => {
              const legacyConditionType =
                item.conditionType === "choice"
                  ? "choice"
                  : item.conditionType === "mixed"
                    ? "mixed"
                    : "value";
              const choiceConditions = Array.isArray(item.choiceConditions)
                ? (item.choiceConditions as Record<string, unknown>[])
                    .map((conditionItem) => ({
                      id:
                        typeof conditionItem.id === "string" && conditionItem.id
                          ? conditionItem.id
                          : createId("switch_cond"),
                      choiceBlockId:
                        typeof conditionItem.choiceBlockId === "string" && conditionItem.choiceBlockId
                          ? conditionItem.choiceBlockId
                          : null,
                      choiceOptionId:
                        typeof conditionItem.choiceOptionId === "string" && conditionItem.choiceOptionId
                          ? conditionItem.choiceOptionId
                          : null,
                    }))
                : [];
              const explicitConditions = Array.isArray(item.conditions)
                ? (item.conditions as unknown[]).map((condition) => normalizeSwitchCondition(condition))
                : [];
              const migratedConditions = explicitConditions.length > 0
                ? explicitConditions
                : legacyConditionType === "choice"
                  ? [
                      ...choiceConditions.map((condition) => ({
                        id: condition.id,
                        type: "choice" as const,
                        variableId: null,
                        npcProfileBlockId: null,
                        choiceBlockId: condition.choiceBlockId,
                        choiceOptionId: condition.choiceOptionId,
                        operator: "eq" as const,
                        expectedValue: 0,
                      })),
                      ...(
                        choiceConditions.length === 0 &&
                        typeof item.choiceBlockId === "string" &&
                        item.choiceBlockId &&
                        typeof item.choiceOptionId === "string" &&
                        item.choiceOptionId
                          ? [{
                              id: createId("switch_cond"),
                              type: "choice" as const,
                              variableId: null,
                              npcProfileBlockId: null,
                              choiceBlockId: item.choiceBlockId,
                              choiceOptionId: item.choiceOptionId,
                              operator: "eq" as const,
                              expectedValue: 0,
                            }]
                          : []
                      ),
                    ]
                  : [
                      {
                        id: createId("switch_cond"),
                        type: "variable" as const,
                        variableId: normalizedVariableId,
                        npcProfileBlockId: null,
                        choiceBlockId: null,
                        choiceOptionId: null,
                        operator: "gte" as const,
                        expectedValue:
                          typeof item.expectedValue === "number" && Number.isFinite(item.expectedValue)
                            ? item.expectedValue
                            : 0,
                      },
                    ];

              return syncSwitchCaseCompatibility({
                id: typeof item.id === "string" && item.id ? item.id : createId("switch_case"),
                logic: item.logic === "or" ? "or" : "and",
                conditionType: legacyConditionType,
                expectedValue:
                  typeof item.expectedValue === "number" && Number.isFinite(item.expectedValue)
                    ? item.expectedValue
                    : 0,
                conditions: migratedConditions,
                choiceConditions,
                choiceBlockId:
                  typeof item.choiceBlockId === "string" && item.choiceBlockId
                    ? item.choiceBlockId
                    : null,
                choiceOptionId:
                  typeof item.choiceOptionId === "string" && item.choiceOptionId
                    ? item.choiceOptionId
                    : null,
                targetBlockId:
                  typeof item.targetBlockId === "string" && item.targetBlockId
                    ? item.targetBlockId
                    : null,
              });
            })
        : [],
      nextBlockId: block.nextBlockId ?? null,
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
    const responseTargets = (block.lines ?? [])
      .flatMap((line) => line.responses)
      .map((resp) => resp.targetBlockId)
      .filter((targetId): targetId is string => Boolean(targetId));
    const continueTargets = (block.lines ?? [])
      .filter((line) => (line.responses ?? []).length === 0)
      .map((line) => line.continueTargetBlockId)
      .filter((targetId): targetId is string => Boolean(targetId));
    return Array.from(new Set([...responseTargets, ...continueTargets]));
  }

  if (block.type === "cinematic") {
    const narrationTargets = (block.narrations ?? [])
      .map((narration) => narration.continueTargetBlockId)
      .filter((targetId): targetId is string => Boolean(targetId));
    const targets = block.nextBlockId
      ? [...narrationTargets, block.nextBlockId]
      : narrationTargets;
    return Array.from(new Set(targets));
  }

  if (block.type === "choice") {
    return block.choices
      .map((choice) => choice.targetBlockId)
      .filter((targetId): targetId is string => Boolean(targetId));
  }

  if (block.type === "switch") {
    const caseTargets = block.cases
      .map((item) => item.targetBlockId)
      .filter((targetId): targetId is string => Boolean(targetId));
    const targets = block.nextBlockId
      ? [...caseTargets, block.nextBlockId]
      : caseTargets;
    return Array.from(new Set(targets));
  }

  if (block.type === "chapter_start" || block.type === "chapter_end") {
    return block.nextBlockId ? [block.nextBlockId] : [];
  }

  if (block.type === "gameplay") {
    const lockTargets = block.objects
      .filter((obj) => obj.objectType === "lock" && obj.unlockEffect === "go_to_next")
      .map((obj) => obj.targetBlockId)
      .filter((targetId): targetId is string => Boolean(targetId));
    const sequenceTargets = [
      block.buttonSequenceSuccessBlockId,
      block.buttonSequenceFailureBlockId,
    ].filter((targetId): targetId is string => Boolean(targetId));
    const targets = block.nextBlockId
      ? [block.nextBlockId, ...lockTargets, ...sequenceTargets]
      : [...lockTargets, ...sequenceTargets];
    return Array.from(new Set(targets));
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
  if (type === "switch") return "#2563eb";
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
  variables: VariableDefinition[] = [],
) {
  const issues: ValidationIssue[] = [];
  const blockById = new Map(blocks.map((block) => [block.id, block]));
  const itemIds = new Set(items.map((item) => item.id));
  const variableIds = new Set(variables.map((variable) => variable.id));
  const collectibleInventoryIds = new Set<string>();
  for (const block of blocks) {
    if (block.type !== "gameplay") continue;
    for (const obj of block.objects) {
      if (obj.objectType !== "collectible") continue;
      collectibleInventoryIds.add(obj.grantItemId ?? obj.id);
    }
  }
  const inventoryItemIds = new Set([...itemIds, ...collectibleInventoryIds]);
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
        message: "Le bloc de depart devrait etre un bloc narratif (titre/cinematique/dialogue/choix/switch/gameplay).",
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

        if (line.continueTargetBlockId && !blockById.has(line.continueTargetBlockId)) {
          issues.push({
            level: "error",
            message: `La sortie Continuer de "${line.speaker || "?"}" pointe vers un bloc supprime.`,
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
    } else if (block.type === "switch") {
      if (block.cases.length === 0) {
        issues.push({
          level: "warning",
          message: "Ajoute au moins un cas dans le switch.",
          blockId: block.id,
        });
      }
      const seenCaseSignatures = new Set<string>();
      for (const item of block.cases) {
        if ((item.conditions ?? []).length === 0) {
          issues.push({
            level: "warning",
            message: "Un cas du switch doit avoir au moins une condition.",
            blockId: block.id,
          });
          continue;
        }

        const seenCaseConditionKeys = new Set<string>();
        const caseSignatureParts: string[] = [];

        for (const condition of item.conditions ?? []) {
          let conditionKey = `${condition.type}`;

          if (condition.type === "choice") {
            if (!condition.choiceBlockId) {
              issues.push({
                level: "warning",
                message: "Une condition du switch n a pas de bloc choix source.",
                blockId: block.id,
              });
              continue;
            }

            const sourceBlock = blockById.get(condition.choiceBlockId);
            if (!sourceBlock) {
              issues.push({
                level: "error",
                message: "Une condition du switch pointe vers un bloc choix supprime.",
                blockId: block.id,
              });
              continue;
            }
            if (sourceBlock.type !== "choice") {
              issues.push({
                level: "error",
                message: "Une condition du switch reference un bloc qui n est pas un bloc choix.",
                blockId: block.id,
              });
              continue;
            }

            if (!condition.choiceOptionId) {
              issues.push({
                level: "warning",
                message: "Une condition du switch n a pas d option choisie.",
                blockId: block.id,
              });
              continue;
            }

            const optionExists = sourceBlock.choices.some((option) => option.id === condition.choiceOptionId);
            if (!optionExists) {
              issues.push({
                level: "error",
                message: "Une condition du switch reference une option de choix supprimee.",
                blockId: block.id,
              });
              continue;
            }

            conditionKey = `choice:${condition.choiceBlockId}:${condition.choiceOptionId}`;
          } else if (condition.type === "variable") {
            if (!condition.variableId) {
              issues.push({
                level: "warning",
                message: "Une condition du switch n a pas de ressource selectionnee.",
                blockId: block.id,
              });
              continue;
            }

            if (variables.length > 0 && !variableIds.has(condition.variableId)) {
              issues.push({
                level: "error",
                message: "Une condition du switch reference une ressource supprimee.",
                blockId: block.id,
              });
              continue;
            }

            conditionKey = `variable:${condition.variableId}:${condition.operator}:${condition.expectedValue}`;
          } else if (condition.type === "affinity") {
            if (!condition.npcProfileBlockId) {
              issues.push({
                level: "warning",
                message: "Une condition du switch n a pas de personnage selectionne.",
                blockId: block.id,
              });
              continue;
            }

            const npcBlock = blockById.get(condition.npcProfileBlockId);
            if (!npcBlock) {
              issues.push({
                level: "error",
                message: "Une condition du switch reference un personnage supprime.",
                blockId: block.id,
              });
              continue;
            }
            if (npcBlock.type !== "npc_profile") {
              issues.push({
                level: "error",
                message: "Une condition du switch reference un bloc qui n est pas une fiche PNJ.",
                blockId: block.id,
              });
              continue;
            }

            conditionKey = `affinity:${condition.npcProfileBlockId}:${condition.operator}:${condition.expectedValue}`;
          }

          if (seenCaseConditionKeys.has(conditionKey)) {
            issues.push({
              level: "warning",
              message: "Un cas du switch contient deux fois la meme condition.",
              blockId: block.id,
            });
            continue;
          }
          seenCaseConditionKeys.add(conditionKey);
          caseSignatureParts.push(conditionKey);
        }

        const conditionSignature = caseSignatureParts.sort().join(" && ");
        if (!conditionSignature) continue;
        const caseSignature = `${item.logic === "or" ? "or" : "and"}::${conditionSignature}`;
        if (seenCaseSignatures.has(caseSignature)) {
          issues.push({
            level: "warning",
            message: "Deux cas du switch utilisent exactement le meme ensemble de conditions avec la meme logique.",
            blockId: block.id,
          });
          break;
        }
        seenCaseSignatures.add(caseSignature);
      }

      for (const item of block.cases) {
        if (item.targetBlockId && !blockById.has(item.targetBlockId)) {
          issues.push({
            level: "error",
            message: "Un cas du switch pointe vers un bloc supprime.",
            blockId: block.id,
          });
        }
      }

      if (block.nextBlockId && !blockById.has(block.nextBlockId)) {
        issues.push({
          level: "error",
          message: "La sortie Sinon du switch pointe vers un bloc supprime.",
          blockId: block.id,
        });
      }
    } else if (block.type === "npc_profile") {
      if (!block.npcName.trim()) {
        issues.push({
          level: "warning",
          message: "Renseigne un nom pour ce PNJ.",
          blockId: block.id,
        });
      }
    } else if (block.type === "cinematic") {
      if ((block.narrations ?? []).length === 0) {
        issues.push({
          level: "error",
          message: "Cette cinematique ne contient aucune narration.",
          blockId: block.id,
        });
      }

      for (const narration of block.narrations ?? []) {
        if (!narration.body.trim()) {
          issues.push({
            level: "warning",
            message: `Une narration de "${block.name || "Cinematique"}" est vide.`,
            blockId: block.id,
          });
          break;
        }

        if (narration.continueTargetBlockId && !blockById.has(narration.continueTargetBlockId)) {
          issues.push({
            level: "error",
            message: "Une narration pointe vers un bloc supprime.",
            blockId: block.id,
          });
          break;
        }

        if (narration.continueTargetNarrationId) {
          const targetCinematicBlock = narration.continueTargetBlockId
            ? blockById.get(narration.continueTargetBlockId) ?? null
            : block;

          if (!targetCinematicBlock) continue;

          if (targetCinematicBlock.type !== "cinematic") {
            issues.push({
              level: "error",
              message: "Une narration cible une narration sur un bloc qui n est pas une cinematique.",
              blockId: block.id,
            });
            break;
          }

          if (!(targetCinematicBlock.narrations ?? []).some((item) => item.id === narration.continueTargetNarrationId)) {
            issues.push({
              level: "error",
              message: "Une narration pointe vers une autre narration supprimee.",
              blockId: block.id,
            });
            break;
          }
        }
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
      const buttonObjects = block.objects.filter((o) => o.objectType === "button");
      const buttonIds = new Set(buttonObjects.map((o) => o.id));

      if (buttonObjects.length > MAX_GAMEPLAY_BUTTONS) {
        issues.push({
          level: "error",
          message: `Le systeme de code accepte au maximum ${MAX_GAMEPLAY_BUTTONS} boutons.`,
          blockId: block.id,
        });
      }

      if (buttonObjects.length > 0 && block.buttonSequence.length === 0) {
        issues.push({
          level: "warning",
          message: "Definis une sequence de boutons pour le code.",
          blockId: block.id,
        });
      }
      if (
        buttonObjects.length > 0 &&
        block.buttonSequence.length > 0 &&
        block.buttonSequence.length !== buttonObjects.length
      ) {
        issues.push({
          level: "warning",
          message: "Chaque bouton doit avoir une position dans la sequence.",
          blockId: block.id,
        });
      }

      for (const buttonId of block.buttonSequence) {
        if (!buttonIds.has(buttonId)) {
          issues.push({
            level: "error",
            message: "La sequence contient un bouton supprime ou invalide.",
            blockId: block.id,
          });
          break;
        }
      }

      if (buttonObjects.length > 0 && !block.buttonSequenceSuccessBlockId) {
        issues.push({
          level: "warning",
          message: "Definis une sortie reussite pour la sequence de boutons.",
          blockId: block.id,
        });
      }
      if (buttonObjects.length > 0 && !block.buttonSequenceFailureBlockId) {
        issues.push({
          level: "warning",
          message: "Definis une sortie echec pour la sequence de boutons.",
          blockId: block.id,
        });
      }
      if (block.buttonSequenceSuccessBlockId && !blockById.has(block.buttonSequenceSuccessBlockId)) {
        issues.push({
          level: "error",
          message: "La sortie reussite de sequence pointe vers un bloc supprime.",
          blockId: block.id,
        });
      }
      if (block.buttonSequenceFailureBlockId && !blockById.has(block.buttonSequenceFailureBlockId)) {
        issues.push({
          level: "error",
          message: "La sortie echec de sequence pointe vers un bloc supprime.",
          blockId: block.id,
        });
      }

      for (const obj of block.objects) {
        if (obj.objectType === "collectible" && obj.grantItemId && !itemIds.has(obj.grantItemId)) {
          issues.push({
            level: "error",
            message: `L'objet "${obj.name}" donne un item introuvable.`,
            blockId: block.id,
          });
        }
        if (obj.objectType === "lock") {
          if (obj.lockInputMode === "inventory_item") {
            if (obj.requiredItemId && !inventoryItemIds.has(obj.requiredItemId)) {
              issues.push({
                level: "error",
                message: `La serrure "${obj.name}" exige un item introuvable.`,
                blockId: block.id,
              });
            }
            if (!obj.requiredItemId) {
              issues.push({
                level: "warning",
                message: `La serrure "${obj.name}" n'a aucun item d'inventaire associe.`,
                blockId: block.id,
              });
            }
          } else {
            if (obj.linkedKeyId && !objectIds.has(obj.linkedKeyId)) {
              issues.push({
                level: "error",
                message: `La serrure "${obj.name}" pointe vers une cle introuvable.`,
                blockId: block.id,
              });
            }
            if (!obj.linkedKeyId) {
              issues.push({
                level: "warning",
                message: `La serrure "${obj.name}" n'a aucune cle associee.`,
                blockId: block.id,
              });
            }
          }
        }
        if (obj.objectType === "lock" && obj.targetBlockId && !blockById.has(obj.targetBlockId)) {
          issues.push({
            level: "error",
            message: `La serrure "${obj.name}" pointe vers un bloc supprime.`,
            blockId: block.id,
          });
        }
        if (obj.objectType === "key") {
          const hasLock = block.objects.some(
            (o) => o.objectType === "lock" && o.lockInputMode !== "inventory_item" && o.linkedKeyId === obj.id,
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
      block.type !== "switch" &&
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

