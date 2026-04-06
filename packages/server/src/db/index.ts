import Database from 'better-sqlite3'
import { resolve } from 'path'

const DB_PATH = resolve(process.cwd(), 'data', 'poker.db')

// Ensure data directory exists
import { mkdirSync } from 'fs'
mkdirSync(resolve(process.cwd(), 'data'), { recursive: true })

import type BetterSqlite3 from 'better-sqlite3'
const db: BetterSqlite3.Database = new Database(DB_PATH)

// Enable WAL mode for better concurrent read performance
db.pragma('journal_mode = WAL')

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    nickname TEXT NOT NULL,
    avatar TEXT NOT NULL DEFAULT '',
    chips_balance INTEGER NOT NULL DEFAULT 50000,
    games_played INTEGER NOT NULL DEFAULT 0,
    games_won INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`)

export default db
