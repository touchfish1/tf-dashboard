import { useState, useEffect } from 'react'
import { useSettings } from '../store/settings'

export function useHealth() {
  const { apiUrl } = useSettings()
  const [isOnline, setIsOnline] = useState(true)

  useEffect(() => {
    const check = async () => {
      try {
        const base = apiUrl.replace(/\/$/, '')
        const res = await fetch(`${base}/health`, { signal: AbortSignal.timeout(5000) })
        setIsOnline(res.ok)
      } catch {
        setIsOnline(false)
      }
    }
    check()
    const iv = setInterval(check, 30000)
    return () => clearInterval(iv)
  }, [apiUrl])

  return isOnline
}
