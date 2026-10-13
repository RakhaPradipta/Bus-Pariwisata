import { useCallback, useEffect, useRef, useState } from 'react'

export function useAsync(fn, deps = [], { immediate = true } = {}) {
  const [state, setState] = useState({ data: null, loading: immediate, error: null })
  const mounted = useRef(true)
  const fnRef = useRef(fn)

  // Sinkronkan ref lewat effect (bukan saat render) agar nilai fn selalu
  // terkini saat re-render tanpa melanggar aturan react-hooks/refs.
  useEffect(() => {
    fnRef.current = fn
  })

  /**
   * Jalankan fn TANPA menyentuh state secara sinkron — semua setState terjadi
   * setelah await, sehingga aman dipanggil dari dalam effect
   * (react-hooks/set-state-in-effect melarang setState sinkron di effect).
   */
  const execute = useCallback(async () => {
    try {
      const data = await fnRef.current()
      if (mounted.current) setState({ data, loading: false, error: null })
    } catch (error) {
      if (mounted.current) setState({ data: null, loading: false, error })
    }
  }, [])

  /** Reload manual dari event handler: set loading dulu lalu jalankan. */
  const run = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }))
    return execute()
  }, [execute])

  useEffect(() => {
    mounted.current = true
    if (immediate) void execute()
    return () => {
      mounted.current = false
    }
  }, [execute, immediate, deps])

  return { ...state, reload: run }
}
