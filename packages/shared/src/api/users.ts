import { api } from './client'
import type { User } from '../types/misc'

export function list() {
  return api.get<User[]>('/users').then((r) => r.data)
}

export function create(body: { email: string; password: string; displayName: string; role: string }) {
  return api.post<User>('/users', body).then((r) => r.data)
}

export function update(id: number, body: { displayName?: string; role?: string; isActive?: boolean }) {
  return api.patch<User>(`/users/${id}`, body).then((r) => r.data)
}

export function remove(id: number) {
  return api.delete(`/users/${id}`).then((r) => r.data)
}
