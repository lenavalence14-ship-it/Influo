-- =============================================================
-- 1. Table de stockage des tokens push (un par appareil/utilisateur)
-- =============================================================
create table if not exists public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  token text not null unique,
  platform text not null, -- 'android' ou 'ios'
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists push_tokens_user_id_idx on public.push_tokens(user_id);

alter table public.push_tokens enable row level security;

-- Chaque utilisateur ne peut gérer que ses propres tokens
create policy "Users can manage their own push tokens"
  on public.push_tokens
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- =============================================================
-- 2. Trigger : à chaque nouvelle notification insérée, on appelle
--    l'Edge Function `send-push` qui se charge d'envoyer le push FCM.
--    Nécessite l'extension pg_net (déjà activée par défaut sur la plupart
--    des projets Supabase récents ; sinon : create extension pg_net;)
-- =============================================================
create or replace function public.trigger_send_push()
returns trigger as $$
begin
  perform net.http_post(
    url := 'https://VOTRE_PROJET.supabase.co/functions/v1/send-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer VOTRE_SERVICE_ROLE_KEY'
    ),
    body := jsonb_build_object(
      'user_id', new.user_id,
      'type', new.type,
      'contenu', new.contenu,
      'notification_id', new.id
    )
  );
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_notification_created on public.notifications;
create trigger on_notification_created
  after insert on public.notifications
  for each row execute function public.trigger_send_push();

-- =============================================================
-- NOTES IMPORTANTES avant d'exécuter ce script :
-- 1. Remplacer VOTRE_PROJET par l'URL réelle de votre projet Supabase
-- 2. Remplacer VOTRE_SERVICE_ROLE_KEY par la clé service_role
--    (Dashboard Supabase > Settings > API > service_role key)
-- 3. Déployer d'abord l'Edge Function `send-push` (voir supabase/functions/send-push/index.ts)
-- =============================================================
