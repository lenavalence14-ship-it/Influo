/**
 * BottomSheet — panneau modal glissant depuis le bas.
 * Centralise le pattern (overlay + poignée + slide-up) déjà utilisé
 * pour les commentaires et les menus d'options.
 *
 * height: 'auto' (contenu court, ex. menu d'actions)
 *         'tall' (75vh, ex. liste de commentaires)
 */
export default function BottomSheet({ children, onClose, height = 'auto', title }) {
  return (
    <div className="fixed inset-0 z-[100] flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />


      <div
        className={`relative bg-[var(--bg-elevated)] rounded-t-2xl flex flex-col animate-slide-up ${
          height === 'tall' ? 'h-[75vh]' : ''
        }`}
        style={{ paddingBottom: 'max(24px, env(safe-area-inset-bottom))' }}
      >
        <div className="flex items-center justify-center relative py-3 shrink-0">
          <div className="absolute left-1/2 -translate-x-1/2 top-2 w-10 h-1 rounded-full bg-[var(--border)]" />
          {title && <span className="text-body-medium mt-2">{title}</span>}
        </div>

        <div className={height === 'tall' ? 'flex-1 overflow-y-auto' : ''}>{children}</div>
      </div>
    </div>
  )
}
