import { api } from './client'
import type { Server, ServerMetrics, ServerSummary } from '../types/servers'

export function list() {
  return api.get<Server[]>('/servers').then((r) => r.data)
}

export function get(id: number) {
  return api.get<Server>(`/servers/${id}`).then((r) => r.data)
}

export function create(body: { name: string; metricsUrl: string; labels?: string[] }) {
  return api.post<Server>('/servers', body).then((r) => r.data)
}

export function update(id: number, body: { name?: string; metricsUrl?: string; labels?: string[]; isActive?: boolean }) {
  return api.patch<Server>(`/servers/${id}`, body).then((r) => r.data)
}

export function remove(id: number) {
  return api.delete(`/servers/${id}`)
}

export function metrics(id: number, limit = 100) {
  return api.get<ServerMetrics[]>(`/servers/${id}/metrics`, { params: { limit: String(limit) } }).then((r) => r.data)
}

export function summary(id: number, days = 1) {
  return api.get<ServerSummary>(`/servers/${id}/summary`, { params: { days: String(days) } }).then((r) => r.data)
}
