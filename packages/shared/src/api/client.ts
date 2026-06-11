import axios, { AxiosError } from 'axios'

export const api = axios.create({
  baseURL: '/api',
  timeout: 15_000,
  headers: { 'Content-Type': 'application/json' },
})

let _getApiKey: (() => Promise<string | null>) | null = null

/** Configure base URL and API key provider on app startup.
 *  Mobile calls this with the server address + keychain reader.
 *  Web calls this with default (relative) and no key. */
export function configureApi(opts: {
  baseURL: string
  apiKeyProvider?: () => Promise<string | null>
}) {
  api.defaults.baseURL = opts.baseURL
  _getApiKey = opts.apiKeyProvider ?? null
}

// Request interceptor — attach API key if available
api.interceptors.request.use(async (config) => {
  if (_getApiKey) {
    const key = await _getApiKey()
    if (key) config.headers.set('x-api-key', key)
  }
  return config
})

// Response interceptor — normalize errors
api.interceptors.response.use(
  (res) => res,
  (error: AxiosError) => {
    const message =
      error.response?.status === 401
        ? '认证失败，请检查 API Key'
        : error.response?.status === 404
          ? '请求的资源不存在'
          : error.message ?? '网络请求失败'
    return Promise.reject(new Error(message))
  },
)
