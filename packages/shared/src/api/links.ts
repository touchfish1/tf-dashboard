import { api } from './client'
import type { NavLink } from '../types/misc'

export function list() {
  return api.get<NavLink[]>('/links').then((r) => r.data)
}

export function create(body: { title: string; url: string; icon?: string; category?: string }) {
  return api.post<NavLink>('/links', body).then((r) => r.data)
}

export function update(id: number, body: { title?: string; url?: string; category?: string }) {
  return api.put<NavLink>(`/links/${id}`, body).then((r) => r.data)
}

export function remove(id: number) {
  return api.delete(`/links/${id}`)
}
