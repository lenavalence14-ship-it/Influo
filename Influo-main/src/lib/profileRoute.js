// Construit l'URL de profil correcte selon le rôle de l'utilisateur (public.users.id).
// Centralisé ici pour éviter que chaque écran (notifications, listes de followers,
// recherche, etc.) ré-invente sa propre logique de routage.
export function profileRoute(userId, role) {
  if (role === 'influenceur') return `/influenceur/${userId}`
  if (role === 'client') return `/entreprise/${userId}`
  return `/utilisateur/${userId}`
}
