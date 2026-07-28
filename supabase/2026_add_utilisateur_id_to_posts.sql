-- Jusqu'ici, posts.influenceur_id (NOT NULL, référence profils_influenceur)
-- supposait que TOUT post est publié par un influenceur. La fonctionnalité
-- "souvenirs" (templates remplis par un utilisateur_simple avec sa photo et
-- son texte, puis publiés dans le feed comme un post normal) casse cette
-- hypothèse : un utilisateur_simple n'a et n'aura jamais de ligne dans
-- profils_influenceur (voir AuthContext.jsx -- "utilisateur_simple n'a pas
-- de table de profil dédiée").
--
-- utilisateur_id : référence directe à users(id), renseignée UNIQUEMENT
-- pour un post publié par un utilisateur_simple (souvenir). Pour tout post
-- influenceur existant ou futur, elle reste NULL et influenceur_id est
-- utilisé comme avant -- rien ne change pour eux.
--
-- influenceur_id devient nullable : un post a désormais soit
-- influenceur_id, soit utilisateur_id renseigné (jamais les deux, jamais
-- aucun des deux), garanti par la contrainte check ci-dessous.
alter table posts
  add column if not exists utilisateur_id uuid references users(id);

alter table posts
  alter column influenceur_id drop not null;

alter table posts
  add constraint if not exists posts_un_seul_auteur_check
  check (
    (influenceur_id is not null and utilisateur_id is null)
    or (influenceur_id is null and utilisateur_id is not null)
  );
