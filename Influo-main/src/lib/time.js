/**
 * Formate une date en temps relatif, façon Instagram.
 * < 1 min: "à l'instant"
 * < 60 min: "12 min"
 * < 24h: "3 h"
 * < 7j: "5 j"
 * < 5 semaines: "3 sem"
 * au-delà: date courte (ex: "12 mars") ou avec année si différente de l'année en cours
 */
export function timeAgo(dateInput) {
  if (!dateInput) return ''
  const date = new Date(dateInput)
  const now = new Date()
  const diffMs = now - date
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHour = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHour / 24)
  const diffWeek = Math.floor(diffDay / 7)

  if (diffSec < 60) return "à l'instant"
  if (diffMin < 60) return `${diffMin} min`
  if (diffHour < 24) return `${diffHour} h`
  if (diffDay < 7) return `${diffDay} j`
  if (diffWeek < 5) return `${diffWeek} sem`

  const sameYear = date.getFullYear() === now.getFullYear()
  return date.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: sameYear ? undefined : 'numeric',
  })
}

/**
 * Retourne le nom de la section temporelle à laquelle appartient une date,
 * façon Instagram ("Aujourd'hui", "Hier", "7 derniers jours", "30 derniers jours", "Plus ancien").
 */
export function dateSection(dateInput) {
  const date = new Date(dateInput)
  const now = new Date()
  const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const diffDays = Math.floor((startOfDay(now) - startOfDay(date)) / (1000 * 60 * 60 * 24))

  if (diffDays <= 0) return "Aujourd'hui"
  if (diffDays === 1) return 'Hier'
  if (diffDays <= 7) return '7 derniers jours'
  if (diffDays <= 30) return '30 derniers jours'
  return 'Plus ancien'
}

/**
 * Version courte pour les messages/discussions (ex: heure si aujourd'hui, sinon date).
 */
export function timeShort(dateInput) {
  if (!dateInput) return ''
  const date = new Date(dateInput)
  const now = new Date()
  const isToday = date.toDateString() === now.toDateString()

  if (isToday) {
    return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  }

  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  if (date.toDateString() === yesterday.toDateString()) return 'Hier'

  const sameYear = date.getFullYear() === now.getFullYear()
  return date.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: sameYear ? undefined : 'numeric',
  })
}