import { api } from './client'
import type { AlertRule } from '../types/misc'

export function list() {
  return api.get<AlertRule[]>('/alert-rules').then((r) => r.data)
}

export function get(id: number) {
  return api.get<AlertRule>(`/alert-rules/${id}`).then((r) => r.data)
}

export function create(body: Partial<AlertRule>) {
  return api.post<AlertRule>('/alert-rules', body).then((r) => r.data)
}

export function update(id: number, body: Partial<AlertRule>) {
  return api.put<AlertRule>(`/alert-rules/${id}`, body).then((r) => r.data)
}

export function remove(id: number) {
  return api.delete(`/alert-rules/${id}`).then((r) => r.data)
}
