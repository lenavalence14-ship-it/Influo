-- Ajoute le support musique aux notes photo.
-- audio_url      : fichier audio complet uploadé dans le bucket storage "posts"
-- audio_start    : secondes, point de départ du passage choisi dans le fichier source
-- audio_duration : durée en secondes du passage joué (15 ou 20), aussi utilisée
--                  par NoteViewer pour remplacer SEGMENT_DURATION_MS sur ce segment.
alter table public.notes
  add column if not exists audio_url text,
  add column if not exists audio_start numeric default 0,
  add column if not exists audio_duration numeric;

comment on column public.notes.audio_url is 'URL du fichier audio complet (bucket posts), ou null si pas de musique';
comment on column public.notes.audio_start is 'Secondes : début du passage choisi dans le fichier audio source';
comment on column public.notes.audio_duration is 'Secondes (15 ou 20) : durée du passage joué = durée d''affichage de la note';
