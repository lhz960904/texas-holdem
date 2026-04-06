import { randomUUID } from 'crypto'
import bcrypt from 'bcryptjs'
import db from './index'

export interface User {
  id: string
  username: string
  nickname: string
  avatar: string
  chips_balance: number
  games_played: number
  games_won: number
  created_at: string
}

const SALT_ROUNDS = 10

const stmts = {
  findByUsername: db.prepare('SELECT * FROM users WHERE username = ?'),
  findById: db.prepare('SELECT * FROM users WHERE id = ?'),
  insert: db.prepare(
    'INSERT INTO users (id, username, password_hash, nickname, avatar, chips_balance) VALUES (?, ?, ?, ?, ?, ?)'
  ),
  updateAvatar: db.prepare('UPDATE users SET avatar = ? WHERE id = ?'),
  updateChips: db.prepare('UPDATE users SET chips_balance = ? WHERE id = ?'),
  addChips: db.prepare('UPDATE users SET chips_balance = chips_balance + ? WHERE id = ?'),
  incrementGames: db.prepare('UPDATE users SET games_played = games_played + 1 WHERE id = ?'),
  incrementWins: db.prepare('UPDATE users SET games_won = games_won + 1 WHERE id = ?'),
}

export class UserRepository {
  /** Login or auto-register. Returns { user, isNewUser } or throws on wrong password */
  async loginOrRegister(
    username: string,
    password: string,
    avatar: string = ''
  ): Promise<{ user: User; isNewUser: boolean }> {
    const existing = stmts.findByUsername.get(username) as any

    if (existing) {
      // Existing user — verify password
      const match = await bcrypt.compare(password, existing.password_hash)
      if (!match) {
        throw new Error('密码错误')
      }
      const { password_hash: _, ...user } = existing
      return { user: user as User, isNewUser: false }
    }

    // New user — register
    const id = randomUUID()
    const hash = await bcrypt.hash(password, SALT_ROUNDS)
    const nickname = username // Default nickname = username
    stmts.insert.run(id, username, hash, nickname, avatar, 50000)

    const user: User = {
      id,
      username,
      nickname,
      avatar,
      chips_balance: 50000,
      games_played: 0,
      games_won: 0,
      created_at: new Date().toISOString(),
    }
    return { user, isNewUser: true }
  }

  findById(id: string): User | undefined {
    const row = stmts.findById.get(id) as any
    if (!row) return undefined
    const { password_hash: _, ...user } = row
    return user as User
  }

  updateAvatar(id: string, avatar: string): void {
    stmts.updateAvatar.run(avatar, id)
  }

  updateChips(id: string, chips: number): void {
    stmts.updateChips.run(chips, id)
  }

  addChips(id: string, delta: number): void {
    stmts.addChips.run(delta, id)
  }

  incrementGames(id: string): void {
    stmts.incrementGames.run(id)
  }

  incrementWins(id: string): void {
    stmts.incrementWins.run(id)
  }
}
