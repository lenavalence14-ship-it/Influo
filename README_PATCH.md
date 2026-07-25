# Patch — 5 bugs corrigés

Migration SQL déjà appliquée en base sur le projet Supabase "influo-app"
(colonnes crop_x/crop_y/crop_w/crop_h ajoutées à `posts`). Le fichier .sql
est inclus ici juste pour traçabilité/historique.

## Fichiers modifiés

- `src/pages/feed/NoteViewer.jsx` — musique de note qui continuait en arrière-plan
- `src/pages/feed/ReelsViewer.jsx` — reel qui continuait de jouer en arrière-plan
- `src/pages/feed/PostCard.jsx` — bouton mute/unmute cassé + crop réel affiché + carousel vidéo statique
- `src/pages/feed/Feed.jsx` — callback mute stabilisé (nécessaire pour le fix du memo dans PostCard)
- `src/pages/feed/CreatePost.jsx` — sauvegarde/lecture du crop précis + carousel avec vidéo mélangée
- `src/pages/feed/PostDetail.jsx` — ajout des colonnes crop_x/y/w/h à la requête

## À faire après extraction

Remplace ces fichiers dans ton repo aux mêmes chemins (`src/...`), puis rebuild.
Aucune autre étape nécessaire côté base de données : c'est déjà fait.
