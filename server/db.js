/**
 * Koneksi & skema database.
 * Memakai modul `node:sqlite` bawaan Node.js (>= 22.5) sehingga tidak
 * memerlukan dependency native / proses kompilasi.
 */
import { DatabaseSync } from 'node:sqlite'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'

const DATA_DIR = join(import.meta.dirname, 'data')
mkdirSync(DATA_DIR, { recursive: true })

const DB_PATH = process.env.DB_PATH ?? join(DATA_DIR, 'app.db')

/** @type {import('node:sqlite').DatabaseSync} */
export const db = new DatabaseSync(DB_PATH)

db.exec('PRAGMA journal_mode = WAL')
db.exec('PRAGMA foreign_keys = ON')

/** Skema tabel. Idempotent — aman dijalankan berulang. */
export function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS routes (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      origin           TEXT    NOT NULL,
      destination      TEXT    NOT NULL,
      distance_km      INTEGER NOT NULL,
      duration_minutes INTEGER NOT NULL,
      base_price       INTEGER NOT NULL,
      UNIQUE (origin, destination)
    );

    CREATE TABLE IF NOT EXISTS buses (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      name         TEXT    NOT NULL,
      plate        TEXT    NOT NULL UNIQUE,
      class        TEXT    NOT NULL,
      seat_rows    INTEGER NOT NULL,
      seat_cols    INTEGER NOT NULL,
      aisle_after  INTEGER NOT NULL,
      facilities   TEXT    NOT NULL DEFAULT '[]',
      is_active    INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS schedules (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      route_id       INTEGER NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
      bus_id         INTEGER NOT NULL REFERENCES buses(id) ON DELETE CASCADE,
      departure_time TEXT    NOT NULL,
      arrival_time   TEXT    NOT NULL,
      price          INTEGER NOT NULL,
      is_active      INTEGER NOT NULL DEFAULT 1,
      UNIQUE (route_id, bus_id, departure_time)
    );

    CREATE TABLE IF NOT EXISTS bookings (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      code          TEXT    NOT NULL UNIQUE,
      schedule_id   INTEGER NOT NULL REFERENCES schedules(id) ON DELETE CASCADE,
      contact_name  TEXT    NOT NULL,
      contact_phone TEXT    NOT NULL,
      contact_email TEXT,
      total_price   INTEGER NOT NULL,
      status        TEXT    NOT NULL DEFAULT 'paid',
      created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS booking_seats (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      booking_id      INTEGER NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
      seat_number     INTEGER NOT NULL,
      passenger_name  TEXT    NOT NULL,
      passenger_phone TEXT,
      UNIQUE (booking_id, seat_number)
    );

    CREATE TABLE IF NOT EXISTS admins (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      username      TEXT    NOT NULL UNIQUE,
      password_hash TEXT    NOT NULL,
      name          TEXT    NOT NULL,
      created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token      TEXT    PRIMARY KEY,
      admin_id   INTEGER NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
      expires_at TEXT    NOT NULL
    );

    CREATE TABLE IF NOT EXISTS chat_logs (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT    NOT NULL,
      role       TEXT    NOT NULL,
      content    TEXT    NOT NULL,
      intent     TEXT,
      mode       TEXT,
      created_at TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_schedules_route ON schedules(route_id);
    CREATE INDEX IF NOT EXISTS idx_chat_logs_session ON chat_logs(session_id);
    CREATE INDEX IF NOT EXISTS idx_bookings_schedule ON bookings(schedule_id);
    CREATE INDEX IF NOT EXISTS idx_booking_seats_booking ON booking_seats(booking_id);
  `)
}

/** Kursi yang sudah terisi pada sebuah jadwal (untuk validasi ketersediaan). */
export function getBookedSeats(scheduleId) {
  return db
    .prepare(
      `SELECT bs.seat_number AS seatNumber
         FROM booking_seats bs
         JOIN bookings b ON b.id = bs.booking_id
        WHERE b.schedule_id = ? AND b.status = 'paid'`,
    )
    .all(scheduleId)
    .map((r) => r.seatNumber)
}
