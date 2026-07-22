# Patch : garder les onglets principaux en mémoire (keep-alive)

## Le vrai problème que ça corrige

Ton app est déjà une SPA (React Router `<BrowserRouter>`), donc naviguer
entre écrans ne recharge jamais toute la page. Mais par défaut, React
Router **démonte** l'écran quitté et **remonte** l'écran suivant à chaque
navigation. Résultat : revenir sur le Feed après être allé sur Recherche
recrée tout le composant Feed depuis zéro, y compris chaque `<img>`, qui
doit être re-décodée par le navigateur même si le fichier est déjà en
cache HTTP. C'est ça qui donne la sensation de "chargement" à chaque
retour sur un écran déjà visité — pas un problème de réseau.

## Ce que fait ce patch

Les 5 écrans de la barre de navigation (`/`, `/recherche`, `/notifications`,
`/profil`, `/video`) restent maintenant montés en permanence dans le DOM
une fois visités. Changer d'onglet ne fait plus que basculer une classe
CSS (`display: none` / `block`) — le scroll, les images déjà chargées,
l'état de chaque écran restent intacts, comme sur WhatsApp/Instagram.

Les écrans hors barre de nav (détail d'un post, édition de profil, page
d'offre, messagerie, etc.) continuent de se démonter/remonter normalement.
Aucune raison de les garder en mémoire indéfiniment.

## Fichiers

```
src/components/routing/KeepAliveTabs.jsx   (nouveau)
src/components/layout/AppLayout.jsx        (modifié)
```

## Limite honnête, à surveiller

Plus d'écrans restent en mémoire = plus de RAM utilisée sur la durée
d'une session (chaque `<img>`/`<video>` visitée reste décodée en mémoire
tant que l'app n'est pas fermée). Sur un feed avec beaucoup de contenu
visité dans une longue session, ça peut grossir. Aucune éviction n'est
implémentée dans cette version — si ça devient un problème mesuré (l'app
ralentit après un usage prolongé), la solution standard est de limiter le
nombre de posts gardés en mémoire dans le Feed lui-même (fenêtre glissante
plutôt que liste illimitée), pas de revenir en arrière sur ce patch.

## Test à faire après application

1. Ouvre le Feed, scrolle un peu pour charger plusieurs posts
2. Va sur Recherche, puis reviens sur le Feed (bouton nav, pas retour navigateur)
3. Vérifie : la position de scroll doit être conservée, et les images
   déjà vues ne doivent pas re-clignoter/recharger
4. Répète en allant sur Notifications puis Profil, dans tous les sens

Si le comportement WhatsApp-like que tu voulais est là, c'est bon.
