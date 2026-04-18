import { useCallback, useEffect, useState } from 'react'

const STORAGE_KEY = 'atomy.favorites'

function readInitial(): Set<string> {
  if (typeof window === 'undefined') return new Set()
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return new Set()
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) {
      window.localStorage.removeItem(STORAGE_KEY)
      return new Set()
    }
    return new Set(parsed.filter((v): v is string => typeof v === 'string'))
  } catch {
    try {
      window.localStorage.removeItem(STORAGE_KEY)
    } catch {
      /* ignore */
    }
    return new Set()
  }
}

export type UseFavorites = {
  favorites: Set<string>
  toggle: (slug: string) => void
  isFavorite: (slug: string) => boolean
}

export function useFavorites(): UseFavorites {
  const [favorites, setFavorites] = useState<Set<string>>(() => readInitial())

  // Defensive: if SSR/hydration somehow produced an empty set while storage has data, re-read on mount.
  useEffect(() => {
    const fromStorage = readInitial()
    if (fromStorage.size !== favorites.size) setFavorites(fromStorage)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const toggle = useCallback((slug: string) => {
    setFavorites((prev) => {
      const next = new Set(prev)
      if (next.has(slug)) next.delete(slug)
      else next.add(slug)
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]))
      } catch {
        /* storage full or disabled — in-memory state still reflects */
      }
      return next
    })
  }, [])

  const isFavorite = useCallback(
    (slug: string) => favorites.has(slug),
    [favorites],
  )

  return { favorites, toggle, isFavorite }
}
