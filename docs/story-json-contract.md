# Contrat `story.json` (Studio Auteur)

Ce document fige le format exporte par l outil auteur pour la partie lecture.
Version courante: `schemaVersion = "1.10.0"`.

## Racine

```json
{
  "schemaVersion": "1.10.0",
  "exportedAt": "2026-02-24T10:00:00.000Z",
  "project": {
    "id": "project_xxx",
    "title": "Titre",
    "slug": "titre",
    "synopsis": "...",
    "startBlockId": "title_xxx",
    "updatedAt": "2026-02-24T10:00:00.000Z"
  },
  "variables": [],
  "itemsCatalog": [],
  "blocks": [],
  "graph": {
    "edges": []
  }
}
```

## Variables

- `variables[]` contient:
- `id`: string unique
- `name`: string
- `initialValue`: number

## Inventaire

- `itemsCatalog[]` contient:
- `id`: string unique
- `name`: string
- `description`: string
- `iconAssetId`: string | null
- `iconPath`: string | null

## Blocs

Chaque bloc contient au minimum:
- `id`: string
- `type`: `title | cinematic | dialogue | choice | switch | gameplay`
- `name`: string
- `position`: `{ x: number, y: number }`
- `notes`: string

### `title`

- `storyTitle`: string
- `subtitle`: string
- `backgroundPath`: string | null
- `buttonStyle`: `{ backgroundColor, textColor, borderColor, radius, fontSize }`
- `nextBlockId`: string | null

### `cinematic`

- `heading`: string
- `body`: string
- `narrations`: `Array<{ id, heading, body, continueTargetBlockId, continueTargetNarrationId }>`
- `startNarrationId`: string
- `backgroundPath`: string | null
- `videoPath`: string | null
- `voicePath`: string | null
- `autoAdvanceSeconds`: number | null
- `nextBlockId`: string | null

`heading` / `body` restent presents pour compatibilite descendante et refletent la narration
de depart. Les nouvelles cinematiques multi-ecrans utilisent `narrations[]`.

### `dialogue`

Bloc de dialogue multi-lignes. Chaque ligne represente une replique avec ses propres reponses.
Les reponses peuvent pointer vers une autre ligne interne (navigation intra-bloc) ou vers un bloc
externe (sortie). Les deux cibles sont mutuellement exclusives.

- `backgroundPath`: string | null
- `characterPath`: string | null
- `npcProfileBlockId`: string | null
- `npcImageAssetId`: string | null
- `startLineId`: string (id de la ligne de depart)
- `lines[]`:
  - `id`: string
  - `speaker`: string
  - `text`: string
  - `voicePath`: string | null
  - `continueTargetBlockId`: string | null (sortie optionnelle du bouton `Continuer` quand la ligne n'a pas de reponses)
  - `responses[]` (max 4 par ligne):
    - `id`: string
    - `label`: `A | B | C | D`
    - `text`: string
    - `targetLineId`: string | null (navigation interne vers une autre ligne)
    - `targetBlockId`: string | null (navigation externe vers un autre bloc)
    - `effects[]`: `{ variableId, variableName, delta }`

### `choice`

Bloc de choix autonome (decision narrative sans dialogue).

- `prompt`: string (question ou contexte affiche au joueur)
- `displayMode`: `"visual" | "text"` (choix par images cliquables ou liste texte)
- `backgroundPath`: string | null
- `sceneLayout`: `{ background, character }` (rectangles `%` pour composer la scene)
- `characterLayers[]` (utilise en mode `text`, comme dialogue):
- `id`: string
- `label`: string
- `zIndex`: number (1 = devant, 5 = derriere)
- `layout`: `{ x, y, width, height }`
- `imagePath`: string | null
- `voicePath`: string | null
- `choices[]` (max 4):
- `id`: string
- `label`: `A | B | C | D`
- `text`: string (texte court du bouton)

### `switch`

Bloc de routage conditionnel. Les cas sont evalues de haut en bas. Le premier cas dont toutes
les conditions sont vraies est suivi, sinon `nextBlockId` est utilise.

Pour les conditions `variable` et `affinity`, `expectedValue` represente un seuil minimal
(`valeur courante >= expectedValue`), pas une egalite stricte.

- `variableId`: string | null
  Champ legacy conserve pour compatibilite descendante avec les anciens switches numeriques.
- `cases[]`:
  - `id`: string
  - `conditionType`: `"choice" | "value" | "mixed"`
    Champ legacy/miroir pour compatibilite.
  - `expectedValue`: number
    Champ legacy/miroir pour compatibilite.
  - `conditions[]`:
    - `id`: string
    - `type`: `"choice" | "variable" | "affinity"`
    - `variableId`: string | null
    - `npcProfileBlockId`: string | null
    - `choiceBlockId`: string | null
    - `choiceOptionId`: string | null
    - `operator`: champ technique/legacy. En pratique, le studio utilise `eq` pour `choice`
      et `gte` pour `variable` / `affinity`.
    - `expectedValue`: number
  - `choiceConditions[]`
    Champ legacy conserve pour compatibilite avec les anciens switches bases sur les choix.
  - `choiceBlockId`: string | null
    Champ legacy.
  - `choiceOptionId`: string | null
    Champ legacy.
  - `targetBlockId`: string | null
- `nextBlockId`: string | null
- `description`: string (detail ou consequence visible)
- `imagePath`: string | null (illustration de l option)
- `layout`: `{ x, y, width, height }` (position/taille clickable dans la scene)
- `zIndex`: number (1 = devant, 5 = derriere)
- `targetBlockId`: string | null
- `effects[]`: `{ variableId, variableName, delta }`
- `heroMemoryVariableId`: string | null
- `heroMemoryValue`: number

### `gameplay` (point_and_click)

- `mode`: string (`point_and_click` exporte actuellement)
- `objective`: string
- `backgroundPath`: string | null
- `voicePath`: string | null
- `overlays[]`:
- `id`, `name`, `x`, `y`, `width`, `height`, `zIndex`, `visibleByDefault`, `imagePath`
- `hotspots[]`:
- `id`, `name`, `x`, `y`, `width`, `height`, `required`, `message`, `toggleOverlayId`, `soundPath`, `effects[]`
- `onClickActions[]`:
- `message`: `{ id, type: "message", message }`
- `add_item`: `{ id, type: "add_item", itemId, quantity }`
- `disable_hotspot`: `{ id, type: "disable_hotspot", targetHotspotId }`
- `go_to_block`: `{ id, type: "go_to_block", targetBlockId }`
- `completionRule`: `{ type: "all_required" | "required_count", requiredCount: number }`
- `completionEffects[]`: `{ variableId, variableName, delta }`
- `nextBlockId`: string | null

## Coordonnees gameplay

- `x`, `y`, `width`, `height` sont en pourcentage (`0..100`).
- `x`, `y` representent le coin haut-gauche de l element.

## Graphe

- `graph.edges[]` contient:
- `source`: id bloc source
- `sourceHandle`: `next` ou `choice-A/B/C/D`
- `target`: id bloc cible

## Assets

- Les chemins (`backgroundPath`, `imagePath`, `soundPath`, etc.) pointent vers le zip exporte.
- Convention: `assets/{asset_id}-{nom_fichier_sanitize}`.

## Regles de compatibilite

- Ajout de champs: autorise sans casser les lecteurs tolerants.
- Suppression/renommage de champs: breaking change -> increment de `schemaVersion`.
- Le lecteur doit ignorer les champs inconnus.
