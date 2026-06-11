import { api } from './client'
import type { DeepSeekBalance } from '../types/deepseek'

export function balance() {
  return api.get<DeepSeekBalance>('/deepseek/balance').then((r) => r.data)
}

export function history(days = 30) {
  return api.get<DeepSeekBalance[]>('/deepseek/history', { params: { days: String(days) } }).then((r) => r.data)
}
