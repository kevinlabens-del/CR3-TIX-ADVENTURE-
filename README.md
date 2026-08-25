# CR3@TIX ADVENTURE

Jeu de plateforme et de combat pensé pour mobile, jouable au clavier ou avec les commandes tactiles.

## Contenu

- 110 niveaux au total
- 100 missions classiques et 10 combats de boss
- un niveau spécial avec boss tous les 10 niveaux
- plusieurs familles d'ennemis et des missions variées
- animations de marche, course et saut
- difficulté, améliorations, skins et progression sauvegardée localement
- menu mobile, plein écran paysage et bouton de retour au menu

## Jouer en local

Prérequis : Node.js 22 ou une version plus récente.

```bash
npm ci
npm run build:pages
npm run preview:pages
```

Le jeu statique est généré dans `gh-pages-dist/`.

## GitHub Pages

Le workflow `.github/workflows/deploy-pages.yml` construit et publie automatiquement le jeu après chaque envoi sur la branche `main`. Il peut aussi être lancé manuellement depuis l'onglet **Actions** de GitHub.

## Commandes

- déplacement : flèches ou boutons tactiles
- saut : flèche haut / espace / bouton SAUT
- dash : Maj / bouton DASH
- attaque : X / bouton ATTAQUE
- pouvoir spécial : C / bouton SPÉCIAL

La progression et les réglages sont conservés dans le navigateur.
