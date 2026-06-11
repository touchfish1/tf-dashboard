import { api } from './client'
import type { Alert } from '../types/misc'

export function list(limit = 50) {
  return api.get<Alert[]>('/alerts', { params: { limit: String(limit) } }).then((r) => r.data)
}

export function unread() {
  return api.get<{ count: number }>('/alerts/unread').then((r) => r.data)
}

export function ack(id: number) {
  return api.post(`/alerts/${id}/ack`).then((r) => r.data)
}

export function ackAll(type?: string) {
  return api.post('/alerts/ack-all', type ? { type } : {}).then((r) => r.data)
}
