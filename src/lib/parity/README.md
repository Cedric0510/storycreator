# Tests de parite moteur (studio <-> lecteur)

Le studio (preview) et le lecteur mobile implementent chacun leur moteur de
jeu. Les deux projets sont volontairement independants: pas de package
partage. Pour empecher toute divergence de comportement, les memes scenarios
sont joues sur les deux moteurs et doivent produire exactement la meme trace.

## Regle de synchronisation

Les dossiers suivants sont DUPLIQUES a l'identique dans les deux depots:

- `story-player-mobile/src/core/parity/fixtures/`  <->  `author-studio/src/lib/parity/fixtures/`
- `story-player-mobile/src/core/parity/golden/`    <->  `author-studio/src/lib/parity/golden/`

Toute modification d'une fixture ou d'une golden trace doit etre copiee dans
l'autre depot. Le moteur du LECTEUR est la reference: les goldens sont
generees ici puis copiees cote studio.

## Regenerer les goldens (apres un changement de comportement voulu)

```bash
# depuis story-player-mobile/
UPDATE_PARITY_GOLDENS=1 npx vitest run src/core/parity
# puis copier fixtures/ et golden/ vers author-studio/src/lib/parity/
```

Sous PowerShell: `$env:UPDATE_PARITY_GOLDENS="1"; npx vitest run src/core/parity`

## Ce que la trace capture

Apres chaque action du script: bloc courant, ligne de dialogue, narration,
variables, historique de choix, inventaire, affinites, objets gameplay
(interactions, visibilite, sequence de boutons), item equipe, fin d'histoire.

`gameplayMessage` est volontairement EXCLU: les libelles peuvent differer
entre plateformes, seule la mecanique doit etre identique.
