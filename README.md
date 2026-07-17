# Influo — PWA

Plateforme mettant en relation influenceurs et entreprises. Réseau social (feed, stories, posts, likes/commentaires) + marketplace d'offres + messagerie + paiement (simulé) + portefeuille + retraits Mobile Money + dashboards + administration.

## Stack

- React 19 + Vite 8 + React Router 7
- Tailwind CSS v4
- Supabase (Auth, Postgres, Storage, Realtime)
- PWA (installable, manifest + service worker via `vite-plugin-pwa`)

## Démarrage

```bash
npm install
npm run dev
```

L'app tourne sur `http://localhost:5173`.

## Build de production

```bash
npm run build
npm run preview   # pour tester le build localement
```

Le dossier `dist/` contient le résultat prêt à déployer (Vercel, Netlify, Cloudflare Pages, ou ton propre hébergement).

## Variables d'environnement

Le fichier `.env` est déjà rempli avec les identifiants de ton projet Supabase (`influo-app`, région eu-west-1). Si tu changes de projet Supabase, remplace :

```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

Ces valeurs se trouvent dans Supabase → Project Settings → API.

## Compte administrateur

- **Nom affiché dans l'app** : CEO Influo App
- **Email de connexion (technique, pas affiché)** : `ceo@influo.app`
- **Mot de passe** : `influoadminmotdepasse`
- **URL de connexion admin** : `/admin/connexion`

⚠️ Change ce mot de passe une fois en production (Supabase Auth → Users).

## Structure du projet

```
src/
  contexts/       → Auth (session, profil, rôle) et Thème (dark/light)
  lib/supabase.js → client Supabase configuré
  components/
    ui/           → Button, Input, GlassCard, VerifiedBadge (design system)
    layout/       → AppLayout + BottomNav (navigation façon Instagram)
  pages/
    auth/         → Connexion, Inscription (choix influenceur/client), mot de passe oublié
    feed/         → Feed principal, stories, recherche, notifications, publication
    profile/      → Profil influenceur (2 onglets Publications/Offres), profil client, édition
    offers/       → Création d'offre (maquette photo), détail offre publique
    messages/     → Liste conversations, nouvelle conversation (message pré-rempli), chat
    wallet/       → Portefeuille (solde disponible/verrouillé), retraits Mobile Money
    dashboard/    → Dashboard influenceur et client
    admin/        → Connexion admin séparée + dashboard (statistiques, gestion)
```

## Fonctionnement du paiement (important)

Il n'y a **pas d'intégration réelle avec MTN Mobile Money / Moov Money** — aucune API locale n'était disponible au moment de la construction. Le flux de paiement est **simulé** :

1. L'influenceur clique "Recevoir le paiement" dans une conversation → crée une commande + message système
2. Le client clique "Payer" → le paiement est marqué réussi instantanément (`provider_simule: 'mock'`), la commission de 10% est calculée, 90% du montant est crédité en **verrouillé** dans le wallet
3. L'influenceur livre la prestation (lien) → statut passe à "en attente de validation"
4. Le client confirme la réception → les fonds passent de **verrouillé** à **disponible**

Pour brancher un vrai paiement plus tard, il faut remplacer la logique dans `src/pages/messages/Chat.jsx` (fonction `handlePay`) par un vrai appel à l'API du fournisseur de paiement choisi.

Le retrait vers Mobile Money (`src/pages/wallet/Wallet.jsx`) enregistre la demande dans la table `retraits` avec le statut `en_attente` — un admin doit la traiter manuellement (paiement réel hors app) puis marquer "traité" depuis `/admin`.

## Base de données Supabase

17 tables, RLS activé sur toutes, policies vérifiées pour :
- Lecture publique du feed, profils, offres (tout le monde peut consulter)
- Écriture restreinte aux propriétaires (un client ne peut pas modifier l'offre d'un influenceur, etc.)
- Accès admin élargi en lecture sur paiements/retraits/commandes/conversations/wallets via la fonction `is_admin()`

Un trigger crée automatiquement un wallet (solde 0) à la création de tout profil influenceur.

## Installer la PWA sur mobile

Une fois déployée sur un domaine HTTPS : ouvrir le site dans Safari (iOS) ou Chrome (Android), puis "Ajouter à l'écran d'accueil". L'icône, le nom "Influo" et le mode plein écran sont déjà configurés dans le manifest.

## Ce qui reste à faire avant un vrai lancement public

- Remplacer le paiement simulé par une vraie intégration (API MTN/Moov ou agrégateur comme PawaPay/CinetPay)
- Activer "Leaked Password Protection" dans Supabase Auth (option gratuite, désactivée par défaut)
- Ajouter une modération de contenu (photos/messages) si le volume d'utilisateurs grossit
- Prévoir un système de notifications push réel (actuellement les notifications sont uniquement en base, pas de push)
