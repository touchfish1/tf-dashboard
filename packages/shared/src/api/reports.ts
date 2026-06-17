import { api } from './client'
import type { ScheduledReport } from '../types/misc'

export function list(limit = 20) {
  return api
    .get<ScheduledReport[]>('/reports', { params: { limit: String(limit) } })
    .then((r) => r.data)
}
