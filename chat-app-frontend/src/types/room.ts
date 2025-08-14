import type { User } from './user' // User型をインポート

export interface Room {
  id: string
  name: string
  isDM: boolean
  isMemo: boolean
  ownerId?: string | null
  users?: User[] // ルームに参加しているユーザー
}
