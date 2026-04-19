import { useEffect, useState } from 'react'

function detectIOS(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  if (/iPhone|iPad|iPod/.test(ua)) return true
  if (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) return true
  return false
}

export function useIsIOS(): boolean {
  const [isIOS, setIsIOS] = useState<boolean>(() => detectIOS())
  useEffect(() => {
    setIsIOS(detectIOS())
  }, [])
  return isIOS
}
