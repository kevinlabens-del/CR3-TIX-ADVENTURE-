# CR3@TIX ADVENTURE

Jeu de plateforme et de combat pensé pour mobile, jouable au clavier ou avec les commandes tactiles.

## Contenu

- 110 niveaux au total
- 100 missions classiques et 10 combats de boss
- un niveau spécial avec boss tous les 10 niveaux
- 10 biomes illustrés et distincts, un pour chaque monde
- 14 types de missions répartis différemment selon les mondes
- 9 familles d'ennemis aux comportements différents
- boss renforcés avec trois phases, télégraphes d'attaque et pouvoirs uniques
- animations de marche, course et saut
- difficulté, améliorations, skins et progression à 3 étoiles sauvegardée localement
- menu mobile, plein écran paysage et bouton de retour au menu
- installation Android depuis Chrome, avec icône, lancement plein écran et cache hors connexion

## Installer sur Android

1. Ouvre le jeu dans Chrome sur ton smartphone.
2. Dans le jeu, ouvre **OPTIONS** puis touche **INSTALLER SUR ANDROID**.
3. Confirme **Installer**. L’icône CR3@TIX apparaît sur l’écran d’accueil.

Si le bouton d’installation n’est pas encore proposé, recharge la page puis utilise le menu **⋮** de Chrome et choisis **Installer l’application**.

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
- dash : Maj ou X / bouton DASH
- attaque : J ou C / bouton ATQ
- pouvoir spécial : K ou V / bouton ULT

La progression et les réglages sont conservés dans le navigateur.
