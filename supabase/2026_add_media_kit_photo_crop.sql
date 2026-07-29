-- Recadrage (zoom + pan, façon Instagram) de la photo du Media Kit, même
-- système que post_medias (voir mediaCrop.js, cropFormat = 'media_kit',
-- ratio 4/3). NULL = pas de recadrage manuel enregistré (media kits créés
-- avant cette migration) -> getCropTransformStyle retombe sur son fallback
-- (coverZoom, cadre rempli sans bord vide, comportement identique à l'ancien
-- object-cover centré) pour ne rien casser sur les media kits déjà publiés.
alter table media_kits
  add column if not exists photo_zoom numeric,
  add column if not exists photo_offset_x numeric,
  add column if not exists photo_offset_y numeric,
  add column if not exists photo_natural_width numeric,
  add column if not exists photo_natural_height numeric;
