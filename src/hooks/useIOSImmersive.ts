import { useEffect, useState } from 'react'
import { useIsIOS } from './useIsIOS'

export function useIOSImmersive(): {
  isIOS: boolean
  isLandscape: boolean
  immersiveActive: boolean
} {
  const isIOS = useIsIOS()
  const [isLandscape, setIsLandscape] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    return window.matchMedia('(orientation: landscape)').matches
  })

  useEffect(() => {
    if (typeof window === 'undefined') return
    const mql = window.matchMedia('(orientation: landscape)')
    const sync = (e: MediaQueryListEvent | MediaQueryList) => {
      setIsLandscape(e.matches)
    }
    sync(mql)
    mql.addEventListener('change', sync)
    return () => mql.removeEventListener('change', sync)
  }, [])

  return {
    isIOS,
    isLandscape,
    immersiveActive: isIOS && isLandscape,
  }
}
