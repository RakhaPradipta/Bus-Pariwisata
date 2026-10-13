/**
 * Klien API.
 *
 * Semua request diarahkan ke `/api/...` dan diteruskan oleh proxy Vite
 * (dev) atau dilayani langsung oleh Express (produksi).
 *
 * Mode demo (hosting statis seperti Vercel tanpa server): bila request
 * baca gagal di level jaringan atau server mengembalikan non-JSON
 * (mis. halaman fallback SPA), endpoint baca milik beranda dilayani dari
 * `demoData.js` supaya halaman tetap tampil. Error HTTP asli (400/404/409)
 * tetap diteruskan apa adanya. Paksa mode demo saat build dengan
 * `VITE_DEMO=1`.
 */
import { demoRequest } from './demoData.js'

const TOKEN_KEY = 'trans27.admin.token'

export const tokenStore = {
  get() {
    try {
      return localStorage.getItem(TOKEN_KEY)
    } catch {
      return null
    }
  },
  set(token) {
    try {
      localStorage.setItem(TOKEN_KEY, token)
    } catch {
      /* localStorage tidak tersedia (mode privat) — abaikan */
    }
  },
  clear() {
    try {
      localStorage.removeItem(TOKEN_KEY)
    } catch {
      /* abaikan */
    }
  },
}

export class ApiError extends Error {
  constructor(message, status) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

async function request(path, { method = 'GET', body, auth = false } = {}) {
  // Mode demo paksa: tanpa server sama sekali (hasil build statis).
  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_DEMO === '1') {
    return demoRequest(path, { method, body })
  }

  const headers = {}
  if (body !== undefined) headers['Content-Type'] = 'application/json'

  if (auth) {
    const token = tokenStore.get()
    if (token) headers.Authorization = `Bearer ${token}`
  }

  let res
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    // Jaringan gagal total (server mati / hosting statis) → coba data demo
    // untuk endpoint baca; endpoint tulis tetap melempar error yang jelas.
    return demoOrThrow(path, { method, body })
  }

  const data = await res.json().catch(() => null)

  if (!res.ok) {
    // Respons JSON = error asli dari server (400/401/404/409/…) → teruskan.
    if (data) {
      if (res.status === 401) tokenStore.clear()
      throw new ApiError(data?.error ?? `Permintaan gagal (HTTP ${res.status}).`, res.status)
    }
    // Non-JSON (mis. halaman fallback host statis) → coba data demo.
    return demoOrThrow(path, { method, body })
  }
  return data
}

/** Fallback demo; melempar ApiError ramah bila endpoint butuh server. */
async function demoOrThrow(path, opts) {
  try {
    notifyDemo()
    return await demoRequest(path, opts)
  } catch (err) {
    if (err?.name === 'ApiError' && err.status === 0 && err.message.startsWith('Fitur ini')) {
      throw err
    }
    throw new ApiError('Tidak dapat terhubung ke server. Pastikan API sedang berjalan.', 0)
  }
}

let demoNotified = false
function notifyDemo() {
  if (demoNotified) return
  demoNotified = true
  try {
    console.info('[27trans] API tidak terjangkau — memakai data demo statis.')
  } catch {
    /* abaikan */
  }
}

const qs = (params) => {
  const search = new URLSearchParams()
  Object.entries(params ?? {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') search.set(key, value)
  })
  const str = search.toString()
  return str ? `?${str}` : ''
}

export const api = {
  health: () => request('/health'),
  cities: () => request('/cities'),
  routes: () => request('/routes'),
  popularRoutes: () => request('/routes/popular'),
  fleet: () => request('/fleet'),

  searchSchedules: (params) => request(`/schedules${qs(params)}`),
  alternatives: (params) => request(`/routes/alternatives${qs(params)}`),
  assistantInfo: () => request('/assistant/info'),
  schedule: (id) => request(`/schedules/${encodeURIComponent(id)}`),

  createBooking: (payload) => request('/bookings', { method: 'POST', body: payload }),
  getBooking: (code) => request(`/bookings/${encodeURIComponent(code)}`),

  admin: {
    login: (username, password) =>
      request('/admin/login', { method: 'POST', body: { username, password } }),
    logout: () => request('/admin/logout', { method: 'POST', auth: true }),
    me: () => request('/admin/me', { auth: true }),

    stats: () => request('/admin/stats', { auth: true }),
    routes: () => request('/admin/routes', { auth: true }),
    buses: () => request('/admin/buses', { auth: true }),

    schedules: (params) => request(`/admin/schedules${qs(params)}`, { auth: true }),
    createSchedule: (payload) =>
      request('/admin/schedules', { method: 'POST', body: payload, auth: true }),
    updateSchedule: (id, payload) =>
      request(`/admin/schedules/${id}`, { method: 'PUT', body: payload, auth: true }),
    deleteSchedule: (id) =>
      request(`/admin/schedules/${id}`, { method: 'DELETE', auth: true }),

    bookings: (params) => request(`/admin/bookings${qs(params)}`, { auth: true }),
    updateBookingStatus: (id, status) =>
      request(`/admin/bookings/${id}`, { method: 'PATCH', body: { status }, auth: true }),

    changePassword: (currentPassword, newPassword) =>
      request('/admin/password', {
        method: 'POST',
        body: { currentPassword, newPassword },
        auth: true,
      }),
  },
}
