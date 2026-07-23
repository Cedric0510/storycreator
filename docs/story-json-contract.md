# Contrat `story.json` (Studio Auteur)

Ce document fige le format exporte par l'outil auteur pour la partie lecture.
Version courante: `schemaVersion = "1.12.0"`.

Source de verite cote code: `serializeBlock` + `exportZip`
(author-studio) et `storyLoader.ts` (story-player-mobile). Les scenarios de
`src/lib/parity/fixtures/` (dupliques dans le lecteur) sont des exemples
executables de ce contrat: les deux moteurs doivent produire les memes traces.

## Racine

```json
{
  "schemaVersion": "1.12.0",
  "exportedAt": "2026-07-18T10:00:00.000Z",
  "project": {
    "id": "project_xxx",
    "title": "Titre",
    "slug": "titre",
    "synopsis": "...",
    "startBlockId": "title_xxx",
    "updatedAt": "2026-07-18T10:00:00.000Z",
    "chapters": [],
    "parts": []
  },
  "studio": { "openedValidatedChapterIds": [] },
  "variables": [],
  "itemsCatalog": [],
  "hero": {},
  "blocks": [],
  "graph": { "edges": [] }
}
```

- `studio` est un etat d'edition (reimport dans l'outil auteur); le lecteur l'ignore.
- `project.chapters[]`: `{ id, name, collapsed, validated? }` (organisation editeur).
- `project.parts[]`: `{ id, chapterId, name, validated }` (subdivision editoriale d'un chapitre).

## Variables

`variables[]`: `{ id, name, initialValue: number }`.

Dans tous les tableaux d'effets exportes, chaque effet est
`{ variableId, variableName, delta }` (`variableName` est informatif).

## Inventaire (`itemsCatalog`)

`itemsCatalog[]`: `{ id, name, description, iconAssetId, iconPath }`.

## Hero (`hero`)

- `name`, `lore`
- `baseStats[]`: `{ id, variableId, variableName, value }`
- `npcs[]`: `{ id, name, lore, baseFriendship }` (descriptif)
- `startingInventory[]`: `{ id, itemId, itemName, quantity, iconAssetId, iconPath }`
  Le lecteur initialise l'inventaire du joueur avec ces entrees.

## Blocs

Champs communs a tous les blocs:
- `id`, `type`, `name`, `position: { x, y }`, `notes`
- `chapterId`: string | null (rattachement chapitre)
- `partId`: string | null (rattachement partie)
- `entryEffects[]`: effets appliques a l'ENTREE du bloc

Types: `title | cinematic | dialogue | choice | switch | gameplay |
hero_profile | npc_profile | chapter_start | chapter_end | part_start | part_end`.

### `part_start` et `part_end`

- `part_start`: `partTitle`, `partId`, `chapterId`, `nextBlockId`
- `part_end`: `partId`, `chapterId`, `nextBlockId`
- Le lecteur traverse ces frontieres sans afficher d'ecran intermediaire.

### `title`

- `storyTitle`, `subtitle`
- `backgroundPath`: string | null
- `buttonStyle`: `{ backgroundColor, textColor, borderColor, radius, fontSize }`
- `nextBlockId`: string | null

### `cinematic`

- `heading` / `body`: compat descendante, refletent la narration de depart
- `narrations[]`: `{ id, heading, body, bustPath, continueTargetBlockId, continueTargetNarrationId }`
- `startNarrationId`
- `backgroundPath`, `characterPath` (legacy premier calque), `videoPath`, `voicePath`
- `characterLayers[]`: `{ id, label, zIndex, layout: {x,y,width,height}, assetId, imagePath }`
- `sceneLayout`: `{ background?, character? }` (rectangles en `%`)
- `bust`: `{ imagePath, side: "left" | "right", width }`; `narrations[].bustPath`
  remplace son image pour une narration. Le lecteur ancre ce calque au-dessus
  de la barre de texte, quelle que soit sa hauteur.
- `autoAdvanceSeconds`: number | null (UI lecteur; sans effet moteur)
- `nextBlockId`: string | null (suivi apres la derniere narration)

### `dialogue`

Bloc multi-lignes; chaque ligne porte ses reponses. Pas de `nextBlockId`:
la sortie se fait par `continueTargetBlockId` (ligne) ou `targetBlockId`
(reponse); sinon, epuiser les lignes TERMINE l'histoire.

- `backgroundPath`, `characterPath`, `sceneLayout`, `characterLayers[]` (comme cinematic)
- `npcProfileBlockId`: string | null (PNJ lie, source du nom et de l'affinite)
- `npcImageAssetId` / `npcImagePath`
- `startLineId`
- `lines[]`:
  - `id`, `speaker`, `text`, `voicePath`, `bustPath`
  - `conditions[]`: `{ type: "min_affinity" | "max_affinity", npcProfileBlockId, value }`
  - `fallbackLineId`: string | null (ligne de repli si conditions non remplies)
  - `continueTargetBlockId`: string | null (sortie du bouton Continuer, si pas de reponses)
  - `responses[]` (max 4):
    - `id`, `label: "A"|"B"|"C"|"D"`, `text`
    - `targetLineId` (navigation interne) / `targetBlockId` (sortie) — exclusifs
    - `effects[]`, `affinityEffects[]: { npcProfileBlockId, delta }`
- `bust`: meme format que `cinematic`; `lines[].bustPath` remplace son image
  pour permettre l'alternance des interlocuteurs.

### `choice`

- `displayMode`: `"visual" | "text"`
- `prompt`
- `backgroundPath`, `sceneLayout`, `characterLayers[]`, `voicePath`
- `bust`: meme format que `cinematic`
- `choices[]` (max 4):
  - `id`, `label: "A"|"B"|"C"|"D"`, `text`, `description`
  - `imagePath`, `layout`, `zIndex` (mode visual)
  - `targetBlockId`: string | null
  - `effects[]`
  - `heroMemoryVariableId` / `heroMemoryVariableName` / `heroMemoryValue`:
    si defini, la variable est FORCEE a cette valeur (pas un delta)

Le choix selectionne est memorise dans l'historique (`choiceHistory[blockId] = optionId`).

### `switch`

Routage conditionnel, cas evalues de haut en bas, premier cas valide suivi,
sinon `nextBlockId`. Un cas sans `targetBlockId` est ignore.

- `variableId` / `variableName`: legacy (switches numeriques historiques)
- `cases[]`:
  - `id`, `logic: "and" | "or"`, `targetBlockId`
  - `conditions[]` (representation moderne, prioritaire si non vide):
    - `type: "choice" | "variable" | "affinity"`
    - `variableId` | `npcProfileBlockId` | `choiceBlockId`+`choiceOptionId`
    - `operator: "eq" | "ne" | "gt" | "gte" | "lt" | "lte"`
      Applique tel quel par les moteurs. Pour `choice`: `eq` (a choisi
      l'option) ou `ne` (ne l'a pas choisie); les autres operateurs
      valent `eq`. L'editeur ne produit que `eq`/`gte`, mais les six
      operateurs sont preserves a l'import et honores a l'execution.
    - `expectedValue`: number
  - Champs legacy (utilises SEULEMENT si `conditions` est vide):
    - `conditionType: "value" | "choice" | "mixed"` + `expectedValue`
      (`value` = variable du bloc `>= expectedValue`)
    - `choiceConditions[]`: `{ id, choiceBlockId, choiceOptionId }` (ET logique)
    - `choiceBlockId` / `choiceOptionId` (ancien cas choix unique)
- `nextBlockId`: string | null (route par defaut)

### `gameplay` (point_and_click, modele V3)

- `mode`: `"point_and_click"`
- `objective`
- `backgroundPath`, `sceneLayout`, `voicePath`
- `bust`: meme format que `cinematic`
- `objects[]`:
  - `id`, `name`, `x`, `y`, `width`, `height` (en `%`, coin haut-gauche), `zIndex`
  - `visibleByDefault`: boolean
  - `objectType`: `"decoration" | "collectible" | "key" | "lock" | "button"`
  - `grantItemId` (collectible: item donne; null = l'id de l'objet)
  - `linkedKeyId` (lock scene_key: cle attendue)
  - `lockInputMode`: `"scene_key" | "inventory_item"`
  - `requiredItemId`, `consumeRequiredItem` (lock inventory_item)
  - `targetBlockId` (lock go_to_next: destination)
  - `unlockEffect`: `"go_to_next" | "disappear" | "modify_stats"`
  - `lockedMessage`, `successMessage`
  - `soundPath`, `imagePath`
  - `effects[]` (appliques a l'interaction)
- `buttonSequence[]`: ids de boutons dans l'ordre attendu.
  La sequence est respectee TELLE QUELLE: un bouton present dans `objects`
  mais absent de la sequence est un leurre volontaire (le presser = echec).
- `buttonSequenceSuccessBlockId` / `buttonSequenceFailureBlockId`
- `completionEffects[]`: appliques a la sortie reussie (Continuer apres
  interaction complete, sequence correcte, ou lock go_to_next)
- `nextBlockId`: string | null (sortie via Continuer)

Completion sans boutons: tous les objets interactifs (ni decoration ni
button) doivent avoir ete utilises. Avec boutons: seule la sequence decide.

### `hero_profile`

Aucun champ specifique (fiche affichee par le lecteur). Pas de `nextBlockId`
exporte: la sortie passe par `graph.edges` (handle `next`).

### `npc_profile`

- `npcName`, `npcLore`
- `initialAffinity`: number (jauge 0-100, defaut 50, bornee par les moteurs)
- `defaultImageAssetId` / `defaultImagePath`
- `images[]`: `{ assetId, path }`

Le bloc sert aussi de declaration: chaque `npc_profile` present dans
`blocks` initialise son entree d'affinite, meme s'il n'est pas relie.
Pas de `nextBlockId` exporte: sortie via `graph.edges` si relie.

### `chapter_start`

- `chapterTitle`
- `linkedFromChapterId` / `linkedFromChapterEndBlockId` (liaison editeur)
- `nextBlockId`: string | null

### `chapter_end`

- `nextBlockId`: string | null

## Graphe

`graph.edges[]`: `{ source, sourceHandle, target }`.

Les champs des blocs (`nextBlockId`, `targetBlockId`...) sont canoniques;
le lecteur utilise les edges en REPLI quand un champ est null, avec ces
handles: `next`, `choice-A/B/C/D`, `resp-<responseId>`, `lock-<lockId>`,
`button-seq-success`, `button-seq-failure`.

## Regles d'execution (garanties par les DEUX moteurs)

Reference: moteur du lecteur (`storyEngine.ts`); la preview du studio est
verrouillee dessus par les tests de parite.

1. `chapter_start`, `chapter_end` et `switch` sont traverses automatiquement
   (jamais affiches). Leurs `entryEffects` s'appliquent au passage. Un cycle
   dans cette traversee termine l'histoire proprement.
2. Toute cible nulle ou introuvable termine l'histoire (ecran de fin).
3. Affinites: initialisees depuis les `npc_profile` (defaut 50), toujours
   bornees 0-100.
4. Dialogue: la ligne visee est validee par ses `conditions`; sinon repli en
   chaine via `fallbackLineId` (boucles coupees); sinon premiere ligne du
   bloc dont les conditions passent.
5. Les effets d'une reponse/option s'appliquent AVANT la resolution de la
   cible (une reponse peut donc debloquer sa propre ligne cible).
6. `heroMemory` force la valeur de la variable (assignation, pas delta).
7. Gameplay: un collectible ne se ramasse qu'une fois; cle et serrure
   disparaissent ensemble; un item consomme retombe a 0 et se desequipe;
   les leurres de sequence provoquent l'echec a la longueur attendue.
8. Les libelles de `gameplayMessage` peuvent differer entre plateformes
   (exclus de la parite); la mecanique, jamais.

## Assets

- Les chemins (`backgroundPath`, `imagePath`, `soundPath`, `voicePath`,
  `videoPath`, `iconPath`...) pointent dans le zip exporte.
- Convention: `assets/{asset_id}-{nom_fichier_sanitize}`.
- Deduplication par contenu: PLUSIEURS references (assetIds) peuvent pointer
  vers le MEME fichier du zip quand leur contenu est identique. Un lecteur ne
  doit jamais supposer une bijection chemin <-> reference.
- Les champs `*AssetId` exportes servent au reimport dans l'outil auteur;
  le lecteur ne lit que les `*Path`.

## Regles de compatibilite

- Ajout de champs: autorise sans casser les lecteurs tolerants.
- Suppression/renommage de champs: breaking change -> increment de `schemaVersion`.
- Le lecteur doit ignorer les champs inconnus et supporte `1.x` jusqu'a `1.10.x`.
- Toute evolution de la SEMANTIQUE d'execution doit etre refletee dans les
  scenarios de parite (fixtures + goldens regeneres cote lecteur, puis
  recopies cote studio).
