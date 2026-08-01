-- Support du partage de post dans les messages sociaux (bouton avion en
-- papier de PostCard.jsx, jusqu'ici sans onClick). Un message "partage de
-- post" garde son fonctionnement normal (sender_id, conversation_id,
-- created_at, etc.) mais référence en plus le post partagé via
-- shared_post_id -- MessageBubble.jsx détecte cette colonne pour afficher
-- le rendu spécial (avatar+nom auteur en haut, media, nom+légende en bas)
-- au lieu de la bulle texte/fichier générique.
--
-- NULL = message normal (texte ou fichier), comportement inchangé.
-- on delete set null : si le post d'origine est supprimé, le message de
-- partage reste visible dans l'historique de conversation mais retombe sur
-- l'affichage "publication indisponible" plutôt que d'être supprimé lui
-- aussi (voir MessageBubble.jsx).
alter table public.messages_sociale
  add column if not exists shared_post_id uuid references public.posts(id) on delete set null;

comment on column public.messages_sociale.shared_post_id is
  'Post partagé via le bouton Send de PostCard, ou NULL pour un message normal';
