import { randomUUID } from 'crypto'
import bcrypt from 'bcryptjs'
import sql from './index'

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

export class UserRepository {
  async loginOrRegister(
    username: string,
    password: string,
    avatar: string = ''
  ): Promise<{ user: User; isNewUser: boolean }> {
    const rows = await sql`SELECT * FROM users WHERE username = ${username}`
    const existing = rows[0]

    if (existing) {
      const match = await bcrypt.compare(password, existing.password_hash)
      if (!match) throw new Error('密码错误')
      const { password_hash: _, ...user } = existing
      return { user: user as User, isNewUser: false }
    }

    const id = randomUUID()
    const hash = await bcrypt.hash(password, SALT_ROUNDS)
    const nickname = username

    await sql`
      INSERT INTO users (id, username, password_hash, nickname, avatar, chips_balance)
      VALUES (${id}, ${username}, ${hash}, ${nickname}, ${avatar}, 50000)
    `

    const user: User = {
      id, username, nickname, avatar,
      chips_balance: 50000, games_played: 0, games_won: 0,
      created_at: new Date().toISOString(),
    }
    return { user, isNewUser: true }
  }

  async findById(id: string): Promise<User | undefined> {
    const rows = await sql`SELECT * FROM users WHERE id = ${id}`
    if (!rows[0]) return undefined
    const { password_hash: _, ...user } = rows[0]
    return user as User
  }

  async updateAvatar(id: string, avatar: string): Promise<void> {
    await sql`UPDATE users SET avatar = ${avatar} WHERE id = ${id}`
  }

  async updateChips(id: string, chips: number): Promise<void> {
    await sql`UPDATE users SET chips_balance = ${chips} WHERE id = ${id}`
  }

  async addChips(id: string, delta: number): Promise<void> {
    await sql`UPDATE users SET chips_balance = chips_balance + ${delta} WHERE id = ${id}`
  }

  async incrementGames(id: string): Promise<void> {
    await sql`UPDATE users SET games_played = games_played + 1 WHERE id = ${id}`
  }

  async incrementWins(id: string): Promise<void> {
    await sql`UPDATE users SET games_won = games_won + 1 WHERE id = ${id}`
  }
}
