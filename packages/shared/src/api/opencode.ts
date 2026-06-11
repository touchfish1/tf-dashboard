import { api } from './client'
import type { OpenCodeSummary, OpenCodeDailyUsage, OpenCodeUsage, OpenCodeByModel, OpenCodePrediction } from '../types/opencode'

export function summary() {
  return api.get<OpenCodeSummary>('/opencode/summary').then((r) => r.data)
}

export function usage(days = 7) {
  return api.get<OpenCodeDailyUsage[]>('/opencode/usage', { params: { days: String(days) } }).then((r) => r.data)
}

export function usageRaw(days = 7, limit = 200) {
  return api
    .get<OpenCodeUsage[]>('/opencode/usage', { params: { days: String(days), raw: 'true', limit: String(limit) } })
    .then((r) => r.data)
}

export function byModel(days = 7) {
  return api.get<OpenCodeByModel[]>('/opencode/by-model', { params: { days: String(days) } }).then((r) => r.data)
}

export function predict(days = 30, predictDays = 7) {
  return api
    .get<OpenCodePrediction>('/opencode/predict', { params: { days: String(days), predict: String(predictDays) } })
    .then((r) => r.data)
}
