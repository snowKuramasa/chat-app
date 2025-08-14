// PrismaのUserモデルのサブセット（JWTペイロード用）
export interface UserPayload {
  id: string
  username: string
  isGuest: boolean
  profileImage?: string | null
  bio?: string | null
}
