# Ce qui a changé

## Fichiers modifiés
- `src/lib/mediaCrop.js` (NOUVEAU) — logique partagée du crop zoom/pan (calcul du zoom minimum, style CSS), utilisée à l'identique par l'éditeur et par le feed.
- `src/lib/mediaCompression.js` — ajout de `getMediaDimensions()` pour lire la largeur/hauteur réelle d'un fichier avant upload.
- `src/pages/feed/CreatePost.jsx` — écran de crop entièrement refondu : cadre fixe, pinch-to-zoom + glisser (haut/bas/gauche/droite), par média du carrousel.
- `src/pages/feed/PostCard.jsx` — rendu du feed unifié : plus jamais d'`object-cover` improvisé, toujours le crop stocké rejoué à l'identique.
- `src/pages/feed/Feed.jsx` et `PostDetail.jsx` — requêtes mises à jour (nouvelles colonnes, anciennes colonnes supprimées).
- `supabase/functions/migrate-crops/index.ts` (NOUVEAU) — déjà déployée sur ton projet Supabase.

## Déjà fait sur ta base Supabase
- Nouvelles colonnes sur `post_medias` : `zoom`, `offset_x`, `offset_y`, `natural_width`, `natural_height`, `crop_format` (enum).
- Anciennes colonnes supprimées : `posts.crop_x/y/w/h`, `post_medias.crop_x/y/w/h`.
- Edge Function `migrate-crops` déployée.

## Ce qu'il te reste à faire : lancer la migration des posts existants

Une seule fois, après avoir déployé ce code :

```bash
curl -X POST "https://htcageekgcycixcsplkq.supabase.co/functions/v1/migrate-crops" \
  -H "Authorization: Bearer TA_CLE_ANON"
```

Ou depuis le Dashboard Supabase → Edge Functions → `migrate-crops` → Invoke.

La réponse liste chaque média avec `ok: true/false` + les dimensions lues. Si un média échoue (`ok: false`), regarde le `detail` : le parseur MP4 est volontairement minimal (pas de dépendance binaire en Edge Function), donc un format vidéo inhabituel peut échouer. Dans ce cas ce média retombera sur zoom=1/offset=0 par défaut tant que tu ne le rééditeras pas manuellement.

## Ce qui n'a PAS été touché
Reels (`ReelsViewer.jsx`) — respectait déjà tes règles, aucune modification.
