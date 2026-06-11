import { useCallback, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'

/**
 * Pull-to-refresh hook that invalidates TanStack Query caches.
 * @param queryKeys - Specific query keys to invalidate. Omit to invalidate all.
 */
export function useRefresh(queryKeys?: string[][]) {
  const [refreshing, setRefreshing] = useState(false)
  const queryClient = useQueryClient()

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    try {
      if (queryKeys && queryKeys.length > 0) {
        await Promise.all(queryKeys.map((key) => queryClient.invalidateQueries({ queryKey: key })))
      } else {
        await queryClient.invalidateQueries()
      }
    } finally {
      setRefreshing(false)
    }
  }, [queryKeys])

  return { refreshing, onRefresh }
}
