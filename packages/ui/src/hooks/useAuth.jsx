import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { api, tokenStore } from '../lib/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [admin, setAdmin] = useState(null)
  // Hanya "memuat" bila memang ada sesi tersimpan yang perlu diverifikasi.
  const [loading, setLoading] = useState(() => Boolean(tokenStore.get()))

  // Pulihkan sesi dari token yang tersimpan saat aplikasi dibuka.
  useEffect(() => {
    if (!tokenStore.get()) return undefined

    let active = true
    api.admin
      .me()
      .then(({ admin: me }) => {
        if (active) setAdmin(me)
      })
      .catch(() => tokenStore.clear())
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [])

  const login = useCallback(async (username, password) => {
    const { token, admin: me } = await api.admin.login(username, password)
    tokenStore.set(token)
    setAdmin(me)
    return me
  }, [])

  const logout = useCallback(async () => {
    try {
      await api.admin.logout()
    } catch {
      /* token mungkin sudah kedaluwarsa — tetap bersihkan sesi lokal */
    }
    tokenStore.clear()
    setAdmin(null)
  }, [])

  const value = useMemo(
    () => ({ admin, loading, login, logout, isAuthenticated: Boolean(admin) }),
    [admin, loading, login, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth harus dipakai di dalam <AuthProvider>')
  return ctx
}
