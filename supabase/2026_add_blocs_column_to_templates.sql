-- Ajoute la colonne `blocs` (JSONB) à la table `templates`.
-- Chaque élément du tableau représente un bloc (texte ou photo) avec sa
-- position, son style, et un champ `editable` (boolean) qui définit si
-- l'utilisateur final peut le modifier dans TemplatePreview.jsx.
--
-- Déjà appliquée en direct sur le projet Supabase "influo-app"
-- (htcageekgcycixcsplkq) le 2026-07-28. Ce fichier sert de trace
-- versionnée dans le repo.

alter table public.templates
  add column if not exists blocs jsonb not null default '[]'::jsonb;

comment on column public.templates.blocs is
  'Tableau des blocs (texte/image/forme) du template. Chaque bloc porte un champ editable:boolean qui définit si l''utilisateur final peut le modifier.';
