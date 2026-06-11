import { api } from './client'

export function getAll() {
  return api.get<Record<string, string>>('/settings').then((r) => r.data)
}

export function get(key: string) {
  return api.get<{ value: string | null }>(`/settings/${key}`).then((r) => r.data)
}

export function set(key: string, value: string) {
  return api.put(`/settings/${key}`, { value }).then((r) => r.data)
}

export function remove(key: string) {
  return api.delete(`/settings/${key}`).then((r) => r.data)
}
