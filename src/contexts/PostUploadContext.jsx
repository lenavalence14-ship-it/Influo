import { createContext, useContext, useState, useCallback } from 'react'

// Registre global (en mémoire) de la progression d'upload d'une publication en
// cours, par utilisateur. Sert à piloter le cercle de progression tourant
// autour du bouton "+" du feed pendant que la publication s'envoie en arrière-
// plan après un retour immédiat à l'accueil (cf. CreatePost.handlePublish).
const PostUploadContext = createContext({
  uploads: new Map(), // userId -> progress (0-100)
  startUpload: () => {},
  updateProgress: () => {},
  finishUpload: () => {},
})

export function PostUploadProvider({ children }) {
  const [uploads, setUploads] = useState(() => new Map())

  const startUpload = useCallback((userId) => {
    if (!userId) return
    setUploads((prev) => {
      const next = new Map(prev)
      next.set(userId, 0)
      return next
    })
  }, [])

  const updateProgress = useCallback((userId, progress) => {
    if (!userId) return
    setUploads((prev) => {
      if (!prev.has(userId)) return prev
      const next = new Map(prev)
      next.set(userId, Math.max(0, Math.min(100, progress)))
      return next
    })
  }, [])

  const finishUpload = useCallback((userId) => {
    if (!userId) return
    setUploads((prev) => {
      if (!prev.has(userId)) return prev
      const next = new Map(prev)
      next.delete(userId)
      return next
    })
  }, [])

  return (
    <PostUploadContext.Provider value={{ uploads, startUpload, updateProgress, finishUpload }}>
      {children}
    </PostUploadContext.Provider>
  )
}

export function usePostUpload() {
  return useContext(PostUploadContext)
}

// Retourne le pourcentage (0-100) si un upload est en cours pour cet utilisateur,
// ou null sinon.
export function usePostUploadProgress(userId) {
  const { uploads } = usePostUpload()
  return userId && uploads.has(userId) ? uploads.get(userId) : null
}
