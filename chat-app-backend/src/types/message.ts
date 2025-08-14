import { UserPayload } from './user' // UserPayloadをインポート

export interface Message {
  id: string
  content: string
  createdAt: Date // ISO 8601形式の文字列ではなく、Dateオブジェクトに変更
  updatedAt: Date // Prismaスキーマに基づく、Dateオブジェクトに変更
  userId: string
  user: UserPayload // メッセージを送信したユーザー (UserPayloadを使用)
  roomId: string
  // 以下は、必要に応じてPrismaスキーマのMessageモデルに追加したリレーションフィールド
  // replyToId?: string | null;
  // replies?: Message[];
  // reactions?: any[];
}
