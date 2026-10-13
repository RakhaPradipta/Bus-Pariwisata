/**
 * Klien asisten.
 *
 * Balasan dikirim sebagai Server-Sent Events di atas permintaan POST,
 * sehingga tidak bisa memakai `EventSource` (yang hanya mendukung GET). 
 * Karena itu frame SSE dibaca manual dari `ReadableStream`.
 */

const SESSION_KEY = 'trans27.assistant.session'

export const ASSISTANT_EVENT = 'trans27:open-assistant'

export function openAssistant() {
  window.dispatchEvent(new CustomEvent(ASSISTANT_EVENT))
}

export const assistantSession = {
  get() {
    try {
      return sessionStorage.getItem(SESSION_KEY)
    } catch {
      return null
    }
  },
  set(id) {
    try {
      sessionStorage.setItem(SESSION_KEY, id)
    } catch {
      /* penyimpanan tidak tersedia — sesi berjalan tanpa kelanjutan konteks */
    }
  },
}

/** Mengubah satu frame SSE menjadi `{ event, data }`. */
function parseFrame(frame) {
  let event = 'message'
  const dataLines = []

  for (const rawLine of frame.split('\n')) {
    const line = rawLine.trimEnd()
    if (line.startsWith('event:')) event = line.slice(6).trim()
    else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim())
  }

  if (!dataLines.length) return null
  try {
    return { event, data: JSON.parse(dataLines.join('\n')) }
  } catch {
    return null
  }
}

/**
 * Mengirim pesan ke asisten dan memanggil `onEvent` untuk setiap peristiwa.
 * Peristiwa: `meta`, `chunk`, `cards`, `actions`, `done`.
 */
export async function streamChat({ message, sessionId, onEvent, signal }) {
  let res
  try {
    res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, sessionId }),
      signal,
    })
  } catch (error) {
    if (error?.name === 'AbortError') return
    throw new Error('Tidak dapat menghubungi asisten. Pastikan server berjalan.', { cause: error })
  }

  if (!res.ok) {
    const payload = await res.json().catch(() => null)
    throw new Error(payload?.error ?? `Asisten tidak merespons (HTTP ${res.status}).`)
  }
  if (!res.body) throw new Error('Balasan asisten tidak dapat dibaca.')

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })

      let boundary
      while ((boundary = buffer.indexOf('\n\n')) !== -1) {
        const frame = buffer.slice(0, boundary)
        buffer = buffer.slice(boundary + 2)
        const parsed = parseFrame(frame)
        if (parsed) onEvent(parsed)
      }
    }
  } catch (error) {
    if (error?.name !== 'AbortError') throw error
  }
}
