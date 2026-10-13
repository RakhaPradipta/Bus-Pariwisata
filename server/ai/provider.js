/**
 * Adaptor model bahasa (opsional).
 *
 * Aplikasi ini berjalan penuh TANPA kunci API: seluruh fitur asisten
 * sudah bekerja lewat aturan + data dari database. Adaptor ini hanya
 * menambah kemampuan memparafrase kalimat agar terdengar lebih alami.
 *
 * Sengaja memakai `fetch` bawaan (tanpa SDK) supaya tidak menambah
 * dependency. Karena bentuk API-nya OpenAI-compatible, penyedia mana pun
 * bisa dipakai cukup dengan mengubah variabel lingkungan:
 *
 *   AI_API_KEY   kunci API                          (wajib untuk mode LLM)
 *   AI_BASE_URL  default https://api.openai.com/v1
 *   AI_MODEL     default gpt-4o-mini
 *
 * Contoh penyedia lain:
 *   OpenRouter  AI_BASE_URL=https://openrouter.ai/api/v1  AI_MODEL=<slug model>
 *   Groq        AI_BASE_URL=https://api.groq.com/openai/v1 AI_MODEL=<slug model>
 *   Gemini      AI_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai
 */

const API_KEY = process.env.AI_API_KEY ?? process.env.OPENAI_API_KEY ?? ''
const BASE_URL = (process.env.AI_BASE_URL ?? 'https://api.openai.com/v1').replace(/\/+$/, '')
const MODEL = process.env.AI_MODEL ?? 'gpt-4o-mini'
const TIMEOUT_MS = Number(process.env.AI_TIMEOUT_MS ?? 12000)

export function isConfigured() {
  return Boolean(API_KEY)
}

export function providerInfo() {
  return { configured: isConfigured(), model: isConfigured() ? MODEL : null, baseUrl: isConfigured() ? BASE_URL : null }
}

/**
 * Mengalirkan balasan model sebagai potongan teks.
 *
 * Tidak pernah melempar error: bila penyedia sedang bermasalah, generator
 * berhenti dan pemanggil memakai jawaban deterministik yang sudah disiapkan.
 *
 * @param {{system: string, messages: Array<{role: string, content: string}>, signal?: AbortSignal}} options
 */
export async function* streamCompletion({ system, messages, signal }) {
  if (!isConfigured()) return

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS)
  const onAbort = () => controller.abort()
  signal?.addEventListener('abort', onAbort, { once: true })

  try {
    const res = await fetch(`${BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        stream: true,
        temperature: 0.3,
        max_tokens: 320,
        messages: [{ role: 'system', content: system }, ...messages],
      }),
      signal: controller.signal,
    })

    if (!res.ok || !res.body) return

    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })

      // Protokol SSE: satu peristiwa per baris "data: {...}".
      let newline
      while ((newline = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, newline).trim()
        buffer = buffer.slice(newline + 1)
        if (!line.startsWith('data:')) continue
        const payload = line.slice(5).trim()
        if (!payload || payload === '[DONE]') continue
        try {
          const parsed = JSON.parse(payload)
          const delta = parsed.choices?.[0]?.delta?.content
          if (delta) yield delta
        } catch {
          /* potongan tidak lengkap — abaikan */
        }
      }
    }
  } catch {
    /* jaringan putus / waktu habis — pemanggil memakai jawaban cadangan */
  } finally {
    clearTimeout(timeout)
    signal?.removeEventListener('abort', onAbort)
  }
}

const REPHRASE_SYSTEM = `Anda adalah asisten layanan pelanggan PO Bus Jokam Trans.
Tugas Anda HANYA memparafrase jawaban yang diberikan agar lebih ramah dan mengalir dalam Bahasa Indonesia.

Aturan yang tidak boleh dilanggar:
1. Semua angka, harga, waktu, nomor kursi, dan nomor telepon WAJIB disalin persis. Jangan menghitung ulang, membulatkan, atau menggantinya.
2. Jangan menambah fakta, kebijakan, promo, atau janji apa pun yang tidak ada di sumber.
3. Jangan mengarang nomor kursi atau jadwal yang tidak disebut di sumber.
4. Maksimal 3 kalimat. Tanpa markdown, tanpa daftar bernomor, sapaan pembuka cukup sekali.
5. Bahasa Indonesia sehari-hari, sopan, tidak kaku, tidak berlebihan.
Jika sumber sudah cukup jelas, cukup rapikan. Jangan menambahkan pertanyaan balik.`

/**
 * Meminta model menulis ulang jawaban deterministik.
 * Generator berhenti tanpa hasil apa pun bila gagal, sehingga pemanggil
 * selalu bisa jatuh kembali ke teks asli.
 */
export function rephrase({ text, question, facts, signal }) {
  return streamCompletion({
    system: REPHRASE_SYSTEM,
    messages: [
      {
        role: 'user',
        content: `Pertanyaan penumpang: ${question}\n\nFakta yang boleh disebut (satu-satunya sumber):\n${facts ?? text}\n\nJawaban dasar: ${text}`,
      },
    ],
    signal,
  })
}
