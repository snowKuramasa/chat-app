import type { User } from './user' // User型をインポート

export interface Message {
  id: string
  content: string
  createdAt: string // ISO 8601形式の文字列
  userId: string
  user: User // メッセージを送信したユーザー
  roomId: string
}
