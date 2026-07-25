-- Le crop_format existant (carre/vertical/horizontal) ne stocke que le RATIO
-- choisi, pas le CADRAGE précis (position/zoom) que l'utilisateur a réglé
-- manuellement dans l'écran de recadrage (voir crop / draftCrop dans
-- CreatePost.jsx, un rectangle en % : {x, y, w, h}). Résultat : le feed
-- retombait toujours sur un object-cover centré par défaut, différent du
-- cadrage exact confirmé dans l'éditeur.
--
-- crop_x / crop_y / crop_w / crop_h : rectangle de recadrage en pourcentage
-- de l'image source (0-100), même repère que draftCrop côté éditeur.
-- NULL = pas de recadrage manuel enregistré (posts existants, avant cette
-- migration) -> le feed retombe sur le comportement précédent (object-cover
-- centré) pour ne rien casser sur les publications déjà en ligne.
alter table posts
  add column if not exists crop_x numeric,
  add column if not exists crop_y numeric,
  add column if not exists crop_w numeric,
  add column if not exists crop_h numeric;
