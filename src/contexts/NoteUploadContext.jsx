import { createContext, useContext, useState, useCallback } from 'react'

// Petit registre global (en mémoire) des uploads de note en cours, par
// utilisateur. Sert uniquement à piloter l'anneau lumineux tournant autour
// de l'avatar pendant qu'une note (photo notamment) s'envoie en arrière-plan
// après un retour immédiat au feed (cf. CreateNote.handlePublish).
const NoteUploadContext = createContext({
  uploadingUserIds: new Set(),
  startUpload: () => {},
  finishUpload: () => {},
})

export function NoteUploadProvider({ children }) {
  const [uploadingUserIds, setUploadingUserIds] = useState(() => new Set())

  const startUpload = useCallback((userId) => {
    if (!userId) return
    setUploadingUserIds((prev) => {
      const next = new Set(prev)
      next.add(userId)
      return next
    })
  }, [])

  const finishUpload = useCallback((userId) => {
    if (!userId) return
    setUploadingUserIds((prev) => {
      if (!prev.has(userId)) return prev
      const next = new Set(prev)
      next.delete(userId)
      return next
    })
  }, [])

  return (
    <NoteUploadContext.Provider value={{ uploadingUserIds, startUpload, finishUpload }}>
      {children}
    </NoteUploadContext.Provider>
  )
}

export function useNoteUpload() {
  return useContext(NoteUploadContext)
}

export function useIsUploadingNote(userId) {
  const { uploadingUserIds } = useNoteUpload()
  return userId ? uploadingUserIds.has(userId) : false
}
