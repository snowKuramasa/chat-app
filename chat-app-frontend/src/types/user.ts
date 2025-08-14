// バックエンドのUserPayloadと一致させる
export interface User {
  id: string
  username: string
  isGuest: boolean
  profileImage?: string | null
  bio?: string | null
}
