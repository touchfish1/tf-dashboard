import { api } from './client'
import type { AuditEntry } from '../types/misc'

export function list(limit = 50, offset = 0, days = 30, type = '') {
  return api
    .get<AuditEntry[]>('/audit', {
      params: {
        limit: String(limit),
        offset: String(offset),
        days: String(days),
        ...(type ? { type } : {}),
      },
    })
    .then((r) => r.data)
}
