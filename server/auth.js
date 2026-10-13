/**
 * Autentikasi admin.
 * - Password di-hash memakai scrypt + salt acak (tanpa dependency eksternal).
 * - Sesi disimpan di tabel `sessions` dengan token acak & masa berlaku.
 */
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import { db } from './db.js'

const SESSION_TTL_HOURS = 12

export function hashPassword(password) {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${hash}`
}

export function verifyPassword(password, stored) {
  const [salt, hash] = String(stored ?? '').split(':')
  if (!salt || !hash) return false
  const expected = Buffer.from(hash, 'hex')
  const actual = scryptSync(password, salt, 64)
  return expected.length === actual.length && timingSafeEqual(expected, actual)
}

export function createSession(adminId) {
  const token = randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + SESSION_TTL_HOURS * 3600 * 1000).toISOString()
  db.prepare('INSERT INTO sessions (token, admin_id, expires_at) VALUES (?, ?, ?)').run(
    token,
    adminId,
    expiresAt,
  )
  return { token, expiresAt }
}

export function destroySession(token) {
  db.prepare('DELETE FROM sessions WHERE token = ?').run(token)
}

/** Mengambil data admin dari sebuah token; null bila tidak valid / kedaluwarsa. */
export function getAdminByToken(token) {
  if (!token) return null
  const row = db
    .prepare(
      `SELECT a.id, a.username, a.name, s.expires_at AS expiresAt
         FROM sessions s
         JOIN admins a ON a.id = s.admin_id
        WHERE s.token = ?`,
    )
    .get(token)
  if (!row) return null
  if (new Date(row.expiresAt).getTime() < Date.now()) {
    destroySession(token)
    return null
  }
  return { id: row.id, username: row.username, name: row.name }
}

/** Middleware Express: wajib menyertakan header `Authorization: Bearer <token>`. */
export function requireAdmin(req, res, next) {
  const header = req.headers.authorization ?? ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null
  const admin = getAdminByToken(token)
  if (!admin) return res.status(401).json({ error: 'Sesi tidak valid. Silakan login ulang.' })
  req.admin = admin
  req.token = token
  next()
}
